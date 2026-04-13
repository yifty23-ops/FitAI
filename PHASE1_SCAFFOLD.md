# PHASE 1 — Scaffold + DB + Auth + Tiers
# Paste this into Claude Code FIRST.

Read CLAUDE.md in this directory. It defines the entire project.

## Step 1: Create both apps

Frontend:
```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Backend:
```bash
mkdir -p backend/{models,routes,tools,services,migrations}
touch backend/main.py backend/config.py backend/tiers.py backend/requirements.txt backend/.env
```

Backend requirements.txt:
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.35
psycopg2-binary==2.9.9
anthropic==0.39.0
pyjwt==2.9.0
bcrypt==4.2.0
python-dotenv==1.0.1
pydantic-settings==2.5.0
resend==2.4.0
```

## Step 2: tiers.py — the brain of the product

Create `backend/tiers.py` with the EXACT content from CLAUDE.md:
- PERSONAS dict (free, pro, elite=None)
- SPORT_DEMANDS dict (all 10 sports)
- build_elite_persona(sport) function
- TIER_FEATURES dict
- check_feature(user, feature) function
- check_plan_limit(user, db) function

This file is the single source of truth for what each tier gets.
Do NOT scatter tier logic across multiple files.

## Step 3: Config, FastAPI app, CORS

Create `backend/config.py` — pydantic BaseSettings loading all env vars.
Create `backend/main.py` — FastAPI app + CORS + health check route.

## Step 4: SQLAlchemy models + DB

Create `backend/models/__init__.py` with engine, SessionLocal, Base, get_db.

User model (`backend/models/user.py`):
- id, email, password_hash, tier (default "free"), sport (nullable), competition_date (nullable), stripe_customer_id (nullable), created_at

Profile model (`backend/models/profile.py`):
- All fields from CLAUDE.md schema

ResearchCache model (`backend/models/research_cache.py`):
- Note: UNIQUE constraint on (profile_hash, tier) — same profile, different tier = different cache entry

Plan model (`backend/models/plan.py`):
- Note: includes tier_at_creation and persona_used fields

Create `backend/migrations/001_phase1.sql` with full schema from CLAUDE.md (ALL tables including sessions, weekly_checkins, collective_results, adaptation_log — create now, populate in later phases).

## Step 5: Auth routes with tier

Create `backend/routes/auth.py`:
- POST /auth/signup — accepts {email, password, tier?}. Default tier = "free". Hash password, create user, return JWT with tier claim.
- POST /auth/login — verify, return JWT with tier claim.
- JWT payload: {user_id, tier, exp}
- get_current_user dependency: decode JWT, fetch user from DB, return User object (with tier).

GET /user/tier — returns {tier, features: TIER_FEATURES[tier]}

## Step 6: Frontend auth + tier awareness

Create `frontend/src/lib/auth.ts` — token helpers.
Create `frontend/src/lib/api.ts` — fetch wrapper with auth header.
Create `frontend/src/lib/tiers.ts`:
```typescript
export const TIER_FEATURES = {
  free:  { web_search: false, adaptation: false, collective: false, coach_chat: false, sport_specific: false },
  pro:   { web_search: true,  adaptation: true,  collective: true,  coach_chat: false, sport_specific: false },
  elite: { web_search: true,  adaptation: true,  collective: true,  coach_chat: true,  sport_specific: true  },
} as const;

export type Tier = keyof typeof TIER_FEATURES;
export function canUse(tier: Tier, feature: keyof typeof TIER_FEATURES["free"]): boolean {
  return TIER_FEATURES[tier][feature];
}
```

Create `frontend/src/app/page.tsx`:
- Login/signup form
- Tier selection during signup: 3 cards showing Free / Pro / Elite with feature bullets
- For now: tier selection is a simple choice, no Stripe integration (Phase 8)
- On signup: store token, redirect to /onboarding

## Verification

1. Migration runs: all tables created including tier/sport columns
2. Backend starts: `curl localhost:8000` returns ok
3. Signup as free: `curl -X POST .../auth/signup -d '{"email":"a@b.com","password":"test1234"}'` — tier defaults to "free"
4. Signup as elite: `curl -X POST .../auth/signup -d '{"email":"b@b.com","password":"test1234","tier":"elite"}'` — tier = "elite"
5. Login returns JWT — decode it, verify tier claim present
6. GET /user/tier returns correct features for each tier
7. Frontend renders: login form + tier selection cards visible
8. Signup flow: select tier → create account → redirect to /onboarding

## STOP
Build log entry in CLAUDE.md. Do NOT proceed until all 8 checks pass.
