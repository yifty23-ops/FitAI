import hashlib
import json
import logging

from sqlalchemy.orm import Session

from config import settings
from models.profile import Profile
from models.research_cache import ResearchCache
from models.user import User
from services.claude_client import ClaudeClient

logger = logging.getLogger(__name__)


def compute_profile_hash(profile: Profile, tier: str) -> str:
    # Include age decade and weight bucket for more specific cache matching
    age_bucket = ((profile.age or 30) // 10) * 10  # 20s, 30s, 40s, etc.
    weight_bucket = ((int(profile.weight_kg or 70)) // 10) * 10  # 60kg, 70kg, 80kg, etc.
    key_fields = {
        "goal": profile.goal,
        "sex": profile.sex,
        "experience": profile.experience,
        "equipment": sorted(profile.equipment or []),
        "injuries": profile.injuries or "",
        "days_per_week": profile.days_per_week,
        "age_bucket": age_bucket,
        "weight_bucket": weight_bucket,
    }
    raw = json.dumps(key_fields, sort_keys=True) + f":{tier}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def profile_to_research_dict(profile: Profile, user: User) -> dict:
    """Convert SQLAlchemy Profile + User to dict for prompt formatting."""
    equipment_str = ", ".join(profile.equipment or ["bodyweight"])
    return {
        "goal": profile.goal,
        "sex": profile.sex,
        "age": profile.age or "unknown",
        "weight_kg": profile.weight_kg or "unknown",
        "height_cm": profile.height_cm or "unknown",
        "experience": profile.experience,
        "experience_detail": f"{profile.experience} level trainee",
        "days_per_week": profile.days_per_week or 3,
        "session_minutes": profile.session_minutes or 60,
        "equipment": equipment_str,
        "injuries": profile.injuries or "none reported",
        "competition_date": str(user.competition_date) if user.competition_date else "none",
    }


def _attach_collective(result: dict, profile_hash: str, profile: Profile, user: User, db: Session) -> dict:
    """Append collective insights to research result if available (not cached — always fresh)."""
    from tools.collective import query_collective

    collective = query_collective(profile_hash, profile, user, db)
    if collective and not collective.startswith("Collective data not available") and not collective.startswith("No collective data"):
        result["collective_insights"] = collective
        logger.info("Collective data injected for user %s", user.id)
    return result


def research_for_profile(user: User, profile: Profile, db: Session) -> dict:
    tier = user.tier
    sport = user.sport  # None for free/pro

    # 1. Compute tier-aware hash
    profile_hash = compute_profile_hash(profile, tier)

    # 2. Check cache (keyed by hash + tier)
    cached = db.query(ResearchCache).filter_by(
        profile_hash=profile_hash, tier=tier
    ).first()
    if cached:
        result = {
            "protocols": cached.protocols,
            "contraindications": cached.contraindications,
            "sources": cached.sources or [],
        }
        # Collective data is NOT cached — always query fresh
        return _attach_collective(result, profile_hash, profile, user, db)

    # 3. Cache miss — call Claude
    client = ClaudeClient(settings.anthropic_api_key)
    result = client.research(
        profile=profile_to_research_dict(profile, user),
        tier=tier,
        sport=sport,
    )

    # 4. Validate required keys
    if "protocols" not in result or "contraindications" not in result:
        raise ValueError("Research result missing required keys: protocols, contraindications")

    # 5. Cache with tier tag (collective data excluded from cache)
    entry = ResearchCache(
        profile_hash=profile_hash,
        tier=tier,
        protocols=result["protocols"],
        contraindications=result["contraindications"],
        sources=result.get("sources", []),
    )
    db.add(entry)
    db.commit()

    # 6. Attach collective data (fresh, not cached)
    return _attach_collective(result, profile_hash, profile, user, db)
