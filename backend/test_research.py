"""
Test each tier's research quality.
Run: cd backend && python3 test_research.py

Requires:
- .env with valid DATABASE_URL and ANTHROPIC_API_KEY
- At least one user per tier in the DB with a profile
- Or use the signup/profile API first

This script creates test users + profiles directly, runs research for each tier,
and compares output quality.
"""
from __future__ import annotations

import json
import time
import uuid

from config import settings
from database import SessionLocal
from models.profile import Profile
from models.user import User
from tools.research import research_for_profile

db = SessionLocal()


def get_or_create_test_user(tier: str, sport: str | None = None) -> User:
    email = f"test_{tier}@fitai.test"
    user = db.query(User).filter(User.email == email).first()
    if user:
        user.tier = tier
        user.sport = sport
        db.commit()
        return user

    user = User(
        id=uuid.uuid4(),
        email=email,
        password_hash="$2b$12$test_hash_not_real",
        tier=tier,
        sport=sport,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_test_profile(user: User) -> Profile:
    profile = db.query(Profile).filter(Profile.user_id == user.id).first()
    if profile:
        return profile

    profile = Profile(
        id=uuid.uuid4(),
        user_id=user.id,
        goal="muscle",
        age=28,
        weight_kg=80.0,
        height_cm=178.0,
        sex="male",
        experience="intermediate",
        days_per_week=4,
        session_minutes=60,
        equipment=["barbell", "dumbbells", "pull_up_bar"],
        injuries=None,
        sleep_hours=7.5,
        stress_level=3,
        job_activity="sedentary",
        diet_style="omnivore",
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


def run_test(label: str, user: User, profile: Profile) -> dict:
    print(f"\n{'='*60}")
    print(f"=== {label} ===")
    print(f"{'='*60}")
    t = time.time()
    result = research_for_profile(user, profile, db)
    elapsed = time.time() - t
    print(f"Time: {elapsed:.1f}s")
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    # Create test users
    user_free = get_or_create_test_user("free")
    user_pro = get_or_create_test_user("pro")
    user_elite = get_or_create_test_user("elite", sport="swimming")

    # Create profiles
    profile_free = get_or_create_test_profile(user_free)
    profile_pro = get_or_create_test_profile(user_pro)
    profile_elite = get_or_create_test_profile(user_elite)

    # Test 1: Free tier
    result_free = run_test("FREE TIER", user_free, profile_free)

    # Test 2: Pro tier
    result_pro = run_test("PRO TIER", user_pro, profile_pro)

    # Test 3: Elite tier (swimming)
    result_elite = run_test("ELITE TIER (swimming)", user_elite, profile_elite)

    # Test 4: Cache hit
    print(f"\n{'='*60}")
    print("=== CACHE TEST (Pro tier, should be instant) ===")
    print(f"{'='*60}")
    t = time.time()
    result_cached = research_for_profile(user_pro, profile_pro, db)
    elapsed = time.time() - t
    print(f"Cache hit in {elapsed:.3f}s (should be <0.1s)")

    db.close()
    print("\nDone. Compare outputs above to verify tier quality gap.")
