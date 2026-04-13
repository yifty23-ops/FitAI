from __future__ import annotations

import uuid

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from database import Base


class AdaptationLog(Base):
    __tablename__ = "adaptation_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    week_number = Column(Integer, nullable=False)
    assessment = Column(String, nullable=True)
    adjustments = Column(JSONB, nullable=False)
    flags = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
