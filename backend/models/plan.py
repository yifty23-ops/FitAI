import uuid

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from database import Base


class Plan(Base):
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    tier_at_creation = Column(String, nullable=False)
    profile_snapshot = Column(JSONB, nullable=False)
    mesocycle_weeks = Column(Integer, default=8)
    current_week = Column(Integer, default=1)
    phase = Column(String, default="accumulation")
    plan_data = Column(JSONB, nullable=False)
    nutrition = Column(JSONB, nullable=False)
    persona_used = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    milestone_pending = Column(Boolean, default=False)
