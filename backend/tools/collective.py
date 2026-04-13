from __future__ import annotations

import json
import logging

from sqlalchemy.orm import Session

from models.collective import CollectiveResult
from models.checkin import WeeklyCheckin
from models.plan import Plan
from models.profile import Profile
from models.session import SessionLog
from models.user import User
from tiers import check_feature
from tools.research import compute_profile_hash

logger = logging.getLogger(__name__)


def donate_result(
    plan: Plan,
    user: User,
    profile: Profile,
    success_score_raw: int,
    notes: str | None,
    db: Session,
) -> dict:
    """Donate anonymized training outcome to the collective pool.

    success_score_raw: 1-5 from user, mapped to 0.0-1.0.
    """
    profile_hash = compute_profile_hash(profile, user.tier)

    # Map 1-5 rating to 0.0-1.0
    success_score = (success_score_raw - 1) / 4.0

    # Build plan_config (anonymized — no PII)
    plan_config = {
        "goal": profile.goal,
        "experience": profile.experience,
        "days_per_week": profile.days_per_week,
        "mesocycle_weeks": plan.mesocycle_weeks,
        "tier": plan.tier_at_creation,
    }

    # Build outcome from sessions + checkins in the milestone window (last 3 weeks)
    milestone_week = plan.current_week
    window_start = max(1, milestone_week - 2)
    sessions = (
        db.query(SessionLog)
        .filter(
            SessionLog.plan_id == plan.id,
            SessionLog.week_number >= window_start,
            SessionLog.week_number <= milestone_week,
        )
        .all()
    )
    checkins = (
        db.query(WeeklyCheckin)
        .filter(
            WeeklyCheckin.plan_id == plan.id,
            WeeklyCheckin.week_number >= window_start,
            WeeklyCheckin.week_number <= milestone_week,
        )
        .all()
    )

    outcome = {
        "weeks_covered": list(range(window_start, milestone_week + 1)),
        "sessions_completed": len(sessions),
        "avg_recovery": _avg([c.recovery_score for c in checkins if c.recovery_score]),
        "avg_mood": _avg([c.mood_score for c in checkins if c.mood_score]),
        "avg_sleep": _avg([c.sleep_avg for c in checkins if c.sleep_avg]),
        "user_notes": notes,
    }

    result = CollectiveResult(
        profile_hash=profile_hash,
        sport=user.sport,
        plan_config=plan_config,
        outcome=outcome,
        success_score=success_score,
    )
    db.add(result)

    plan.milestone_pending = False
    db.commit()
    db.refresh(result)

    logger.info("Collective donation %s from user %s (score=%.2f)", result.id, user.id, success_score)
    return {
        "id": str(result.id),
        "success_score": success_score,
        "milestone_pending": False,
    }


def query_collective(profile_hash: str, profile: Profile, user: User, db: Session) -> str:
    """Query collective data for injection into research prompts.

    Returns a formatted string. Free tier gets a skip message.
    """
    if not check_feature(user, "collective"):
        return "Collective data not available on free tier."

    results: list[CollectiveResult] = []

    # Elite: prioritize sport-matched data
    if user.tier == "elite" and user.sport:
        sport_matched = (
            db.query(CollectiveResult)
            .filter_by(sport=user.sport)
            .filter(CollectiveResult.success_score >= 0.7)
            .order_by(CollectiveResult.success_score.desc())
            .limit(5)
            .all()
        )
        results.extend(sport_matched)

    # All paid tiers: exact profile hash match
    exact = (
        db.query(CollectiveResult)
        .filter_by(profile_hash=profile_hash)
        .filter(CollectiveResult.success_score >= 0.7)
        .order_by(CollectiveResult.success_score.desc())
        .limit(5)
        .all()
    )
    results.extend(exact)

    # Broader: same goal + experience
    broader = (
        db.query(CollectiveResult)
        .filter(CollectiveResult.plan_config["goal"].astext == profile.goal)
        .filter(CollectiveResult.plan_config["experience"].astext == profile.experience)
        .filter(CollectiveResult.success_score >= 0.7)
        .order_by(CollectiveResult.success_score.desc())
        .limit(10)
        .all()
    )
    results.extend(broader)

    # Deduplicate
    seen: set[str] = set()
    unique: list[CollectiveResult] = []
    for r in results:
        rid = str(r.id)
        if rid not in seen:
            seen.add(rid)
            unique.append(r)

    if not unique:
        return "No collective data available yet."

    lines = []
    for r in unique[:10]:
        sport_tag = f" [{r.sport}]" if r.sport else ""
        lines.append(
            f"Profile: {r.profile_hash[:8]}{sport_tag}, Score: {r.success_score:.1f}, "
            f"Config: {json.dumps(r.plan_config)}"
        )

    return "COLLECTIVE DATA (successful plans for similar profiles):\n" + "\n".join(lines)


def _avg(values: list[float]) -> float | None:
    """Compute average, returning None for empty lists."""
    if not values:
        return None
    return round(sum(values) / len(values), 1)
