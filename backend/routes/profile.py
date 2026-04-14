from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models.plan import Plan
from models.profile import Profile
from models.user import User
from routes.auth import get_current_user
from tiers import SPORT_DEMANDS

profile_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

VALID_GOALS = {"fat_loss", "muscle", "performance", "wellness"}
VALID_SEX = {"male", "female"}
VALID_EXPERIENCE = {"beginner", "intermediate", "advanced"}
VALID_JOB_ACTIVITY = {"sedentary", "light", "active", "moderate", "heavy_labor"}
VALID_DIET_STYLE = {"omnivore", "vegetarian", "vegan", "keto", "halal", "other"}
VALID_TRAINING_RECENCY = {"current", "1_month", "3_months", "6_months", "1_year", "2_years_plus"}
VALID_GOAL_SUB_CATEGORY = {
    "strength", "hypertrophy", "powerbuilding", "endurance",
    "cut", "recomp", "power", "sport", "longevity", "rehab",
}
VALID_BODY_FAT_EST = {"<10%", "10-15%", "15-20%", "20-25%", "25%+"}
VALID_PROTEIN_INTAKE = {"yes", "no", "unsure"}
VALID_SPORT_PHASE = {"off_season", "pre_season", "in_season"}
VALID_WEEKDAYS = {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}


# --- Request/Response schemas ---

class StrengthBenchmark(BaseModel):
    weight: float = Field(ge=0, le=1000)
    reps: int = Field(ge=1, le=100)


class ProfileCreate(BaseModel):
    goal: str
    age: int = Field(ge=13, le=120)
    weight_kg: float = Field(ge=20, le=500)
    height_cm: float = Field(ge=50, le=300)
    sex: str
    experience: str
    days_per_week: int = Field(ge=1, le=7)
    session_minutes: int = Field(ge=10, le=300)
    equipment: list[str]
    injuries: Optional[str] = Field(default=None, max_length=1000)
    sleep_hours: float = Field(ge=0, le=24)
    stress_level: int = Field(ge=1, le=10)
    job_activity: str
    diet_style: str
    sport: Optional[str] = Field(default=None, max_length=50)
    competition_date: Optional[str] = None
    # Onboarding V2 fields
    training_age_years: Optional[int] = Field(default=None, ge=0, le=50)
    training_recency: Optional[str] = None
    goal_sub_category: Optional[str] = None
    body_fat_est: Optional[str] = None
    goal_deadline: Optional[str] = None
    injury_ortho_history: Optional[str] = Field(default=None, max_length=2000)
    current_pain_level: Optional[int] = Field(default=None, ge=0, le=10)
    chair_stand_proxy: Optional[bool] = None
    overhead_reach_proxy: Optional[bool] = None
    training_days_specific: Optional[list[str]] = None
    exercise_blacklist: Optional[list[str]] = None
    protein_intake_check: Optional[str] = None
    current_max_bench: Optional[StrengthBenchmark] = None
    current_max_squat: Optional[StrengthBenchmark] = None
    current_max_deadlift: Optional[StrengthBenchmark] = None
    sport_phase: Optional[str] = None
    sport_weekly_hours: Optional[int] = Field(default=None, ge=0, le=40)


class ProfileResponse(BaseModel):
    id: str
    goal: str
    age: Optional[int]
    weight_kg: Optional[float]
    height_cm: Optional[float]
    sex: str
    experience: str
    days_per_week: Optional[int]
    session_minutes: Optional[int]
    equipment: Optional[list[str]]
    injuries: Optional[str]
    sleep_hours: Optional[float]
    stress_level: Optional[int]
    job_activity: Optional[str]
    diet_style: Optional[str]
    sport: Optional[str] = None
    competition_date: Optional[str] = None
    # Onboarding V2 fields
    training_age_years: Optional[int] = None
    training_recency: Optional[str] = None
    goal_sub_category: Optional[str] = None
    body_fat_est: Optional[str] = None
    goal_deadline: Optional[str] = None
    injury_ortho_history: Optional[str] = None
    current_pain_level: Optional[int] = None
    chair_stand_proxy: Optional[bool] = None
    overhead_reach_proxy: Optional[bool] = None
    training_days_specific: Optional[list[str]] = None
    exercise_blacklist: Optional[list[str]] = None
    protein_intake_check: Optional[str] = None
    current_max_bench: Optional[dict] = None
    current_max_squat: Optional[dict] = None
    current_max_deadlift: Optional[dict] = None
    sport_phase: Optional[str] = None
    sport_weekly_hours: Optional[int] = None


def _validate_optional_enum(value: Optional[str], valid_set: set, field_name: str) -> None:
    if value is not None and value not in valid_set:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}. Must be one of: {', '.join(sorted(valid_set))}",
        )


