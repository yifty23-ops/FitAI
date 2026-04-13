from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from database import get_db
from models.collective import CollectiveResult
from models.plan import Plan
from models.profile import Profile
from models.user import User
from routes.auth import get_current_user
from tiers import check_feature

collective_router = APIRouter()


class DonateBody(BaseModel):
    success_score: int  # 1-5
    notes: Optional[str] = None


@collective_router.post("/{plan_id}/donate")
def donate(
    plan_id: str,
    body: DonateBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not check_feature(user, "collective"):
        raise HTTPException(status_code=403, detail="Collective learning not available on your tier. Upgrade to Pro.")

    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Can only donate from an active plan")
    if not plan.milestone_pending:
        raise HTTPException(status_code=400, detail="No milestone pending")

    if body.success_score < 1 or body.success_score > 5:
        raise HTTPException(status_code=400, detail="success_score must be between 1 and 5")

    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile required")

    from tools.collective import donate_result

    result = donate_result(plan, user, profile, body.success_score, body.notes, db)
    return result


@collective_router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Public endpoint — no auth required. Returns aggregate stats for social proof."""
    total_outcomes = db.query(sqlfunc.count(CollectiveResult.id)).scalar() or 0
    sports_count = (
        db.query(sqlfunc.count(sqlfunc.distinct(CollectiveResult.sport)))
        .filter(CollectiveResult.sport.isnot(None))
        .scalar()
        or 0
    )
    return {"total_outcomes": total_outcomes, "sports_count": sports_count}
