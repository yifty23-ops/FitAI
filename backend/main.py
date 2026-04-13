from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from config import settings
from routes.auth import auth_router, user_router
from routes.profile import profile_router
from routes.plan import plan_router
from routes.research import research_router
from routes.session import session_router
from routes.checkin import checkin_router
from routes.collective import collective_router
from routes.chat import chat_router

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="FitAI")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(user_router, prefix="/user", tags=["user"])
app.include_router(profile_router, prefix="/profile", tags=["profile"])
app.include_router(plan_router, prefix="/plan", tags=["plan"])
app.include_router(research_router, prefix="/research", tags=["research"])
app.include_router(session_router, prefix="/session", tags=["session"])
app.include_router(checkin_router, prefix="/checkin", tags=["checkin"])
app.include_router(collective_router, prefix="/collective", tags=["collective"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])


@app.get("/")
def health_check():
    return {"status": "ok"}
