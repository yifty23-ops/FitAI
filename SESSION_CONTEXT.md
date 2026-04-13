# FitAI — Session Context

> **Purpose**: Read this file at the start of every new chat to restore full project context.
> Updated after security/bug sweep on 2026-04-13.

---

## What this project is

AI personal trainer with 3 subscription tiers (free/pro/elite) where the AI's persona, research depth, and programming sophistication change fundamentally at each tier. See CLAUDE.md for full architecture.

## Current state: All core features + improvement sweep + security sweep COMPLETE

**Original build phases (2026-04-12):**
Phase 1 delivered: scaffolding, database, auth with tier selection, landing page.
Phase 2 delivered: tier-aware onboarding wizard, profile API routes.
Phase 3 delivered: tier-aware research pipeline, ClaudeClient, cache, test endpoint.
Phase 4 delivered: tier-aware plan generation pipeline, plan API routes.
Phase 5 (plan view) delivered: plan view with loading page, tier badges, periodization bar, nutrition panel, upgrade prompts.
Phase 6 (confirm flow) delivered: plans created as drafts, user reviews and confirms or regenerates.
Phase 5 (session logging) delivered: dashboard, session logging, weekly check-ins, week advancement.
Phase 6 (adaptation) delivered: AI-powered weekly plan adaptation for pro+elite, manual adapt button, adaptation history.
Phase 7 (collective learning) delivered: milestone detection, result donation, sport-aware collective queries, research pipeline injection, social proof.
Phase 8 (coach chat) delivered: elite-only conversational AI coach with full context, plan modification via chat, conversation history.

**Improvement sweep (2026-04-13):**
Phase 0 (security): Frontend tier trust fix, rate limiting (slowapi), input validation, Claude API timeouts, DB connection pooling.
Phase 1 (gym UX): Logout button, empty session prevention, confirmation modals, score scale labels, weight units, onboarding persistence, draft plan UX clarity, pre-readiness discoverability, session editing (24h window).
Phase 2 (database): 8 new indexes, ON DELETE CASCADE, pagination on all list endpoints, adaptation history limit.
Phase 3 (account): Settings page with profile editing + change password + tier display + logout.
Phase 4 (gym experience): Rest timer between sets, previous-week comparison, celebration animations, global error boundary.
Phase 5 (visual polish): PeriodizationBar readability + phase legend, NutritionPanel empty state, equipment multi-select checkmarks, TierGate links fix.
Phase 6 (data consistency): Profile staleness warning, tier downgrade guard, week advancement race condition fix (SELECT FOR UPDATE), research cache broadening (age/weight buckets).
Phase 7 (growth): Plan export via print-friendly CSS.
Phase 8 (differentiation): Training calendar page.

**Security & bug fix sweep (2026-04-13):**
Comprehensive audit found 28 issues across CRITICAL/HIGH/MEDIUM/LOW. All fixed. See details below.

**Automated knowledge updates (2026-04-13):**
Weekly scheduled agent (`fitai-knowledge-update`, trigger ID `trig_01RKBrXDpLf1eu6C4nEiwibd`) runs every Sunday 4am UTC on Claude's cloud. Reads `backend/tiers.py` and `backend/services/claude_client.py`, performs ~20-25 web searches across sports science journals, and opens a PR with citation-backed updates. Always creates a research log in `backend/knowledge_updates/YYYY-MM-DD.md` and a PR — even when no code changes are warranted.

First run (2026-04-13) produced PR #1 with 3 changes:
- `claude_client.py`: Volume citation updated from Schoenfeld (2017) to Pelland (2024) meta-regression (67 studies, n=2,058)
- `tiers.py` SPORT_DEMANDS["tennis"]: Added GIRD (glenohumeral internal rotation deficit)
- `tiers.py` SPORT_DEMANDS["mma"]: Updated weight-cut to specify gradual descent over acute dehydration (ISSN 2025 position stand)

