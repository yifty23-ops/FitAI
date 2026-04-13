from __future__ import annotations

import hashlib
import json
import logging

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from config import settings
from models.adaptation import AdaptationLog
from models.checkin import WeeklyCheckin
from models.plan import Plan
from models.research_cache import ResearchCache
from models.session import SessionLog
from models.user import User
from services.claude_client import ClaudeClient
from tiers import check_feature

logger = logging.getLogger(__name__)


def _get_week_data(plan_data: dict, week_number: int) -> dict | None:
    """Extract a specific week from plan_data JSONB, handling multiple structures."""
    if not plan_data:
        return None

    weeks_data = plan_data.get("weeks", [])
    if not weeks_data:
        nested = plan_data.get("plan", {})
        if isinstance(nested, dict):
            weeks_data = nested.get("weeks", [])
        elif isinstance(plan_data, list):
            weeks_data = plan_data

    # Try by week_number field first
    for w in weeks_data:
        if isinstance(w, dict) and w.get("week_number") == week_number:
            return w

    # Fall back to index
    idx = week_number - 1
    if 0 <= idx < len(weeks_data) and isinstance(weeks_data[idx], dict):
        return weeks_data[idx]

    return None


def _compute_snapshot_hash(snapshot: dict, tier: str) -> str:
    """Compute profile hash from a plan's profile_snapshot dict (mirrors research.compute_profile_hash)."""
    equipment = snapshot.get("equipment") or []
    key_fields = {
        "goal": snapshot.get("goal", ""),
        "sex": snapshot.get("sex", ""),
        "experience": snapshot.get("experience", ""),
        "equipment": sorted(equipment) if isinstance(equipment, list) else [],
        "injuries": snapshot.get("injuries") or "",
        "days_per_week": snapshot.get("days_per_week", 0),
    }
    raw = json.dumps(key_fields, sort_keys=True) + f":{tier}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _get_cached_research(plan: Plan, db: Session) -> dict:
    """Look up cached research for a plan's profile snapshot and tier."""
    snapshot = plan.profile_snapshot or {}
    tier = plan.tier_at_creation or "free"
    profile_hash = _compute_snapshot_hash(snapshot, tier)

    cached = db.query(ResearchCache).filter_by(
        profile_hash=profile_hash, tier=tier
    ).first()
    if cached:
        return {
            "protocols": cached.protocols,
            "contraindications": cached.contraindications,
            "sources": cached.sources or [],
        }
    return {}


def get_adaptation_history(plan_id, db: Session) -> list:
    """Fetch previous adaptations for context."""
    logs = list(reversed(
        db.query(AdaptationLog)
        .filter(AdaptationLog.plan_id == plan_id)
        .order_by(AdaptationLog.week_number.desc())
        .limit(5)
        .all()
    ))
    return [
        {
            "week_number": log.week_number,
            "assessment": log.assessment,
            "adjustments": log.adjustments,
            "flags": log.flags,
        }
        for log in logs
    ]


def _apply_adjustments(plan: Plan, week_number: int, adjustments: list) -> None:
    """Apply adaptation adjustments to the target week in plan_data JSONB."""
    week_data = _get_week_data(plan.plan_data, week_number)
    if not week_data:
        logger.warning("Could not find week %d in plan_data to apply adjustments", week_number)
        return

    days = week_data.get("days", [])

    for adj in adjustments:
        adj_type = adj.get("type", "")
        target_day = adj.get("target_day")
        target_exercise = adj.get("target_exercise", "")
        change = adj.get("change", "")

        # Find the target day
        day_data = None
        if target_day is not None:
            for d in days:
                dn = d.get("day_number", 0)
                if dn == target_day:
                    day_data = d
                    break
            if day_data is None and 0 < target_day <= len(days):
                day_data = days[target_day - 1]

        if not day_data:
            logger.warning("Adjustment target day %s not found, skipping", target_day)
            continue

        exercises = day_data.get("exercises", [])

        if adj_type == "deload_trigger":
            # Apply volume reduction across all exercises in the day
            for ex in exercises:
                sets = ex.get("sets")
                if isinstance(sets, int) and sets > 1:
                    ex["sets"] = max(1, int(sets * 0.6))
                if change:
                    ex["load_instruction"] = change
            continue

        # Find the target exercise by name (case-insensitive partial match)
        target_ex = None
        for ex in exercises:
            ex_name = (ex.get("name") or ex.get("exercise") or "").lower()
            if target_exercise.lower() in ex_name or ex_name in target_exercise.lower():
                target_ex = ex
                break

        if not target_ex:
            logger.warning(
                "Exercise '%s' not found in day %s, skipping adjustment",
                target_exercise, target_day,
            )
            continue

        if adj_type == "load_change":
            target_ex["load_instruction"] = change
        elif adj_type == "volume_change":
            target_ex["load_instruction"] = change
            # Try to parse set/rep changes from the change description
        elif adj_type == "exercise_swap":
            target_ex["name"] = change
            target_ex.pop("swap_options", None)
        elif adj_type == "rest_change":
            target_ex["rest_seconds"] = change

    flag_modified(plan, "plan_data")


