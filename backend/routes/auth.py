from datetime import datetime, timedelta, timezone

import re

import bcrypt
import jwt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from slowapi import Limiter
from slowapi.util import get_remote_address

from config import settings
from database import get_db
from models.user import User
from tiers import TIER_FEATURES

auth_router = APIRouter()
user_router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


# --- Request/Response schemas ---

class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Invalid email format")
        # Reject consecutive dots in local part
        local = v.split("@")[0]
        if ".." in local:
            raise ValueError("Invalid email format")
        return v


class LoginRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: str
    tier: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class TierResponse(BaseModel):
    tier: str
    features: dict


class UserMeResponse(BaseModel):
    user_id: str
    email: str
    tier: str
    sport: Optional[str] = None
    features: dict


# --- JWT helpers ---

def create_token(user_id: str, tier: str) -> str:
    payload = {
        "user_id": user_id,
        "tier": tier,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> User:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization[len("Bearer "):]
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == payload["user_id"]).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# --- Auth routes ---

@auth_router.post("/signup", response_model=AuthResponse)
@limiter.limit("3/minute")
def signup(req: SignupRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = bcrypt.hashpw(req.password.encode(), bcrypt.gensalt()).decode("utf-8")
    user = User(email=req.email, password_hash=hashed, tier="free")
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(str(user.id), user.tier)
    return AuthResponse(token=token, user_id=str(user.id), tier=user.tier)


@auth_router.put("/change-password")
def change_password(
    request: Request,
    req: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not bcrypt.checkpw(req.current_password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    hashed = bcrypt.hashpw(req.new_password.encode(), bcrypt.gensalt()).decode("utf-8")
    user.password_hash = hashed
    db.commit()
    return {"detail": "Password changed"}


@auth_router.post("/login", response_model=AuthResponse)
@limiter.limit("5/minute")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    normalized_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not bcrypt.checkpw(req.password.encode(), user.password_hash.encode()):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(str(user.id), user.tier)
    return AuthResponse(token=token, user_id=str(user.id), tier=user.tier)


# --- User routes ---

@user_router.get("/tier", response_model=TierResponse)
def get_tier(user: User = Depends(get_current_user)):
    return TierResponse(tier=user.tier, features=TIER_FEATURES[user.tier])


@user_router.get("/me", response_model=UserMeResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserMeResponse(
        user_id=str(user.id),
        email=user.email,
        tier=user.tier,
        sport=user.sport,
        features=TIER_FEATURES[user.tier],
    )