Manage at: https://claude.ai/code/scheduled/trig_01RKBrXDpLf1eu6C4nEiwibd

---

## Security & Bug Fix Sweep (2026-04-13) — Full Details

### CRITICAL fixes (all applied and verified)

1. **Tier spoofing at signup FIXED** (`backend/routes/auth.py`): Removed `tier` field from `SignupRequest`. All signups forced to `tier="free"`. Tier changes can only happen through a payment-verified upgrade endpoint (not yet built). **Verified**: sending `tier: "elite"` in signup body returns `tier: "free"`.

2. **Prompt injection sanitization ADDED** (`backend/tools/research.py`): New `sanitize_for_prompt(text, max_length)` utility strips `{}` chars and control characters from user-supplied text before interpolation into Claude prompts. Applied to all fields in `profile_to_research_dict()` (goal, sex, experience, equipment, injuries). Also applied to checkin notes in `tools/chat.py` and chat messages in `routes/chat.py`. Sport field in `build_elite_persona()` (`tiers.py`) validated against `SPORT_DEMANDS` keys; freetext "Other" sport sanitized to alphanumeric+spaces only.

3. **UNIQUE constraints ADDED** (`backend/migrations/004_unique_constraints_and_checks.sql`): 
   - `UNIQUE(plan_id, week_number, day_number)` on sessions
   - `UNIQUE(plan_id, week_number)` on weekly_checkins
   - `UNIQUE(user_id)` on profiles
   - `CHECK(week_number > 0)` on sessions and weekly_checkins
   - `CHECK(day_number > 0)` on sessions
   - **All applied to Neon DB** and verified.

4. **Week bounds validation ADDED** (`backend/routes/session.py`, `backend/routes/checkin.py`): Both session logging and checkin creation now validate `week >= 1` and `week <= plan.mesocycle_weeks`. Session logging also validates `day >= 1`.

5. **Checkin race condition FIXED** (`backend/routes/checkin.py`): Removed application-level duplicate check (was race-prone). Now relies on DB UNIQUE constraint — `db.flush()` hits constraint, catches `IntegrityError`, returns 409. Week advancement happens within the same transaction before `db.commit()`. Adaptation runs after commit (needs committed data).

### HIGH fixes (all applied)

6. **Profile input validation ADDED** (`backend/routes/profile.py`): Pydantic Field validators: age 13-120, weight 20-500, height 50-300, days_per_week 1-7, session_minutes 10-300, stress_level 1-5, injuries max 1000 chars, sport max 50 chars. Enum validation for goal, sex, experience, job_activity, diet_style. **Verified**: age=-5 rejected, goal="INJECT_HACK" rejected.

7. **Research test endpoint gated** (`backend/routes/research.py`): Rate limited to 2/min. Note: the endpoint already respects tier — free tier gets no web search. No further gating needed since `research_for_profile` uses `user.tier`.

8. **Rate limits on all POST endpoints**: 
   - `session.py`: 10/min on POST and PUT
   - `checkin.py`: 5/min on POST
   - `collective.py`: 3/min on POST donate
   - `profile.py`: 3/min on POST
   - `research.py`: 2/min on POST
   - (auth and plan already had limits from improvement sweep)

9. **Pydantic `.dict()` → `.model_dump()`** (`backend/routes/session.py`): All 4 occurrences replaced. Prevents breakage on Pydantic v2 upgrade.

10. **Chat history tier-gated** (`backend/routes/chat.py`): `GET /chat/{plan_id}` now checks `check_feature(user, "coach_chat")` — returns 403 if user downgraded from elite.

11. **Claude response validation hardened** (`backend/services/claude_client.py`): `_retry_json_extraction` has explicit docstring noting single-retry behavior.

12. **Plan structure validation ADDED** (`backend/tools/plan_generator.py`): After Claude returns plan JSON, validates: has `plan` or `weeks` key, has `nutrition` key, weeks is a non-empty list, each week has a `days` list. Raises `ValueError` with specific message on failure.

