from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from database import get_db
from models.chat import ChatMessage
from models.plan import Plan
from models.user import User
from routes.auth import get_current_user
from services.claude_client import ClaudeClient
from tiers import check_feature

logger = logging.getLogger(__name__)

chat_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class ChatRequest(BaseModel):
    message: str = Field(max_length=5000)
    plan_id: str


class ChatResponse(BaseModel):
    response: str
    plan_modified: bool
    modifications: Optional[dict] = None


@chat_router.post("/")
@limiter.limit("10/minute")
def send_chat(
    request: Request,
    body: ChatRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Elite-only gate
    if not check_feature(user, "coach_chat"):
        raise HTTPException(
            status_code=403,
            detail="Coach chat is an Elite-only feature. Upgrade to Elite for direct access to your AI coach.",
        )

    # Load plan
    plan = db.query(Plan).filter(
        Plan.id == body.plan_id,
        Plan.user_id == user.id,
    ).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if not plan.is_active:
        raise HTTPException(status_code=400, detail="Can only chat about an active plan")

    # Build context and get history
    from tools.chat import build_coach_context, get_conversation_history, apply_chat_modifications

    context = build_coach_context(user, plan, db)
    history = get_conversation_history(plan.id, db, limit=10)

    # Call Claude
    client = ClaudeClient(settings.anthropic_api_key)
    result = client.chat(
        context=context,
        message=body.message,
        conversation_history=history,
        sport=user.sport,
    )

    # Extract response
    coach_message = result.get("message", "")
    modifications = result.get("modifications")
    plan_modified = False

    # Apply modifications if present
    if modifications and isinstance(modifications, dict) and modifications.get("type"):
        try:
            apply_chat_modifications(plan, modifications, db)
            plan_modified = True
            logger.info("Chat modification applied for plan %s: %s", plan.id, modifications.get("type"))
        except Exception:
            logger.exception("Failed to apply chat modification for plan %s", plan.id)
            coach_message += "\n\n(Note: I tried to update your plan but encountered an issue. The change wasn't applied.)"
            modifications = None

    # Save both messages to DB
    user_msg = ChatMessage(
        user_id=user.id,
        plan_id=plan.id,
        role="user",
        content=body.message,
    )
    assistant_msg = ChatMessage(
        user_id=user.id,
        plan_id=plan.id,
        role="assistant",
        content=coach_message,
        modifications=modifications,
    )
    db.add(user_msg)
    db.add(assistant_msg)
    db.commit()

    return {
        "response": coach_message,
        "plan_modified": plan_modified,
        "modifications": modifications,
    }


@chat_router.get("/{plan_id}")
def get_chat_history(
    plan_id: str,
    skip: int = 0,
    limit: int = 50,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Verify plan ownership
    plan = db.query(Plan).filter(Plan.id == plan_id, Plan.user_id == user.id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.plan_id == plan.id)
        .order_by(ChatMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "modifications": m.modifications,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
