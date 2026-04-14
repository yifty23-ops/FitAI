import uuid

from sqlalchemy import Column, String, Integer, Date, DateTime, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    tier = Column(String, nullable=False, default="free")
    sport = Column(String, nullable=True)
    competition_date = Column(Date, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    # Onboarding V2: elite sport-specific fields
    sport_phase = Column(String, nullable=True)
    sport_weekly_hours = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