def adapt_plan(plan: Plan, user: User, db: Session) -> dict:
    """Run the full adaptation pipeline for a plan after a completed week."""
    if not check_feature(user, "adaptation"):
        return {"adapted": False, "reason": "Adaptation not available on free tier"}

    prev_week = plan.current_week - 1
    if prev_week < 1:
        return {"adapted": False, "reason": "No completed weeks to analyze"}

    # Check if next week exists in plan data
    next_week_data = _get_week_data(plan.plan_data, plan.current_week)
    if not next_week_data:
        return {"adapted": False, "reason": "Mesocycle complete, no next week to adapt"}

    # Gather sessions for the previous week
    sessions = (
        db.query(SessionLog)
        .filter(SessionLog.plan_id == plan.id, SessionLog.week_number == prev_week)
        .order_by(SessionLog.day_number.asc())
        .all()
    )
    session_data = [
        {
            "day_number": s.day_number,
            "logged_exercises": s.logged_exercises,
            "pre_readiness": s.pre_readiness,
            "notes": s.notes,
        }
        for s in sessions
    ]

    # Gather check-in for the previous week
    checkin = (
        db.query(WeeklyCheckin)
        .filter(WeeklyCheckin.plan_id == plan.id, WeeklyCheckin.week_number == prev_week)
        .first()
    )
    if not checkin:
        return {"adapted": False, "reason": "No check-in data for previous week"}

    checkin_data = {
        "recovery_score": checkin.recovery_score,
        "mood_score": checkin.mood_score,
        "sleep_avg": checkin.sleep_avg,
        "weight_kg": checkin.weight_kg,
        "notes": checkin.notes,
    }

    # Get cached research protocols
    research = _get_cached_research(plan, db)

    # Get adaptation history
    history = get_adaptation_history(plan.id, db)

    # Call Claude for adaptation
    client = ClaudeClient(settings.anthropic_api_key)
    tier = user.tier
    sport = user.sport
    competition_date = str(user.competition_date) if user.competition_date else None

    adaptations = client.adapt(
        profile=plan.profile_snapshot or {},
        research_protocols=research,
        completed_sessions=session_data,
        checkin=checkin_data,
        next_week_plan=next_week_data,
        plan_history=history,
        tier=tier,
        sport=sport,
        competition_date=competition_date,
    )

    # Validate response
    if "adjustments" not in adaptations:
        logger.error("Adaptation response missing 'adjustments' key")
        return {"adapted": False, "reason": "Invalid adaptation response"}

    # Apply adjustments to plan_data
    _apply_adjustments(plan, plan.current_week, adaptations.get("adjustments", []))

    # Save adaptation log
    log = AdaptationLog(
        plan_id=plan.id,
        week_number=plan.current_week,
        assessment=adaptations.get("assessment", ""),
        adjustments=adaptations.get("adjustments", []),
        flags=adaptations.get("flags"),
    )
    db.add(log)
    db.commit()

    logger.info(
        "Adaptation applied for plan %s week %d: %d adjustments",
        plan.id, plan.current_week, len(adaptations.get("adjustments", [])),
    )

    return {
        "adapted": True,
        "week": plan.current_week,
        "assessment": adaptations.get("assessment", ""),
        "adjustments": adaptations.get("adjustments", []),
        "flags": adaptations.get("flags", {}),
    }
