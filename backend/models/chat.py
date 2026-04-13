from __future__ import annotations

import uuid

from sqlalchemy import Column, String, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from database import Base


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    role = Column(String, nullable=False)       # 'user' | 'assistant'
    content = Column(String, nullable=False)
    modifications = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
