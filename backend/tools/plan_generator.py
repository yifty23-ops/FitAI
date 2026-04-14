from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from config import settings
from models.plan import Plan
from models.profile import Profile
from models.user import User
from services.claude_client import ClaudeClient
from tiers import TIER_FEATURES
from tools.research import profile_to_research_dict, research_for_profile

logger = logging.getLogger(__name__)


def _build_profile_snapshot(profile: Profile) -> dict:
    """Capture raw profile data at plan creation time."""
    return {
        "goal": profile.goal,
        "goal_sub_category": profile.goal_sub_category,
        "body_fat_est": profile.body_fat_est,
        "goal_deadline": str(profile.goal_deadline) if profile.goal_deadline else None,
        "age": profile.age,
        "weight_kg": profile.weight_kg,
        "height_cm": profile.height_cm,
        "sex": profile.sex,
        "experience": profile.experience,
        "training_age_years": profile.training_age_years,
        "training_recency": profile.training_recency,
        "days_per_week": profile.days_per_week,
        "training_days_specific": profile.training_days_specific,
        "session_minutes": profile.session_minutes,
        "equipment": profile.equipment,
        "injuries": profile.injuries,
        "injury_ortho_history": profile.injury_ortho_history,
        "current_pain_level": profile.current_pain_level,
        "chair_stand_proxy": profile.chair_stand_proxy,
        "overhead_reach_proxy": profile.overhead_reach_proxy,
        "exercise_blacklist": profile.exercise_blacklist,
        "sleep_hours": profile.sleep_hours,
        "stress_level": profile.stress_level,
        "job_activity": profile.job_activity,
        "protein_intake_check": profile.protein_intake_check,
        "diet_style": profile.diet_style,
        "other_activities": profile.other_activities,
        "current_max_bench": profile.current_max_bench,
        "current_max_squat": profile.current_max_squat,
        "current_max_deadlift": profile.current_max_deadlift,
    }


def _get_persona_display(tier: str, sport: str | None) -> str:
    """Human-readable persona name for plan display."""
    if tier == "elite":
        sport_name = sport.title() if sport else "General"
        return f"Elite {sport_name} Coach"
    elif tier == "pro":
        return "Pro Coach"
    return "Free Coach"


def generate_plan_for_profile(user: User, profile: Profile, db: Session) -> dict:
    """Full plan generation pipeline: research -> generate -> save."""
    tier = user.tier
    sport = user.sport
    competition_date = str(user.competition_date) if user.competition_date else None
    mesocycle_weeks = TIER_FEATURES[tier]["max_mesocycle_weeks"]

    # 1. Run research first (uses cache if available)
    logger.info("Running research for user %s (tier=%s)", user.id, tier)
    research = research_for_profile(user, profile, db)

    # 2. Build profile dict for prompt
    profile_dict = profile_to_research_dict(profile, user)

    # 3. Call Claude for plan generation
    logger.info("Generating plan for user %s (tier=%s, weeks=%d)", user.id, tier, mesocycle_weeks)
    client = ClaudeClient(settings.anthropic_api_key)
    result = client.generate_plan(
        profile=profile_dict,
        research=research,
        tier=tier,
        sport=sport,
        competition_date=competition_date,
    )

    # 4. Validate required keys and plan structure
    if "plan" not in result and "weeks" not in result:
        raise ValueError("Plan generation result missing required keys: plan or weeks")
    if "nutrition" not in result:
        raise ValueError("Plan generation result missing required key: nutrition")

    # Normalize: ensure plan_data always has a "weeks" key
    plan_section = result.get("plan", result)
    if isinstance(plan_section, dict):
        weeks = plan_section.get("weeks", [])
    elif isinstance(plan_section, list):
        weeks = plan_section
    else:
        weeks = []
    if not weeks or not isinstance(weeks, list):
        raise ValueError("Plan has no weeks data")
    # Validate each week has days
    for i, week in enumerate(weeks):
        if not isinstance(week, dict):
            raise ValueError(f"Week {i+1} is not a valid object")
        days = week.get("days", [])
        if not isinstance(days, list) or len(days) == 0:
            raise ValueError(f"Week {i+1} has no training days")

    # 5. Lock user row to prevent concurrent plan generation, then clean up drafts
    db.query(User).filter(User.id == user.id).with_for_update().first()
    db.query(Plan).filter(
        Plan.user_id == user.id,
        Plan.is_active == False,
    ).delete()

    # 6. Create plan record (as draft — user must confirm to activate)
    persona_used = _get_persona_display(tier, sport)
    plan = Plan(
        user_id=user.id,
        tier_at_creation=tier,
        profile_snapshot=_build_profile_snapshot(profile),
        mesocycle_weeks=mesocycle_weeks,
        current_week=1,
        phase="accumulation",
        plan_data=result["plan"],
        nutrition=result["nutrition"],
        persona_used=persona_used,
        is_active=False,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)

    logger.info("Plan %s created for user %s", plan.id, user.id)

    return {
        "plan_id": str(plan.id),
        "plan": result["plan"],
        "nutrition": result["nutrition"],
        "persona_used": persona_used,
        "tier": tier,
        "mesocycle_weeks": mesocycle_weeks,
    }