def _validate_weekdays(days: Optional[list[str]]) -> None:
    if days is not None:
        for d in days:
            if d not in VALID_WEEKDAYS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid training day '{d}'. Must be one of: {', '.join(sorted(VALID_WEEKDAYS))}",
                )


# --- Routes ---

@profile_router.post("", response_model=ProfileResponse)
@limiter.limit("3/minute")
def create_profile(body: ProfileCreate, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate required enum fields
    if body.goal not in VALID_GOALS:
        raise HTTPException(status_code=400, detail=f"Invalid goal. Must be one of: {', '.join(VALID_GOALS)}")
    if body.sex not in VALID_SEX:
        raise HTTPException(status_code=400, detail=f"Invalid sex. Must be one of: {', '.join(VALID_SEX)}")
    if body.experience not in VALID_EXPERIENCE:
        raise HTTPException(status_code=400, detail=f"Invalid experience. Must be one of: {', '.join(VALID_EXPERIENCE)}")
    if body.job_activity not in VALID_JOB_ACTIVITY:
        raise HTTPException(status_code=400, detail=f"Invalid job_activity. Must be one of: {', '.join(VALID_JOB_ACTIVITY)}")
    if body.diet_style not in VALID_DIET_STYLE:
        raise HTTPException(status_code=400, detail=f"Invalid diet_style. Must be one of: {', '.join(VALID_DIET_STYLE)}")

    # Validate optional enum fields (V2)
    _validate_optional_enum(body.training_recency, VALID_TRAINING_RECENCY, "training_recency")
    _validate_optional_enum(body.goal_sub_category, VALID_GOAL_SUB_CATEGORY, "goal_sub_category")
    _validate_optional_enum(body.body_fat_est, VALID_BODY_FAT_EST, "body_fat_est")
    _validate_optional_enum(body.protein_intake_check, VALID_PROTEIN_INTAKE, "protein_intake_check")
    _validate_optional_enum(body.sport_phase, VALID_SPORT_PHASE, "sport_phase")
    _validate_weekdays(body.training_days_specific)

    # Derive days_per_week from training_days_specific if provided
    days_per_week = body.days_per_week
    if body.training_days_specific:
        days_per_week = len(body.training_days_specific)

    # Backward compat: populate injuries from injury_ortho_history
    injuries = body.injuries
    if body.injury_ortho_history:
        injuries = body.injury_ortho_history

    # Parse goal_deadline
    goal_deadline_parsed = None
    if body.goal_deadline:
        goal_deadline_parsed = date.fromisoformat(body.goal_deadline)

    # Validate elite-specific fields
    if user.tier == "elite":
        if not body.sport:
            raise HTTPException(status_code=400, detail="Elite tier requires sport selection")
        user.sport = body.sport
        if body.competition_date:
            parsed_date = date.fromisoformat(body.competition_date)
            min_date = date.today() + timedelta(days=28)
            if parsed_date < min_date:
                raise HTTPException(status_code=400, detail="Competition date must be at least 4 weeks from today")
            user.competition_date = parsed_date
        else:
            user.competition_date = None
        # V2 elite fields on users table
        user.sport_phase = body.sport_phase
        user.sport_weekly_hours = body.sport_weekly_hours

    # Convert strength benchmarks to dicts for JSONB storage
    bench_dict = body.current_max_bench.model_dump() if body.current_max_bench else None
    squat_dict = body.current_max_squat.model_dump() if body.current_max_squat else None
    deadlift_dict = body.current_max_deadlift.model_dump() if body.current_max_deadlift else None

    # Upsert profile
    existing = db.query(Profile).filter(Profile.user_id == user.id).first()
    if existing:
        existing.goal = body.goal
        existing.age = body.age
        existing.weight_kg = body.weight_kg
        existing.height_cm = body.height_cm
        existing.sex = body.sex
        existing.experience = body.experience
        existing.days_per_week = days_per_week
        existing.session_minutes = body.session_minutes
        existing.equipment = body.equipment
        existing.injuries = injuries
        existing.sleep_hours = body.sleep_hours
        existing.stress_level = body.stress_level
        existing.job_activity = body.job_activity
        existing.diet_style = body.diet_style
        # V2 fields
        existing.training_age_years = body.training_age_years
        existing.training_recency = body.training_recency
        existing.goal_sub_category = body.goal_sub_category
        existing.body_fat_est = body.body_fat_est
        existing.goal_deadline = goal_deadline_parsed
        existing.injury_ortho_history = body.injury_ortho_history
        existing.current_pain_level = body.current_pain_level
        existing.chair_stand_proxy = body.chair_stand_proxy
        existing.overhead_reach_proxy = body.overhead_reach_proxy
        existing.training_days_specific = body.training_days_specific
        existing.exercise_blacklist = body.exercise_blacklist
        existing.protein_intake_check = body.protein_intake_check
        existing.current_max_bench = bench_dict
        existing.current_max_squat = squat_dict
        existing.current_max_deadlift = deadlift_dict
        profile = existing
    else:
        profile = Profile(
            user_id=user.id,
            goal=body.goal,
            age=body.age,
            weight_kg=body.weight_kg,
            height_cm=body.height_cm,
            sex=body.sex,
            experience=body.experience,
            days_per_week=days_per_week,
            session_minutes=body.session_minutes,
            equipment=body.equipment,
            injuries=injuries,
            sleep_hours=body.sleep_hours,
            stress_level=body.stress_level,
            job_activity=body.job_activity,
            diet_style=body.diet_style,
            # V2 fields
            training_age_years=body.training_age_years,
            training_recency=body.training_recency,
            goal_sub_category=body.goal_sub_category,
            body_fat_est=body.body_fat_est,
            goal_deadline=goal_deadline_parsed,
            injury_ortho_history=body.injury_ortho_history,
            current_pain_level=body.current_pain_level,
            chair_stand_proxy=body.chair_stand_proxy,
            overhead_reach_proxy=body.overhead_reach_proxy,
            training_days_specific=body.training_days_specific,
            exercise_blacklist=body.exercise_blacklist,
            protein_intake_check=body.protein_intake_check,
            current_max_bench=bench_dict,
            current_max_squat=squat_dict,
            current_max_deadlift=deadlift_dict,
        )
        db.add(profile)

    db.commit()
    db.refresh(profile)

    # Check if an active plan exists — warn user that profile changes won't auto-update it
    active_plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    plan_stale = active_plan is not None

    return {
        "id": str(profile.id),
        "goal": profile.goal,
        "age": profile.age,
        "weight_kg": profile.weight_kg,
        "height_cm": profile.height_cm,
        "sex": profile.sex,
        "experience": profile.experience,
        "days_per_week": profile.days_per_week,
        "session_minutes": profile.session_minutes,
        "equipment": profile.equipment,
        "injuries": profile.injuries,
        "sleep_hours": profile.sleep_hours,
        "stress_level": profile.stress_level,
        "job_activity": profile.job_activity,
        "diet_style": profile.diet_style,
        "sport": user.sport,
        "competition_date": str(user.competition_date) if user.competition_date else None,
        # V2 fields
        "training_age_years": profile.training_age_years,
        "training_recency": profile.training_recency,
        "goal_sub_category": profile.goal_sub_category,
        "body_fat_est": profile.body_fat_est,
        "goal_deadline": str(profile.goal_deadline) if profile.goal_deadline else None,
        "injury_ortho_history": profile.injury_ortho_history,
        "current_pain_level": profile.current_pain_level,
        "chair_stand_proxy": profile.chair_stand_proxy,
        "overhead_reach_proxy": profile.overhead_reach_proxy,
        "training_days_specific": profile.training_days_specific,
        "exercise_blacklist": profile.exercise_blacklist,
        "protein_intake_check": profile.protein_intake_check,
        "current_max_bench": profile.current_max_bench,
        "current_max_squat": profile.current_max_squat,
        "current_max_deadlift": profile.current_max_deadlift,
        "sport_phase": user.sport_phase if user.tier == "elite" else None,
        "sport_weekly_hours": user.sport_weekly_hours if user.tier == "elite" else None,
        "plan_stale": plan_stale,
    }


@profile_router.get("", response_model=Optional[ProfileResponse])
def get_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        return None

    return ProfileResponse(
        id=str(profile.id),
        goal=profile.goal,
        age=profile.age,
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        sex=profile.sex,
        experience=profile.experience,
        days_per_week=profile.days_per_week,
        session_minutes=profile.session_minutes,
        equipment=profile.equipment,
        injuries=profile.injuries,
        sleep_hours=profile.sleep_hours,
        stress_level=profile.stress_level,
        job_activity=profile.job_activity,
        diet_style=profile.diet_style,
        sport=user.sport,
        competition_date=str(user.competition_date) if user.competition_date else None,
        # V2 fields
        training_age_years=profile.training_age_years,
        training_recency=profile.training_recency,
        goal_sub_category=profile.goal_sub_category,
        body_fat_est=profile.body_fat_est,
        goal_deadline=str(profile.goal_deadline) if profile.goal_deadline else None,
        injury_ortho_history=profile.injury_ortho_history,
        current_pain_level=profile.current_pain_level,
        chair_stand_proxy=profile.chair_stand_proxy,
        overhead_reach_proxy=profile.overhead_reach_proxy,
        training_days_specific=profile.training_days_specific,
        exercise_blacklist=profile.exercise_blacklist,
        protein_intake_check=profile.protein_intake_check,
        current_max_bench=profile.current_max_bench,
        current_max_squat=profile.current_max_squat,
        current_max_deadlift=profile.current_max_deadlift,
        sport_phase=user.sport_phase if user.tier == "elite" else None,
        sport_weekly_hours=user.sport_weekly_hours if user.tier == "elite" else None,
    )
