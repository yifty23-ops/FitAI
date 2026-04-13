from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.profile import Profile
from models.user import User
from routes.auth import get_current_user
from tools.research import research_for_profile

research_router = APIRouter()


@research_router.post("/test")
def test_research(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile required. Complete onboarding first.")

    result = research_for_profile(user, profile, db)
    return {
        "tier": user.tier,
        "sport": user.sport,
        "research": result,
    }
