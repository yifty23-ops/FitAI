import json
import logging
import re
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from database import get_db
from models.user import User
from routes.auth import get_current_user
from services.claude_client import ClaudeClient

onboarding_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)
logger = logging.getLogger(__name__)

VALID_TIERS = {"free", "pro", "elite"}

# Fields that MUST be present before we allow done=true
REQUIRED_FIELDS = {
    "goal", "age", "weight_kg", "height_cm", "sex", "experience",
    "days_per_week", "session_minutes", "equipment",
    "sleep_hours", "stress_level", "job_activity", "diet_style",
}

# Valid field types the frontend can render
VALID_FIELD_TYPES = {
    "single_select", "multi_select", "number", "text", "textarea",
    "slider", "date", "day_picker", "yes_no", "strength_benchmarks",
}

# Sanitize free-text values to prevent prompt injection
_SANITIZE_RE = re.compile(r"[^\w\s.,;:!?'\"-/()+=%@#&*\[\]{}]", re.UNICODE)


def _sanitize(value: str, max_len: int = 500) -> str:
    return _SANITIZE_RE.sub("", value)[:max_len]


def _sanitize_answers(answers: dict) -> dict:
    """Sanitize all string values in answers dict."""
    clean = {}
    for k, v in answers.items():
        if isinstance(v, str):
            clean[k] = _sanitize(v, 500)
        elif isinstance(v, list):
            clean[k] = [_sanitize(i, 100) if isinstance(i, str) else i for i in v]
        elif isinstance(v, dict):
            clean[k] = {
                dk: _sanitize(dv, 500) if isinstance(dv, str) else dv
                for dk, dv in v.items()
            }
        else:
            clean[k] = v
    return clean


def _check_completeness(answers: dict, tier: str) -> list[str]:
    """Return list of missing required fields."""
    missing = []
    for field in REQUIRED_FIELDS:
        val = answers.get(field)
        if val is None or val == "" or val == []:
            missing.append(field)

    # days_per_week can be derived from training_days_specific
    if "days_per_week" in missing and answers.get("training_days_specific"):
        days = answers["training_days_specific"]
        if isinstance(days, list) and len(days) > 0:
            missing.remove("days_per_week")

    # Elite requires sport
    if tier == "elite" and not answers.get("sport"):
        missing.append("sport")

    return missing


def _build_profile_data(answers: dict, tier: str) -> dict:
    """Build ProfileCreate-compatible dict from collected answers."""
    profile: dict[str, Any] = {}

    for key, value in answers.items():
        profile[key] = value

    # Derive days_per_week from training_days_specific
    if profile.get("training_days_specific") and not profile.get("days_per_week"):
        profile["days_per_week"] = len(profile["training_days_specific"])

    # Ensure days_per_week is an int
    if "days_per_week" in profile:
        try:
            profile["days_per_week"] = int(profile["days_per_week"])
        except (TypeError, ValueError):
            profile["days_per_week"] = 3

    # Ensure session_minutes is an int
    if "session_minutes" in profile:
        try:
            profile["session_minutes"] = int(profile["session_minutes"])
        except (TypeError, ValueError):
            profile["session_minutes"] = 60

    # Map injury_ortho_history to injuries for backward compat
    if profile.get("injury_ortho_history") and not profile.get("injuries"):
        profile["injuries"] = profile["injury_ortho_history"]

    # Ensure equipment is a list
    if "equipment" in profile and not isinstance(profile["equipment"], list):
        profile["equipment"] = [profile["equipment"]]

    return profile


def _validate_ai_response(data: dict) -> dict:
    """Validate and clean the AI's response structure."""
    if not isinstance(data.get("done"), bool):
        data["done"] = False

    if not isinstance(data.get("message"), str):
        data["message"] = "Let's continue setting up your profile."

    if not isinstance(data.get("fields"), list):
        data["fields"] = []

    # Validate each field
    valid_fields = []
    for field in data["fields"]:
        if not isinstance(field, dict):
            continue
        if not field.get("field_name") or not field.get("type"):
            continue
        if field["type"] not in VALID_FIELD_TYPES:
            continue
        # Ensure required is boolean
        field["required"] = bool(field.get("required", False))
        valid_fields.append(field)

    data["fields"] = valid_fields
    return data


# --- Request/Response schemas ---

class OnboardingNextRequest(BaseModel):
    answers_so_far: dict
    tier: str
    force_complete: bool = False


# --- Endpoint ---

@onboarding_router.post("/next-question")
@limiter.limit("10/minute")
def next_question(
    request: Request,
    body: OnboardingNextRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Always use server-verified tier from DB, never trust client-provided tier
    tier = user.tier

    # Sanitize all answers
    answers = _sanitize_answers(body.answers_so_far)

    client = ClaudeClient(api_key=settings.anthropic_api_key)

    try:
        result = client.generate_onboarding_question(
            answers_so_far=answers,
            tier=tier,
            force_complete=body.force_complete,
        )
    except Exception as e:
        logger.error("Onboarding question generation failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate question. Please try again.",
        )

    result = _validate_ai_response(result)

    # Safety net: if AI says done, verify all required fields are present
    if result["done"]:
        missing = _check_completeness(answers, tier)
        if missing:
            logger.warning(
                "AI signaled done but missing fields: %s. Asking for them.", missing
            )
            # Override: ask Claude specifically for the missing fields
            try:
                override_result = client.generate_onboarding_question(
                    answers_so_far=answers,
                    tier=tier,
                    force_complete=False,
                )
                override_result = _validate_ai_response(override_result)
                # Force it to not be done
                override_result["done"] = False
                if not override_result["fields"]:
                    override_result["message"] = (
                        "Almost there! I still need a few more details."
                    )
                return override_result
            except Exception:
                # If override also fails, return the missing fields as an error
                result["done"] = False
                result["message"] = "I need a few more details before we can proceed."
                result["fields"] = []
                return result

        # Build the profile data
        profile_data = _build_profile_data(answers, tier)
        return {
            "done": True,
            "message": result.get("message", "All set! Let's build your plan."),
            "fields": [],
            "profile_data": profile_data,
        }

    return result
