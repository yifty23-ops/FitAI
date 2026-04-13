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
VALID_JOB_ACTIVITY = {"sedentary", "light", "active"}
VALID_DIET_STYLE = {"omnivore", "vegetarian", "vegan", "keto", "halal", "other"}


# --- Request/Response schemas ---

class ProfileCreate(BaseModel):
    goal: str  # fat_loss | muscle | performance | wellness
    age: int = Field(ge=13, le=120)
    weight_kg: float = Field(ge=20, le=500)
    height_cm: float = Field(ge=50, le=300)
    sex: str  # male | female
    experience: str  # beginner | intermediate | advanced
    days_per_week: int = Field(ge=1, le=7)
    session_minutes: int = Field(ge=10, le=300)
    equipment: list[str]
    injuries: Optional[str] = Field(default=None, max_length=1000)
    sleep_hours: float = Field(ge=0, le=24)
    stress_level: int = Field(ge=1, le=5)
    job_activity: str  # sedentary | light | active
    diet_style: str  # omnivore | vegetarian | vegan | keto | halal | other
    sport: Optional[str] = Field(default=None, max_length=50)
    competition_date: Optional[str] = None  # ISO date string


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


# --- Routes ---

@profile_router.post("", response_model=ProfileResponse)
@limiter.limit("3/minute")
def create_profile(body: ProfileCreate, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Validate enum fields
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

    # Validate elite-specific fields
    if user.tier == "elite":
        if not body.sport:
            raise HTTPException(status_code=400, detail="Elite tier requires sport selection")
        # Write sport + competition_date to users table (account-level)
        user.sport = body.sport
        if body.competition_date:
            parsed_date = date.fromisoformat(body.competition_date)
            min_date = date.today() + timedelta(days=28)
            if parsed_date < min_date:
                raise HTTPException(status_code=400, detail="Competition date must be at least 4 weeks from today")
            user.competition_date = parsed_date
        else:
            user.competition_date = None

    # Upsert profile: update if exists, create if not
    existing = db.query(Profile).filter(Profile.user_id == user.id).first()
    if existing:
        existing.goal = body.goal
        existing.age = body.age
        existing.weight_kg = body.weight_kg
        existing.height_cm = body.height_cm
        existing.sex = body.sex
        existing.experience = body.experience
        existing.days_per_week = body.days_per_week
        existing.session_minutes = body.session_minutes
        existing.equipment = body.equipment
        existing.injuries = body.injuries
        existing.sleep_hours = body.sleep_hours
        existing.stress_level = body.stress_level
        existing.job_activity = body.job_activity
        existing.diet_style = body.diet_style
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
            days_per_week=body.days_per_week,
            session_minutes=body.session_minutes,
            equipment=body.equipment,
            injuries=body.injuries,
            sleep_hours=body.sleep_hours,
            stress_level=body.stress_level,
            job_activity=body.job_activity,
            diet_style=body.diet_style,
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
    )
