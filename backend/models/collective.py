import uuid

from sqlalchemy import Column, String, Float, DateTime, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from database import Base


class CollectiveResult(Base):
    __tablename__ = "collective_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    profile_hash = Column(String, nullable=False)
    sport = Column(String, nullable=True)
    plan_config = Column(JSONB, nullable=False)
    outcome = Column(JSONB, nullable=False)
    success_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
