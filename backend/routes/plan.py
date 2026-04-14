import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models.adaptation import AdaptationLog
from models.plan import Plan
from models.profile import Profile
from models.user import User
from routes.auth import get_current_user
from tiers import check_feature, check_plan_limit
from tools.plan_generator import generate_plan_for_profile

logger = logging.getLogger(__name__)

plan_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@plan_router.post("/generate")
@limiter.limit("2/minute")
def generate_plan(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check profile exists
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if not profile:
        raise HTTPException(status_code=400, detail="Profile required. Complete onboarding first.")

    # Check tier plan limit
    if not check_plan_limit(user, db):
        raise HTTPException(
            status_code=429,
            detail="Plan generation limit reached for this month. Upgrade your tier for unlimited plans.",
        )

    try:
        result = generate_plan_for_profile(user, profile, db)
    except ValueError as e:
        logger.error("Plan generation validation error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("Plan generation failed: %s", e)
        raise HTTPException(status_code=500, detail="Plan generation failed. Please try again.")

    return result


@plan_router.get("/")
def list_plans(skip: int = 0, limit: int = 20, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plans = (
        db.query(Plan)
        .filter(Plan.user_id == user.id)
        .order_by(Plan.is_active.desc(), Plan.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(p.id),
            "tier_at_creation": p.tier_at_creation,
            "mesocycle_weeks": p.mesocycle_weeks,
            "current_week": p.current_week,
            "phase": p.phase,
            "persona_used": p.persona_used,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "is_active": p.is_active,
        }
        for p in plans
    ]


@plan_router.get("/active")
def get_active_plan(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.user_id == user.id, Plan.is_active == True).first()
    if not plan:
        raise HTTPException(status_code=404, detail="No active plan")

    return {
        "id": str(plan.id),
        "tier_at_creation": plan.tier_at_creation,
        "profile_snapshot": plan.profile_snapshot,
        "mesocycle_weeks": plan.mesocycle_weeks,
        "current_week": plan.current_week,
        "phase": plan.phase,
        "plan_data": plan.plan_data,
        "nutrition": plan.nutrition,
        "persona_used": plan.persona_used,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "is_active": plan.is_active,
        "milestone_pending": plan.milestone_pending or False,
    }


@plan_router.get("/{plan_id}")
def get_plan(plan_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    return {
        "id": str(plan.id),
        "tier_at_creation": plan.tier_at_creation,
        "profile_snapshot": plan.profile_snapshot,
        "mesocycle_weeks": plan.mesocycle_weeks,
        "current_week": plan.current_week,
        "phase": plan.phase,
        "plan_data": plan.plan_data,
        "nutrition": plan.nutrition,
        "persona_used": plan.persona_used,
        "created_at": plan.created_at.isoformat() if plan.created_at else None,
        "is_active": plan.is_active,
    }


@plan_router.post("/{plan_id}/confirm")
def confirm_plan(plan_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.is_active:
        raise HTTPException(status_code=400, detail="Plan is already active")

    # Deactivate all other active plans
    db.query(Plan).filter(
        Plan.user_id == user.id,
        Plan.is_active == True,
        Plan.id != plan.id,
    ).update({"is_active": False})

    plan.is_active = True
    db.commit()

    return {"id": str(plan.id), "is_active": True}


@plan_router.delete("/{plan_id}")
def delete_plan(plan_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if plan.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete an active plan")

    db.delete(plan)
    db.commit()

    return {"detail": "Plan deleted"}


@plan_router.post("/{plan_id}/adapt")
def adapt_existing_plan(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Can only adapt an active plan")
    if not check_feature(user, "adaptation"):
        raise HTTPException(status_code=403, detail="Adaptation not available on your tier. Upgrade to Pro.")
    if plan.current_week <= 1:
        raise HTTPException(status_code=400, detail="No completed weeks to analyze yet")

    # Guard against tier downgrade: use current tier (may be lower than plan's creation tier)
    # The adapt_plan function will read user.tier to determine adaptation depth
    from tools.adapt import adapt_plan

    try:
        result = adapt_plan(plan, user, db)
    except Exception as e:
        logger.error("Manual adaptation failed: %s", e)
        raise HTTPException(status_code=500, detail="Adaptation failed. Please try again.")

    return result


@plan_router.get("/{plan_id}/adaptations")
def get_adaptations(
    plan_id: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    logs = (
        db.query(AdaptationLog)
        .filter(AdaptationLog.plan_id == plan.id)
        .order_by(AdaptationLog.week_number.desc())
        .all()
    )
    return [
        {
            "id": str(log.id),
            "week_number": log.week_number,
            "assessment": log.assessment,
            "adjustments": log.adjustments,
            "flags": log.flags,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
