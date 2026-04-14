import uuid

from sqlalchemy import Column, String, Integer, Float, Boolean, Date, DateTime, ForeignKey, ARRAY, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
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
    # Onboarding V2 fields
    training_age_years = Column(Integer, nullable=True)
    training_recency = Column(String, nullable=True)
    goal_sub_category = Column(String, nullable=True)
    body_fat_est = Column(String, nullable=True)
    goal_deadline = Column(Date, nullable=True)
    injury_ortho_history = Column(String, nullable=True)
    current_pain_level = Column(Integer, nullable=True)
    chair_stand_proxy = Column(Boolean, nullable=True)
    overhead_reach_proxy = Column(Boolean, nullable=True)
    training_days_specific = Column(ARRAY(String), nullable=True)
    exercise_blacklist = Column(ARRAY(String), nullable=True)
    protein_intake_check = Column(String, nullable=True)
    current_max_bench = Column(JSONB, nullable=True)
    current_max_squat = Column(JSONB, nullable=True)
    current_max_deadlift = Column(JSONB, nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