13. **Concurrent plan generation lock** (`backend/tools/plan_generator.py`): `SELECT ... FOR UPDATE` on user row before draft cleanup prevents two simultaneous `/plan/generate` requests from creating duplicate plans.

### MEDIUM fixes (all applied)

14. **Tier downgrade mid-plan** (`backend/tools/adapt.py`): Adaptation now uses `plan.tier_at_creation` instead of `user.tier` for persona/quality — preserves consistency if user downgrades.

15. **Frontend request timeouts** (`frontend/src/lib/api.ts`): All API calls now have 30-second timeout via `AbortController`. Exports `LONG_TIMEOUT_MS = 120000` for plan generation.

16. **Tier validation helper** (`frontend/src/lib/tiers.ts`): New `validateTier(value)` function — returns `"free"` for invalid values instead of crashing on bad `as Tier` casts.

17. **Email normalization** (`backend/routes/auth.py`): Signup strips whitespace + lowercases before validation. Rejects consecutive dots in local part. Login also normalizes email before DB lookup. **Verified**: `" TEST-HACK@EXAMPLE.COM "` matches correctly.

18. **Request body size limit** (`backend/main.py`): `LimitBodySizeMiddleware` rejects requests > 1MB with 413.

19. **CORS method restriction** (`backend/main.py`): Changed from `allow_methods=["*"]` to explicit `["GET", "POST", "PUT", "DELETE", "OPTIONS"]`.

20. **Security headers** (`backend/main.py`): New middleware adds `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block` to all responses. **Verified** via curl.

21. **Specific exception catches** (`backend/routes/checkin.py`, `backend/routes/chat.py`): Replaced bare `except Exception` with `except (ValueError, KeyError, RuntimeError)` and `except (ValueError, KeyError, TypeError, RuntimeError)`.

22. **DonateBody validation** (`backend/routes/collective.py`): `success_score` now uses `Field(ge=1, le=5)`, `notes` uses `Field(max_length=2000)`. Removed redundant manual check.

### Important `from __future__ import annotations` fix

**Root cause discovered**: `from __future__ import annotations` in route files breaks FastAPI's runtime parameter resolution — Pydantic body models become `ForwardRef` strings and FastAPI treats them as query params. This caused 500 errors on all POST endpoints.

**Fix**: Removed `from __future__ import annotations` from `routes/auth.py`. For all routes with `@limiter.limit()` (which requires `request: Request`), moved `request: Request` AFTER the Pydantic body model and path params in the function signature. FastAPI resolves path params from the URL, body params from the Pydantic model annotation, and `Request` is injected automatically regardless of position.

**Pattern for rate-limited routes with body params**:
```python
# CORRECT — body model before Request
def my_route(body: MyModel, request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):

# WRONG — Request before body model (with from __future__ import annotations)
def my_route(request: Request, body: MyModel, ...):
```

### New migration file

`backend/migrations/004_unique_constraints_and_checks.sql` — **ALREADY APPLIED to Neon DB**. Contains:
- 3 UNIQUE constraints (sessions, weekly_checkins, profiles)
- 3 CHECK constraints (week_number > 0, day_number > 0)

---

### API routes (31 route-methods as of 2026-04-13)

