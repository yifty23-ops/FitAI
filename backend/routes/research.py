from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models.profile import Profile
from models.user import User
from routes.auth import get_current_user
from tiers import check_feature
from tools.research import research_for_profile

research_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@research_router.post("/test")
@limiter.limit("2/minute")
def test_research(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Test endpoint — respects tier gating. Free tier gets knowledge-only research."""
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile required. Complete onboarding first.")

    result = research_for_profile(user, profile, db)
    return {
        "tier": user.tier,
        "sport": user.sport,
        "research": result,
    }
