import uuid

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class WeeklyCheckin(Base):
    __tablename__ = "weekly_checkins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    week_number = Column(Integer, nullable=False)
    recovery_score = Column(Integer, nullable=True)
    mood_score = Column(Integer, nullable=True)
    sleep_avg = Column(Float, nullable=True)
    weight_kg = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