```
POST /auth/signup           — register (rate-limited 3/min, email validated+normalized, password min 8, tier always "free")
POST /auth/login            — authenticate (rate-limited 5/min, email normalized)
PUT  /auth/change-password  — change password (requires auth + current password)
GET  /user/tier             — get tier + features
GET  /user/me               — get user details from DB (tier, email, sport, features)

POST /profile               — upsert profile (rate-limited 3/min, validated bounds+enums, returns plan_stale flag)
GET  /profile               — get profile

POST /plan/generate         — generate plan (rate-limited 2/min, tier plan limit enforced, concurrent lock)
GET  /plan/                 — list plans (paginated: skip/limit)
GET  /plan/active           — get active plan with milestone_pending
GET  /plan/{id}             — get full plan detail
POST /plan/{id}/confirm     — activate draft plan
DELETE /plan/{id}           — delete draft plan
POST /plan/{id}/adapt       — manual adaptation (pro/elite only, uses plan.tier_at_creation)
GET  /plan/{id}/adaptations — adaptation history

POST /session/{plan_id}/{week}/{day} — log session (rate-limited 10/min, week/day bounds validated, UNIQUE constraint)
PUT  /session/{plan_id}/{week}/{day} — edit session (rate-limited 10/min, 24-hour window)
GET  /session/{plan_id}              — list sessions (paginated)
GET  /session/{plan_id}/{week}       — list week sessions

POST /checkin/{plan_id}/{week}  — submit check-in (rate-limited 5/min, week bounds validated, UNIQUE constraint, atomic advance)
GET  /checkin/{plan_id}         — list check-ins (paginated)

POST /collective/{plan_id}/donate — donate milestone (rate-limited 3/min, score 1-5 validated)
GET  /collective/stats            — public stats

POST /chat/            — send chat (elite only, rate-limited 10/min, max 5000 chars, message sanitized)
GET  /chat/{plan_id}   — chat history (elite only, paginated)

POST /research/test    — test research (rate-limited 2/min)
GET  /                 — health check
```

### Frontend routes (11 pages)

```
/                                    — Landing: login/signup + tier cards
/onboarding                          — Onboarding wizard (progress persisted in sessionStorage)
/plan/loading                        — Plan generation with tier-specific progress messages
/plan/[id]                           — Plan detail with export, preview/activate banner
/dashboard                           — Main hub with logout, rest timer, next session, progress
/session/[planId]/[week]/[day]       — Session logging with rest timer, confirmation, prev-week comparison
/checkin/[planId]/[week]             — Weekly check-in with labeled scales, confirmation modal
/chat                                — Elite coach chat
/settings                            — Profile editing, change password, tier display, logout
/calendar                            — Training calendar (week-by-week with completion status)
/_not-found                          — 404 page (Next.js default)
+ error.tsx                          — Global error boundary
```

---

## Deviations from CLAUDE.md spec

1. **`database.py` (extra file)**: Created `backend/database.py` to hold `engine`, `SessionLocal`, `Base`, `get_db`. This breaks what would be a circular import if these lived in `models/__init__.py` (which imports model files that import `Base`). All model files do `from database import Base`. `models/__init__.py` re-exports everything.

2. **Next.js 16 instead of 14**: `create-next-app@latest` installed Next.js 16.2.3 with React 19. The App Router API is the same. The `frontend/AGENTS.md` warns to check `node_modules/next/dist/docs/` before writing code — the docs looked standard for our use case.

3. **No `psql` on PATH**: Migrations run via Python/SQLAlchemy instead of `psql`. The migration SQL files still exist and are correct.

4. **`channel_binding=require` removed from DB URL**: psycopg2 doesn't support this Neon parameter. `sslmode=require` is retained.

