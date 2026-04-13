from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.plan import Plan
from models.profile import Profile
from models.user import User
from routes.auth import get_current_user
from tiers import SPORT_DEMANDS

profile_router = APIRouter()


# --- Request/Response schemas ---

class ProfileCreate(BaseModel):
    goal: str  # fat_loss | muscle | performance | wellness
    age: int
    weight_kg: float
    height_cm: float
    sex: str  # male | female
    experience: str  # beginner | intermediate | advanced
    days_per_week: int
    session_minutes: int
    equipment: list[str]
    injuries: Optional[str] = None
    sleep_hours: float
    stress_level: int  # 1-5
    job_activity: str  # sedentary | light | active
    diet_style: str  # omnivore | vegetarian | vegan | keto | halal | other
    sport: Optional[str] = None
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
def create_profile(body: ProfileCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
