from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models.checkin import WeeklyCheckin
from models.plan import Plan
from models.session import SessionLog
from models.user import User
from routes.auth import get_current_user
from tiers import check_feature

logger = logging.getLogger(__name__)

checkin_router = APIRouter()


# --- Request schema ---

class CheckinCreate(BaseModel):
    recovery_score: int = Field(ge=1, le=10)
    mood_score: int = Field(ge=1, le=10)
    sleep_avg: float = Field(ge=0, le=24)
    weight_kg: Optional[float] = Field(default=None, ge=20, le=500)
    notes: Optional[str] = Field(default=None, max_length=2000)


# --- Routes ---

@checkin_router.post("/{plan_id}/{week}")
def create_checkin(
    plan_id: str,
    week: int,
    body: CheckinCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Cannot check in on an inactive plan")

    # Require at least 1 session this week
    session_count = db.query(SessionLog).filter(
        SessionLog.plan_id == plan.id,
        SessionLog.week_number == week,
    ).count()
    if session_count == 0:
        raise HTTPException(status_code=400, detail="Log at least one session before checking in")

    # Prevent duplicate check-in
    existing = db.query(WeeklyCheckin).filter(
        WeeklyCheckin.plan_id == plan.id,
        WeeklyCheckin.week_number == week,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Check-in already submitted for this week")

    checkin = WeeklyCheckin(
        plan_id=plan.id,
        user_id=user.id,
        week_number=week,
        recovery_score=body.recovery_score,
        mood_score=body.mood_score,
        sleep_avg=body.sleep_avg,
        weight_kg=body.weight_kg,
        notes=body.notes,
    )
    db.add(checkin)
    db.commit()
    db.refresh(checkin)

    # Try to advance the week
    maybe_advance_week(plan, user, db)

    return {
        "id": str(checkin.id),
        "plan_id": str(checkin.plan_id),
        "week_number": checkin.week_number,
        "created_at": checkin.created_at.isoformat() if checkin.created_at else None,
    }


@checkin_router.get("/{plan_id}")
def list_checkins(
    plan_id: str,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    checkins = (
        db.query(WeeklyCheckin)
        .filter(WeeklyCheckin.plan_id == plan.id)
        .order_by(WeeklyCheckin.week_number)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(c.id),
            "plan_id": str(c.plan_id),
            "week_number": c.week_number,
            "recovery_score": c.recovery_score,
            "mood_score": c.mood_score,
            "sleep_avg": c.sleep_avg,
            "weight_kg": c.weight_kg,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in checkins
    ]


# --- Week advancement ---

def maybe_advance_week(plan: Plan, user: User, db: Session) -> None:
    """Advance current_week when all sessions + check-in are done for the week."""
    # Lock the plan row to prevent race conditions from concurrent requests
    plan = db.query(Plan).filter(Plan.id == plan.id).with_for_update().first()
    if not plan:
        return
    week = plan.current_week

    # Count planned days from plan_data
    plan_data = plan.plan_data or {}
    weeks_data = plan_data.get("weeks", [])
    if not weeks_data:
        nested = plan_data.get("plan", {})
        if isinstance(nested, dict):
            weeks_data = nested.get("weeks", [])
        elif isinstance(plan_data, list):
            weeks_data = plan_data

    current_week_data = None
    for w in weeks_data:
        if isinstance(w, dict) and w.get("week_number") == week:
            current_week_data = w
            break
    if not current_week_data and week - 1 < len(weeks_data):
        current_week_data = weeks_data[week - 1]

    if not current_week_data or not isinstance(current_week_data, dict):
        return

    planned_days = len(current_week_data.get("days", []))
    if planned_days == 0:
        return

    # Count completed sessions for this week
    completed = db.query(SessionLog).filter(
        SessionLog.plan_id == plan.id,
        SessionLog.week_number == week,
    ).count()

    # Check-in already exists (we just created it in the calling function)
    if completed >= planned_days and plan.current_week < plan.mesocycle_weeks:
        plan.current_week += 1
        db.commit()
        logger.info("Plan %s advanced to week %d", plan.id, plan.current_week)

        # Tier-gated adaptation hook (Phase 6)
        if check_feature(user, "adaptation"):
            from tools.adapt import adapt_plan
            try:
                adapt_plan(plan, user, db)
            except Exception:
                logger.exception("Adaptation failed for plan %s", plan.id)

        # Milestone detection for collective learning (Phase 7)
        if check_feature(user, "collective") and plan.current_week % 3 == 0:
            plan.milestone_pending = True
            db.commit()
            logger.info("Milestone pending for plan %s at week %d", plan.id, plan.current_week)