5. **Python 3.9.6** (not 3.11+ as spec'd): This is the system Python on macOS. All code works fine — `from __future__ import annotations` used in non-route files where `str | None` type unions appear. **IMPORTANT**: Do NOT add `from __future__ import annotations` to any file in `backend/routes/` — it breaks FastAPI's parameter resolution. Use `Optional[str]` instead.

6. **`from __future__ import annotations`**: Used in `claude_client.py`, `test_research.py`, `plan_generator.py`, `tools/adapt.py`, `tools/collective.py`, `tools/chat.py`, `models/chat.py`, and `routes/plan.py`. **NOT used in**: `routes/auth.py` (was removed due to FastAPI body param bug). Avoid adding it to route files with Pydantic body params + `request: Request`.

7. **`research_for_profile` is synchronous**: Not async despite spec. The route handler is sync and SQLAlchemy session isn't async, so keeping it synchronous is correct.

8. **`slowapi` (extra dependency)**: Added for rate limiting. Not in original CLAUDE.md spec but essential for security.

9. **`settings/page.tsx`, `calendar/page.tsx`, `error.tsx` (extra frontend files)**: Not in original Phase 1 directory structure spec. Added during improvement sweep for account management, training calendar, and error handling.

10. **`RestTimer.tsx`, `Celebration.tsx` (extra components)**: Not in original component list. Added for gym UX improvements.

11. **`003_indexes_and_cascade.sql`, `004_unique_constraints_and_checks.sql` (extra migrations)**: Not in original migration plan. 003 adds performance indexes and CASCADE constraints. 004 adds UNIQUE + CHECK constraints. **Both applied to Neon DB.**

---

## File tree (63 source files as of 2026-04-13)

```
fitai/
├── CLAUDE.md                          # Master spec — read this first
├── SESSION_CONTEXT.md                 # THIS FILE
├── BUILDER_GUIDE.md                   # Dev guidance doc
├── PHASE1_SCAFFOLD.md through PHASE8_COACH_CHAT.md  # Phase instructions (all completed)
│
├── backend/
│   ├── .env                           # Real Neon DB URL, real JWT_SECRET, placeholder ANTHROPIC/RESEND/STRIPE keys
│   ├── venv/                          # Python virtual environment (created during local run)
│   ├── requirements.txt               # Pinned deps (fastapi, sqlalchemy, anthropic, slowapi, etc.)
│   ├── main.py                        # FastAPI app + CORS + slowapi + LimitBodySizeMiddleware + security headers
│   ├── config.py                      # pydantic BaseSettings from .env
│   ├── database.py                    # engine (with connection pooling), SessionLocal, Base, get_db
│   ├── tiers.py                       # PERSONAS, SPORT_DEMANDS (with sport sanitization), TIER_FEATURES, check_feature, check_plan_limit
│   ├── test_research.py               # Manual test script for tier research quality comparison
│   ├── knowledge_updates/
│   │   ├── .gitkeep
│   │   └── 2026-04-13.md              # First automated research log
│   ├── models/
│   │   ├── __init__.py                # Re-exports Base, engine, get_db + all models
│   │   ├── user.py, profile.py, research_cache.py, plan.py
│   │   ├── session.py, checkin.py, adaptation.py, collective.py, chat.py
│   ├── routes/
│   │   ├── __init__.py                # Empty
│   │   ├── auth.py                    # Signup (tier forced free), login (email normalized), change-password, /me, /tier. NO from __future__ import annotations.
│   │   ├── profile.py                 # POST upsert (rate-limited, validated bounds+enums), GET
│   │   ├── plan.py                    # generate (rate-limited, concurrent lock), list, active, detail, confirm, delete, adapt (tier_at_creation), adaptations
│   │   ├── research.py                # POST /test (rate-limited)
│   │   ├── session.py                 # POST (rate-limited, week/day bounds, UNIQUE), PUT (rate-limited, 24h), GET list, GET week
│   │   ├── checkin.py                 # POST (rate-limited, week bounds, UNIQUE+IntegrityError, atomic advance), GET
│   │   ├── collective.py              # POST donate (rate-limited, validated), GET stats
│   │   └── chat.py                    # POST (rate-limited, sanitized), GET (tier-gated)
│   ├── tools/
│   │   ├── __init__.py                # Empty
│   │   ├── research.py                # sanitize_for_prompt(), compute_profile_hash, profile_to_research_dict (sanitized), research_for_profile
│   │   ├── plan_generator.py          # generate_plan_for_profile (structure validation, concurrent lock)
│   │   ├── adapt.py                   # adapt_plan (uses plan.tier_at_creation), get_adaptation_history (limited to 5)
│   │   ├── collective.py              # donate_result + query_collective (sport-aware 3-tier query)
│   │   └── chat.py                    # build_coach_context (sanitized notes), get_conversation_history, apply_chat_modifications
│   ├── services/
│   │   ├── __init__.py                # Empty
│   │   └── claude_client.py           # ClaudeClient (research + generate_plan + adapt + chat, with httpx timeout, retry guard)
│   └── migrations/
│       ├── 001_phase1.sql             # All 8 CREATE TABLE statements
│       ├── 002_phase8_chat.sql        # chat_messages table + indexes
│       ├── 003_indexes_and_cascade.sql # 8 indexes + CASCADE constraints (APPLIED)
│       └── 004_unique_constraints_and_checks.sql # 3 UNIQUE + 3 CHECK constraints (APPLIED)
│
├── frontend/
│   ├── .env.local                     # NEXT_PUBLIC_API_URL=http://localhost:8000
│   ├── package.json                   # Next.js 16.2.3, React 19
│   ├── tsconfig.json                  # Standard, @/* alias
│   ├── AGENTS.md                      # Warning: check Next.js docs before writing code
│   ├── CLAUDE.md                      # Points to AGENTS.md
│   └── src/
│       ├── app/
│       │   ├── globals.css            # Tailwind base styles + print-friendly export styles
│       │   ├── layout.tsx             # Root layout: system-ui font, FitAI metadata
│       │   ├── error.tsx              # Global error boundary: retry + dashboard link
│       │   ├── page.tsx               # Landing: login/signup + tier cards → redirects logged-in to /dashboard
│       │   ├── onboarding/page.tsx    # Auth gate → renders OnboardingChat with tier prop
│       │   ├── chat/page.tsx          # Coach chat: elite-only
│       │   ├── dashboard/page.tsx     # Dashboard: next session, week progress, quick actions
│       │   ├── settings/page.tsx      # Settings: profile editing, change password, tier display, logout
│       │   ├── calendar/page.tsx      # Training calendar: week-by-week
│       │   ├── session/[planId]/[week]/[day]/page.tsx  # Session logging
│       │   ├── checkin/[planId]/[week]/page.tsx         # Weekly check-in
│       │   └── plan/
│       │       ├── loading/page.tsx   # Plan generation: animated progress
│       │       └── [id]/page.tsx      # Plan detail: preview/activate, export
│       ├── components/
│       │   ├── OnboardingChat.tsx     # 7-step wizard with sessionStorage persistence
│       │   ├── PlanView.tsx           # Collapsible day cards with exercises
│       │   ├── NutritionPanel.tsx     # Training/rest day macros + empty state
│       │   ├── PeriodizationBar.tsx   # Phase-colored week timeline with legend
│       │   ├── TierGate.tsx           # Upgrade prompt linking to /settings
│       │   ├── WeekProgressDots.tsx   # Filled/hollow dots for progress
│       │   ├── RestTimer.tsx          # Fixed-bottom countdown timer
│       │   └── Celebration.tsx        # Animated checkmark overlay
│       └── lib/
│           ├── auth.ts                # saveToken, getToken, clearToken, getUser, isLoggedIn, fetchUserMe
│           ├── api.ts                 # api<T>() with Bearer auth, 30s timeout, LONG_TIMEOUT_MS export
│           └── tiers.ts              # TIER_FEATURES mirror, canUse(), validateTier(), TIER_DISPLAY

```

---

## Database

- **Host**: Neon (ap-southeast-1)
- **Connection**: See `backend/.env` for full URL
- **Tables**: users, profiles, research_cache, plans, sessions, weekly_checkins, collective_results, adaptation_log, chat_messages
- **Test users in DB**: `test-hack@example.com` (free tier, has profile), `test-normal@example.com` (free tier, no profile) — created during security testing
- **Migrations**: All 4 applied to Neon:
  - `001_phase1.sql` — 8 tables
  - `002_phase8_chat.sql` — chat_messages + indexes
  - `003_indexes_and_cascade.sql` — 8 performance indexes + CASCADE constraints
  - `004_unique_constraints_and_checks.sql` — 3 UNIQUE + 3 CHECK constraints

Run migrations via:
```bash
cd backend && source venv/bin/activate && python3 -c "
from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text(open('migrations/004_unique_constraints_and_checks.sql').read()))
    conn.commit()
"
```

---

## Runtime

| Component | Version | Note |
|-----------|---------|------|
| Python | 3.9.6 | System python. Do NOT use `from __future__ import annotations` in route files. |
| Node | 24.14.0 | |
| npm | 11.9.0 | |
| Next.js | 16.2.3 | Installed via create-next-app@latest |
| React | 19.2.4 | |
| pip | Use `source venv/bin/activate` then `pip` | venv at `backend/venv/` |

---

## Commands

```bash
# Backend (uses venv)
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Verify backend
cd backend && source venv/bin/activate && python3 -c "from main import app; print(f'{len(app.routes)} routes')"

# Verify frontend
cd frontend && npm run build

# Run a specific migration
cd backend && source venv/bin/activate && python3 -c "
from database import engine
from sqlalchemy import text
stmts = [s.strip() for s in open('migrations/004_unique_constraints_and_checks.sql').read().split(';') if s.strip() and not s.strip().startswith('--')]
with engine.connect() as conn:
    for s in stmts:
        try:
            conn.execute(text(s))
            print(f'OK: {s[:60]}')
        except Exception as e:
            print(f'SKIP: {str(e)[:80]}')
    conn.commit()
"
```

---

## Still missing / deferred

These are known gaps documented in the improvement plan but not yet implemented:

1. **Stripe integration**: Config + env vars exist, but no actual payment code (no `stripe` in requirements.txt or `@stripe/stripe-js` in package.json). Users cannot actually upgrade tiers via payment. All signups are forced to "free" tier.
2. **Email verification**: Resend API key configured but no verification flow exists. Users can sign up with any string that passes email regex.
3. **Forgot password flow**: No `POST /auth/forgot-password` or reset token mechanism.
4. **Progress charts**: No data visualization of training trends over time.
5. **Active workout mode**: Full-screen one-exercise-at-a-time view with giant tap targets.
6. **Personal records board**: Automatic PR detection and celebration.
7. **Progressive overload tracker**: Automated weekly volume comparison on dashboard.
8. **Async plan generation**: Plan generation is still synchronous (blocks 30-90s). Could be moved to background task with polling.
9. **Account lockout**: No lockout after failed login attempts (only rate-limited 5/min).
10. **Frontend AbortController cleanup on unmount**: Timeouts added to `api.ts` but individual page useEffect hooks don't yet pass AbortController signals for cleanup on navigation.
11. **ANTHROPIC_API_KEY**: Still a placeholder in `.env`. AI features (research, plan generation, adaptation, chat) will fail until a real key is provided.

---

## What has been tested locally (2026-04-13)

- Backend starts cleanly on port 8000 (health check returns `{"status":"ok"}`)
- Frontend builds with zero TypeScript errors, all 11 pages generate, dev server runs on port 3000
- Signup: tier spoofing blocked (sends `elite`, gets `free`)
- Login: email normalization works (`" TEST-HACK@EXAMPLE.COM "` matches lowercase DB entry)
- Profile: age=-5 rejected (ge=13), goal="INJECT_HACK" rejected (enum validation)
- Profile: valid profile creates successfully
- Security headers present on all responses (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- `sanitize_for_prompt()` strips `{}` from injection attempts
- `build_elite_persona()` strips special chars from freetext sport names
- All DB constraints (UNIQUE, CHECK) applied and verified on Neon
