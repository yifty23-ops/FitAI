import uuid

from sqlalchemy import Column, String, DateTime, ARRAY, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func

from database import Base


class ResearchCache(Base):
    __tablename__ = "research_cache"
    __table_args__ = (
        UniqueConstraint("profile_hash", "tier", name="uq_research_cache_profile_tier"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    profile_hash = Column(String, nullable=False)
    tier = Column(String, nullable=False)
    protocols = Column(JSONB, nullable=False)
    contraindications = Column(JSONB, nullable=False)
    sources = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
