import hashlib
import json
import logging
import re

from sqlalchemy.orm import Session

from config import settings
from models.profile import Profile
from models.research_cache import ResearchCache
from models.user import User
from services.claude_client import ClaudeClient

logger = logging.getLogger(__name__)


def sanitize_for_prompt(text: str, max_length: int = 500) -> str:
    """Sanitize user-supplied text before interpolating into AI prompts.

    Strips characters that could be used for prompt injection and wraps
    the result in delimiters so the model can distinguish data from instructions.
    """
    if not text:
        return ""
    # Truncate to max length
    text = text[:max_length]
    # Remove control characters and null bytes
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", text)
    # Strip common prompt-injection delimiters/patterns
    text = text.replace("{", "").replace("}", "")
    return text


def compute_profile_hash(profile: Profile, tier: str) -> str:
    # Include age decade and weight bucket for more specific cache matching
    age_bucket = ((profile.age or 30) // 10) * 10  # 20s, 30s, 40s, etc.
    weight_bucket = ((int(profile.weight_kg or 70)) // 10) * 10  # 60kg, 70kg, 80kg, etc.
    key_fields = {
        "goal": profile.goal,
        "goal_sub_category": profile.goal_sub_category or "",
        "sex": profile.sex,
        "experience": profile.experience,
        "equipment": sorted(profile.equipment or []),
        "injuries": profile.injuries or "",
        "days_per_week": profile.days_per_week,
        "age_bucket": age_bucket,
        "weight_bucket": weight_bucket,
        # V2 fields that affect research quality
        "training_recency": profile.training_recency or "",
        "current_pain_level": profile.current_pain_level or 0,
        "exercise_blacklist": sorted(profile.exercise_blacklist or []),
        "body_fat_est": profile.body_fat_est or "",
    }
    raw = json.dumps(key_fields, sort_keys=True) + f":{tier}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def profile_to_research_dict(profile: Profile, user: User) -> dict:
    """Convert SQLAlchemy Profile + User to dict for prompt formatting.

    All free-text user fields are sanitized to prevent prompt injection.
    """
    equipment_list = profile.equipment or ["bodyweight"]
    equipment_str = ", ".join(sanitize_for_prompt(e, max_length=50) for e in equipment_list)
    blacklist_list = profile.exercise_blacklist or []
    blacklist_str = ", ".join(sanitize_for_prompt(e, max_length=50) for e in blacklist_list) or "none"
    days_specific = profile.training_days_specific or []
    days_specific_str = ", ".join(days_specific) if days_specific else "not specified"

    return {
        "goal": sanitize_for_prompt(profile.goal, max_length=50),
        "goal_sub_category": sanitize_for_prompt(profile.goal_sub_category or "general", max_length=30),
        "body_fat_est": sanitize_for_prompt(profile.body_fat_est or "unknown", max_length=10),
        "goal_deadline": str(profile.goal_deadline) if profile.goal_deadline else "none",
        "sex": sanitize_for_prompt(profile.sex, max_length=10),
        "age": profile.age or "unknown",
        "weight_kg": profile.weight_kg or "unknown",
        "height_cm": profile.height_cm or "unknown",
        "experience": sanitize_for_prompt(profile.experience, max_length=20),
        "experience_detail": f"{sanitize_for_prompt(profile.experience, max_length=20)} level trainee",
        "training_age_years": profile.training_age_years if profile.training_age_years is not None else "unknown",
        "training_recency": sanitize_for_prompt(profile.training_recency or "unknown", max_length=20),
        "days_per_week": profile.days_per_week or 3,
        "training_days_specific": days_specific_str,
        "session_minutes": profile.session_minutes or 60,
        "equipment": equipment_str,
        "injuries": sanitize_for_prompt(profile.injuries or "none reported", max_length=500),
        "injury_ortho_history": sanitize_for_prompt(profile.injury_ortho_history or "none reported", max_length=1000),
        "current_pain_level": profile.current_pain_level if profile.current_pain_level is not None else "none",
        "chair_stand_proxy": "yes" if profile.chair_stand_proxy else ("no" if profile.chair_stand_proxy is False else "not assessed"),
        "overhead_reach_proxy": "yes" if profile.overhead_reach_proxy else ("no" if profile.overhead_reach_proxy is False else "not assessed"),
        "exercise_blacklist": blacklist_str,
        "sleep_hours": profile.sleep_hours or "unknown",
        "stress_level": profile.stress_level or "unknown",
        "job_activity": sanitize_for_prompt(profile.job_activity or "unknown", max_length=20),
        "protein_intake_check": sanitize_for_prompt(profile.protein_intake_check or "unknown", max_length=10),
        "diet_style": sanitize_for_prompt(profile.diet_style or "unknown", max_length=20),
        "other_activities": sanitize_for_prompt(profile.other_activities or "none", max_length=300),
        "current_max_bench": json.dumps(profile.current_max_bench) if profile.current_max_bench else "not provided",
        "current_max_squat": json.dumps(profile.current_max_squat) if profile.current_max_squat else "not provided",
        "current_max_deadlift": json.dumps(profile.current_max_deadlift) if profile.current_max_deadlift else "not provided",
        "competition_date": str(user.competition_date) if user.competition_date else "none",
        "sport_phase": sanitize_for_prompt(user.sport_phase or "unknown", max_length=20),
        "sport_weekly_hours": user.sport_weekly_hours if user.sport_weekly_hours is not None else "unknown",
    }


def _attach_collective(result: dict, profile_hash: str, profile: Profile, user: User, db: Session) -> dict:
    """Append collective insights to research result if available (not cached — always fresh)."""
    try:
        from tools.collective import query_collective

        collective = query_collective(profile_hash, profile, user, db)
        if collective and not collective.startswith("Collective data not available") and not collective.startswith("No collective data"):
            result["collective_insights"] = collective
            logger.info("Collective data injected for user %s", user.id)
    except Exception as e:
        logger.warning("Collective data query failed, continuing without: %s", e)
    return result


def research_for_profile(user: User, profile: Profile, db: Session) -> dict:
    tier = user.tier
    sport = user.sport  # None for free/pro

    # 1. Compute tier-aware hash
    profile_hash = compute_profile_hash(profile, tier)

    # 2. Check cache (keyed by hash + tier)
    cached = db.query(ResearchCache).filter_by(
        profile_hash=profile_hash, tier=tier
    ).first()
    if cached:
        result = {
            "protocols": cached.protocols,
            "contraindications": cached.contraindications,
            "sources": cached.sources or [],
        }
        # Collective data is NOT cached — always query fresh
        return _attach_collective(result, profile_hash, profile, user, db)

    # 3. Cache miss — call Claude
    client = ClaudeClient(settings.anthropic_api_key)
    result = client.research(
        profile=profile_to_research_dict(profile, user),
        tier=tier,
        sport=sport,
    )

    # 4. Validate required keys
    if "protocols" not in result or "contraindications" not in result:
        raise ValueError("Research result missing required keys: protocols, contraindications")

    # 5. Cache with tier tag (collective data excluded from cache)
    entry = ResearchCache(
        profile_hash=profile_hash,
        tier=tier,
        protocols=result["protocols"],
        contraindications=result["contraindications"],
        sources=result.get("sources", []),
    )
    db.add(entry)
    db.commit()

    # 6. Attach collective data (fresh, not cached)
    return _attach_collective(result, profile_hash, profile, user, db)
