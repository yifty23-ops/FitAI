import uuid

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, ARRAY, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class Profile(Base):
    __tablename__ = "profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    goal = Column(String, nullable=False)
    age = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    sex = Column(String, nullable=False)
    experience = Column(String, nullable=False)
    days_per_week = Column(Integer, nullable=True)
    session_minutes = Column(Integer, nullable=True)
    equipment = Column(ARRAY(String), nullable=True)
    injuries = Column(String, nullable=True)
    sleep_hours = Column(Float, nullable=True)
    stress_level = Column(Integer, nullable=True)
    job_activity = Column(String, nullable=True)
    diet_style = Column(String, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
