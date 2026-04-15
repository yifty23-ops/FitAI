from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

import logging

from config import settings
from database import get_db
from models.plan import Plan
from models.profile import Profile
from models.session import SessionLog
from models.user import User
from routes.auth import get_current_user
from services.claude_client import ClaudeClient

logger = logging.getLogger(__name__)

session_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


# --- Request schemas ---

class PreReadiness(BaseModel):
    sleep: int = Field(ge=1, le=10)
    energy: int = Field(ge=1, le=10)
    soreness: int = Field(ge=1, le=10)


class LoggedSet(BaseModel):
    reps: int = Field(ge=0, le=999)
    weight_kg: float = Field(ge=0, le=1000)
    rpe: Optional[float] = Field(default=None, ge=1, le=10)


class LoggedExercise(BaseModel):
    name: str = Field(max_length=200)
    sets: List[LoggedSet]


class SessionCreate(BaseModel):
    pre_readiness: Optional[PreReadiness] = None
    logged_exercises: List[LoggedExercise]
    notes: Optional[str] = Field(default=None, max_length=2000)


# --- Routes ---

@session_router.post("/{plan_id}/{week}/{day}")
@limiter.limit("10/minute")
def log_session(
    plan_id: str,
    week: int,
    day: int,
    body: SessionCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Cannot log sessions on an inactive plan")

    # Validate week and day bounds
    if week < 1 or week > plan.mesocycle_weeks:
        raise HTTPException(status_code=400, detail=f"Week {week} is out of range (1-{plan.mesocycle_weeks})")
    if day < 1:
        raise HTTPException(status_code=400, detail="Day must be at least 1")

    # Reject if every set across all exercises is empty (reps=0 and weight=0)
    has_data = any(
        s.reps > 0 or s.weight_kg > 0
        for ex in body.logged_exercises
        for s in ex.sets
    )
    if not has_data:
        raise HTTPException(status_code=400, detail="Session cannot be empty. Log at least one set with reps or weight.")

    session_log = SessionLog(
        plan_id=plan.id,
        user_id=user.id,
        week_number=week,
        day_number=day,
        pre_readiness=body.pre_readiness.model_dump() if body.pre_readiness else None,
        logged_exercises=[e.model_dump() for e in body.logged_exercises],
        notes=body.notes,
    )
    db.add(session_log)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Session already logged for this day")
    db.refresh(session_log)

    return {
        "id": str(session_log.id),
        "plan_id": str(session_log.plan_id),
        "week_number": session_log.week_number,
        "day_number": session_log.day_number,
        "completed_at": session_log.completed_at.isoformat() if session_log.completed_at else None,
    }


@session_router.get("/{plan_id}")
def list_sessions(
    plan_id: str,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    limit = min(limit, 100)
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    sessions = (
        db.query(SessionLog)
        .filter(SessionLog.plan_id == plan.id)
        .order_by(SessionLog.week_number, SessionLog.day_number)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(s.id),
            "week_number": s.week_number,
            "day_number": s.day_number,
            "pre_readiness": s.pre_readiness,
            "logged_exercises": s.logged_exercises,
            "notes": s.notes,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in sessions
    ]


@session_router.get("/{plan_id}/{week}")
def list_week_sessions(
    plan_id: str,
    week: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    sessions = (
        db.query(SessionLog)
        .filter(SessionLog.plan_id == plan.id, SessionLog.week_number == week)
        .order_by(SessionLog.day_number)
        .all()
    )
    return [
        {
            "id": str(s.id),
            "week_number": s.week_number,
            "day_number": s.day_number,
            "pre_readiness": s.pre_readiness,
            "logged_exercises": s.logged_exercises,
            "notes": s.notes,
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        }
        for s in sessions
    ]


@session_router.put("/{plan_id}/{week}/{day}")
@limiter.limit("10/minute")
def edit_session(
    plan_id: str,
    week: int,
    day: int,
    body: SessionCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    session_log = db.query(SessionLog).filter(
        SessionLog.plan_id == plan.id,
        SessionLog.week_number == week,
        SessionLog.day_number == day,
    ).first()
    if not session_log:
        raise HTTPException(status_code=404, detail="No session found to edit")

    # Only allow edits within 24 hours of completion
    if session_log.completed_at:
        cutoff = session_log.completed_at.replace(tzinfo=timezone.utc) + timedelta(hours=24)
        if datetime.now(timezone.utc) > cutoff:
            raise HTTPException(status_code=400, detail="Edit window has closed (24 hours after submission)")

    # Validate not empty
    has_data = any(
        s.reps > 0 or s.weight_kg > 0
        for ex in body.logged_exercises
        for s in ex.sets
    )
    if not has_data:
        raise HTTPException(status_code=400, detail="Session cannot be empty.")

    session_log.pre_readiness = body.pre_readiness.model_dump() if body.pre_readiness else None
    session_log.logged_exercises = [e.model_dump() for e in body.logged_exercises]
    session_log.notes = body.notes
    db.commit()
    db.refresh(session_log)

    return {
        "id": str(session_log.id),
        "plan_id": str(session_log.plan_id),
        "week_number": session_log.week_number,
        "day_number": session_log.day_number,
        "completed_at": session_log.completed_at.isoformat() if session_log.completed_at else None,
    }


# --- Time adjustment ---

class SessionAdjustRequest(BaseModel):
    available_minutes: int = Field(ge=10, le=300)


def _extract_day_exercises(plan_data: dict, week: int, day: int) -> list | None:
    """Extract exercises for a specific day from plan_data."""
    # Normalize weeks from various JSON shapes
    weeks = []
    if isinstance(plan_data, dict):
        weeks = plan_data.get("weeks", [])
        if not weeks and "plan" in plan_data:
            inner = plan_data["plan"]
            if isinstance(inner, dict):
                weeks = inner.get("weeks", [])
            elif isinstance(inner, list):
                weeks = inner
    elif isinstance(plan_data, list):
        weeks = plan_data

    week_data = next((w for w in weeks if w.get("week_number") == week), None)
    if not week_data and 0 <= week - 1 < len(weeks):
        week_data = weeks[week - 1]
    if not week_data:
        return None
    day_data = next(
        (d for d in week_data.get("days", []) if d.get("day_number") == day),
        None,
    )
    if not day_data:
        return None
    return day_data.get("exercises", [])


@session_router.post("/{plan_id}/{week}/{day}/adjust")
@limiter.limit("5/minute")
def adjust_session_time(
    plan_id: str,
    week: int,
    day: int,
    body: SessionAdjustRequest,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Extract planned exercises for this day
    planned_exercises = _extract_day_exercises(plan.plan_data, week, day)
    if not planned_exercises:
        raise HTTPException(status_code=404, detail="Day not found in plan")

    # Get profile for session_minutes context
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    planned_minutes = profile.session_minutes if profile else 60

    # Build a compact profile summary for context
    profile_summary = {}
    if profile:
        profile_summary = {
            "goal": profile.goal,
            "experience": profile.experience,
            "session_minutes": profile.session_minutes,
        }

    client = ClaudeClient(settings.anthropic_api_key)
    try:
        result = client.adjust_session(
            planned_exercises=planned_exercises,
            planned_minutes=planned_minutes,
            available_minutes=body.available_minutes,
            profile=profile_summary,
        )
    except Exception as e:
        logger.error("Session time adjustment failed: %s", e)
        raise HTTPException(
            status_code=500, detail="Failed to adjust session. Please try again."
        )

    return result
