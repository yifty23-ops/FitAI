# FitAI — Session Context

> **Purpose**: Read this file at the start of every new chat to restore full project context.
> Updated after knowledge update agent verification on 2026-04-13.

---

## What this project is

AI personal trainer with 3 subscription tiers (free/pro/elite) where the AI's persona, research depth, and programming sophistication change fundamentally at each tier. See CLAUDE.md for full architecture.

## Current state: All core features + improvement sweep COMPLETE

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

**Automated knowledge updates (2026-04-13):**
Weekly scheduled agent (`fitai-knowledge-update`, trigger ID `trig_01RKBrXDpLf1eu6C4nEiwibd`) runs every Sunday 4am UTC on Claude's cloud. Reads `backend/tiers.py` and `backend/services/claude_client.py`, performs ~20-25 web searches across sports science journals, and opens a PR with citation-backed updates. Always creates a research log in `backend/knowledge_updates/YYYY-MM-DD.md` and a PR — even when no code changes are warranted.

First run (2026-04-13) produced PR #1 with 3 changes:
- `claude_client.py`: Volume citation updated from Schoenfeld (2017) to Pelland (2024) meta-regression (67 studies, n=2,058)
- `tiers.py` SPORT_DEMANDS["tennis"]: Added GIRD (glenohumeral internal rotation deficit)
- `tiers.py` SPORT_DEMANDS["mma"]: Updated weight-cut to specify gradual descent over acute dehydration (ISSN 2025 position stand)

Manage at: https://claude.ai/code/scheduled/trig_01RKBrXDpLf1eu6C4nEiwibd

### API routes (31 route-methods as of 2026-04-13)

```
POST /auth/signup           — register (rate-limited 3/min, email validated, password min 8 chars)
POST /auth/login            — authenticate (rate-limited 5/min)
PUT  /auth/change-password  — change password (requires auth + current password)
GET  /user/tier             — get tier + features
GET  /user/me               — get user details from DB (tier, email, sport, features)

POST /profile               — upsert profile (returns plan_stale flag if active plan exists)
GET  /profile               — get profile

POST /plan/generate         — generate plan (rate-limited 2/min, tier plan limit enforced)
GET  /plan/                 — list plans (paginated: skip/limit)
GET  /plan/active           — get active plan with milestone_pending
GET  /plan/{id}             — get full plan detail
POST /plan/{id}/confirm     — activate draft plan
DELETE /plan/{id}           — delete draft plan
POST /plan/{id}/adapt       — manual adaptation (pro/elite only, tier downgrade guarded)
GET  /plan/{id}/adaptations — adaptation history

POST /session/{plan_id}/{week}/{day} — log session (validates non-empty data)
PUT  /session/{plan_id}/{week}/{day} — edit session (24-hour window)
GET  /session/{plan_id}              — list sessions (paginated)
GET  /session/{plan_id}/{week}       — list week sessions

POST /checkin/{plan_id}/{week}  — submit check-in (scores bounded 1-10, weight 20-500)
GET  /checkin/{plan_id}         — list check-ins (paginated)

POST /collective/{plan_id}/donate — donate milestone result
GET  /collective/stats            — public stats

POST /chat/            — send chat message (elite only, rate-limited 10/min, max 5000 chars)
GET  /chat/{plan_id}   — chat history (paginated)

POST /research/test    — test research endpoint
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

## Key changes from improvement sweep (2026-04-13)

### Security hardening
- **Frontend tier trust**: Pages now call `GET /user/me` to fetch tier from DB instead of trusting JWT `tier` claim. `fetchUserMe()` added to `frontend/src/lib/auth.ts`. Dashboard, chat, and plan pages updated.
- **Rate limiting**: `slowapi` added to `backend/main.py`. Auth, plan generation, and chat routes have per-IP/per-minute limits. `slowapi==0.1.9` in requirements.txt.
- **Input validation**: Email regex in `SignupRequest`, password `min_length=8`, chat message `max_length=5000`, checkin scores `ge=1, le=10`, session reps/weight/RPE bounded, notes `max_length=2000`.
- **Claude API timeouts**: `httpx.Timeout(connect=10, read=120, write=30, pool=10)` passed to Anthropic client in `claude_client.py`.
- **DB connection pooling**: `pool_size=5, max_overflow=10, pool_pre_ping=True, pool_recycle=300` in `database.py`.

### UX improvements
- **Logout button**: Dashboard header has a door icon that calls `clearToken()` and redirects to `/`.
- **Empty session prevention**: Backend rejects sessions where all sets have reps=0 AND weight=0. Frontend disables submit button until data entered. Green border on exercises with data.
- **Confirmation modals**: Bottom-sheet overlays before session/check-in submission showing summary of what will be submitted.
- **Score scale labels**: "Exhausted"/"Fully recovered", "Terrible"/"Excellent", "Depleted"/"Energized", "None"/"Severe" on all 1-10 scales in session and check-in pages.
- **Weight units**: Inline "kg" suffix in check-in weight input field.
- **Onboarding persistence**: Step + answers saved to `sessionStorage` on every change, restored on mount, cleared on successful submit. `STORAGE_KEY = "fitai_onboarding"` in `OnboardingChat.tsx`.
- **Draft plan UX**: "Preview" badge at top (not "Draft" at bottom), green "Activate This Plan" button, "Generate New Plan" outlined button. Active plans show "Active" badge in footer.
- **Pre-readiness visibility**: Expanded by default on Day 1 of each week. Descriptive subtitle: "Quick 3-tap check — helps your coach adjust your plan."
- **Session editing**: `PUT /session/{plan_id}/{week}/{day}` allows editing within 24 hours. "Edit" button shown on read-only view when within window.
- **Rest timer**: `RestTimer.tsx` component — fixed bottom bar with large countdown digits, +30s/-30s buttons, vibration on zero. Integrated into session page per-exercise.
- **Previous week comparison**: Session page fetches previous week's session data. Shows "Last week: Xkg x Y" below each exercise for progressive overload reference.
- **Celebrations**: `Celebration.tsx` — animated checkmark overlay on session completion. Auto-dismisses after 2 seconds.
- **Settings page**: `/settings` with profile editing, change password, tier display, logout. Pre-populated from `GET /profile`.
- **Calendar view**: `/calendar` — week-by-week training schedule with completion indicators, linked from dashboard Quick Actions.
- **Plan export**: Print-friendly CSS in `globals.css` + "Export" button in plan footer triggers `window.print()`.
- **Error boundary**: `error.tsx` at app level — "Something went wrong" with retry + dashboard link.

### Database & performance
- **Migration**: `backend/migrations/003_indexes_and_cascade.sql`:
  - 8 indexes: sessions(plan_id, week_number), sessions(user_id), weekly_checkins(plan_id, week_number), plans(user_id, is_active), adaptation_log(plan_id), collective_results(profile_hash), collective_results(sport), research_cache(profile_hash, tier)
  - ON DELETE CASCADE on: sessions→plans, weekly_checkins→plans, adaptation_log→plans, chat_messages→plans, profiles→users
- **Pagination**: All list endpoints (sessions, checkins, chat history, plans) accept `skip` and `limit` query params.
- **Adaptation history limit**: `get_adaptation_history()` in `tools/adapt.py` now fetches last 5 (not unbounded), preventing Claude prompt bloat.

### Data consistency
- **Profile staleness**: `POST /profile` returns `plan_stale: true` when an active plan exists, so settings page can warn user.
- **Tier downgrade guard**: Adaptation endpoint checks `user.tier` at request time (not `plan.tier_at_creation`).
- **Race condition fix**: `maybe_advance_week()` in `checkin.py` uses `SELECT ... FOR UPDATE` on plan row before incrementing `current_week`.
- **Research cache broadening**: `compute_profile_hash()` in `tools/research.py` now includes `age_bucket` (decade) and `weight_bucket` (10kg range) — prevents two very different people from sharing cached research.

### Visual polish
- **PeriodizationBar**: Week number font increased to `text-xs` (was 10px). Phase color legend added below the bar showing unique phases with colored dots.
- **NutritionPanel**: Shows placeholder card instead of returning null when no nutrition data.
- **Equipment multi-select**: Checkmark character on selected items + "X selected" counter below grid.
- **TierGate links**: Upgrade links now point to `/settings` instead of `/`.

---

## What has NOT been tested yet

- All items from the original "not tested" list still apply (actual Claude API calls, end-to-end browser flow, etc.)
- New items:
  - Rate limiting behavior (slowapi) under actual traffic
  - Session editing PUT endpoint within/outside 24h window
  - Rest timer vibration on mobile devices
  - Previous week comparison with real session data
  - Celebration animation rendering across browsers
  - Settings page profile save + plan_stale warning flow
  - Calendar page with real plan data
  - Print/export output quality and readability
  - New database migration (003) applied to Neon
  - Connection pooling behavior under concurrent requests
  - `fetchUserMe()` called on every page load — verify no performance regression

---

## Deviations from CLAUDE.md spec

1. **`database.py` (extra file)**: Created `backend/database.py` to hold `engine`, `SessionLocal`, `Base`, `get_db`. This breaks what would be a circular import if these lived in `models/__init__.py` (which imports model files that import `Base`). All model files do `from database import Base`. `models/__init__.py` re-exports everything.

2. **Next.js 16 instead of 14**: `create-next-app@latest` installed Next.js 16.2.3 with React 19. The App Router API is the same. The `frontend/AGENTS.md` warns to check `node_modules/next/dist/docs/` before writing code — the docs looked standard for our use case.

3. **No `psql` on PATH**: Migrations run via Python/SQLAlchemy instead of `psql`. The migration SQL files still exist and are correct.

4. **`channel_binding=require` removed from DB URL**: psycopg2 doesn't support this Neon parameter. `sslmode=require` is retained.

5. **Python 3.9.6** (not 3.11+ as spec'd): This is the system Python on macOS. All code works fine — `from __future__ import annotations` used where `str | None` or `X | Y` type unions appear. Pydantic models use `Optional[str]` syntax since Pydantic evaluates annotations at runtime.

6. **`from __future__ import annotations`**: Added to `claude_client.py`, `test_research.py`, `plan_generator.py`, `routes/plan.py`, `routes/auth.py`, `tools/adapt.py`, `tools/collective.py`, `routes/collective.py`, `tools/chat.py`, `routes/chat.py`, and `models/chat.py`.

7. **`research_for_profile` is synchronous**: Not async despite spec. The route handler is sync and SQLAlchemy session isn't async, so keeping it synchronous is correct.

8. **`slowapi` (extra dependency)**: Added for rate limiting. Not in original CLAUDE.md spec but essential for security.

9. **`settings/page.tsx`, `calendar/page.tsx`, `error.tsx` (extra frontend files)**: Not in original Phase 1 directory structure spec. Added during improvement sweep for account management, training calendar, and error handling.

10. **`RestTimer.tsx`, `Celebration.tsx` (extra components)**: Not in original component list. Added for gym UX improvements.

11. **`003_indexes_and_cascade.sql` (extra migration)**: Not in original migration plan. Adds performance indexes and CASCADE constraints.

---

## File tree (62 source files as of 2026-04-13)

```
fitai/
├── CLAUDE.md                          # Master spec — read this first
├── SESSION_CONTEXT.md                 # THIS FILE
├── BUILDER_GUIDE.md                   # Dev guidance doc
├── PHASE1_SCAFFOLD.md through PHASE8_COACH_CHAT.md  # Phase instructions (all completed)
│
├── backend/
│   ├── .env                           # Real Neon DB URL, placeholder API keys
│   ├── requirements.txt               # Pinned deps (fastapi, sqlalchemy, anthropic, slowapi, etc.)
│   ├── main.py                        # FastAPI app + CORS + slowapi rate limiter + router includes
│   ├── config.py                      # pydantic BaseSettings from .env
│   ├── database.py                    # engine (with connection pooling), SessionLocal, Base, get_db
│   ├── tiers.py                       # PERSONAS, SPORT_DEMANDS, TIER_FEATURES, check_feature, check_plan_limit
│   ├── test_research.py               # Manual test script for tier research quality comparison
│   ├── knowledge_updates/
│   │   ├── .gitkeep
│   │   └── 2026-04-13.md              # First automated research log (volume citation, tennis GIRD, MMA weight mgmt)
│   ├── models/
│   │   ├── __init__.py                # Re-exports Base, engine, get_db + all models
│   │   ├── user.py                    # User model (tier, sport, competition_date, stripe_customer_id)
│   │   ├── profile.py                 # Profile model (goal, stats, equipment, lifestyle)
│   │   ├── research_cache.py          # ResearchCache model (unique on profile_hash+tier)
│   │   ├── plan.py                    # Plan model (tier_at_creation, persona_used, plan_data JSONB, nutrition JSONB, milestone_pending)
│   │   ├── session.py                 # SessionLog model (plan_id, week/day, pre_readiness JSONB, logged_exercises JSONB)
│   │   ├── checkin.py                 # WeeklyCheckin model (plan_id, week, recovery/mood/sleep/weight)
│   │   ├── adaptation.py              # AdaptationLog model (plan_id, week, assessment, adjustments JSONB, flags JSONB)
│   │   ├── collective.py              # CollectiveResult model (profile_hash, sport, plan_config JSONB, outcome JSONB, success_score)
│   │   └── chat.py                    # ChatMessage model (user_id, plan_id, role, content, modifications JSONB)
│   ├── routes/
│   │   ├── __init__.py                # Empty
│   │   ├── auth.py                    # auth_router (/signup, /login, /change-password) + user_router (/tier, /me) + get_current_user + rate limiting + email/password validation
│   │   ├── profile.py                 # profile_router (POST upsert with plan_stale flag, GET)
│   │   ├── plan.py                    # plan_router (generate w/rate-limit, list w/pagination, active, detail, confirm, delete, adapt w/tier-guard, adaptations)
│   │   ├── research.py                # research_router (POST /research/test)
│   │   ├── session.py                 # session_router (POST create w/empty-check, PUT edit w/24h-window, GET list w/pagination, GET week)
│   │   ├── checkin.py                 # checkin_router (POST w/score-bounds, GET w/pagination) + maybe_advance_week() w/row-lock + adapt hook + milestone
│   │   ├── collective.py              # collective_router (POST donate, GET stats)
│   │   └── chat.py                    # chat_router (POST w/rate-limit+length-limit, GET w/pagination)
│   ├── tools/
│   │   ├── __init__.py                # Empty
│   │   ├── research.py                # compute_profile_hash (w/age+weight buckets), profile_to_research_dict, research_for_profile
│   │   ├── plan_generator.py          # generate_plan_for_profile (research → Claude plan → save as draft)
│   │   ├── adapt.py                   # adapt_plan, get_adaptation_history (limited to 5)
│   │   ├── collective.py              # donate_result + query_collective (sport-aware 3-tier query)
│   │   └── chat.py                    # build_coach_context, get_conversation_history, apply_chat_modifications
│   ├── services/
│   │   ├── __init__.py                # Empty
│   │   └── claude_client.py           # ClaudeClient (research + generate_plan + adapt + chat, with httpx timeout)
│   └── migrations/
│       ├── 001_phase1.sql             # All 8 CREATE TABLE statements
│       ├── 002_phase8_chat.sql        # chat_messages table + indexes
│       └── 003_indexes_and_cascade.sql # 8 indexes + CASCADE constraints
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
│       │   ├── chat/page.tsx          # Coach chat: elite-only full-screen chat with AI coach
│       │   ├── dashboard/page.tsx     # Dashboard: logout, next session, week progress, quick actions, calendar link, settings link
│       │   ├── settings/page.tsx      # Settings: profile editing, change password, tier display, logout
│       │   ├── calendar/page.tsx      # Training calendar: week-by-week with completion status
│       │   ├── session/[planId]/[week]/[day]/page.tsx  # Session: rest timer, prev-week comparison, confirmation, celebration
│       │   ├── checkin/[planId]/[week]/page.tsx         # Check-in: labeled scales, confirmation modal, kg suffix
│       │   └── plan/
│       │       ├── loading/page.tsx   # Plan generation: animated progress, redirect
│       │       └── [id]/page.tsx      # Plan detail: preview/activate, export button, periodization, exercises, nutrition
│       ├── components/
│       │   ├── OnboardingChat.tsx     # 7-step wizard with sessionStorage persistence, equipment checkmarks
│       │   ├── PlanView.tsx           # Collapsible day cards with exercises, swap options
│       │   ├── NutritionPanel.tsx     # Training/rest day macros with colored bars + empty state placeholder
│       │   ├── PeriodizationBar.tsx   # Phase-colored week timeline with phase legend, tappable week selector
│       │   ├── TierGate.tsx           # Upgrade prompt linking to /settings
│       │   ├── WeekProgressDots.tsx   # Filled/hollow dots for session + check-in progress
│       │   ├── RestTimer.tsx          # Fixed-bottom countdown timer with vibration, +30s/-30s
│       │   └── Celebration.tsx        # Animated checkmark overlay, auto-dismiss after 2s
│       └── lib/
│           ├── auth.ts                # saveToken, getToken, clearToken, getUser, isLoggedIn, fetchUserMe
│           ├── api.ts                 # api<T>(path, options) fetch wrapper with Bearer auth
│           └── tiers.ts              # TIER_FEATURES mirror, canUse(), TIER_DISPLAY
```

---

## Database

- **Host**: Neon (ap-southeast-1)
- **Connection**: See `backend/.env` for full URL
- **Tables** (all empty): users, profiles, research_cache, plans, sessions, weekly_checkins, collective_results, adaptation_log, chat_messages
- **Migrations**:
  - `001_phase1.sql` — 8 tables
  - `002_phase8_chat.sql` — chat_messages + indexes
  - `003_indexes_and_cascade.sql` — 8 performance indexes + CASCADE constraints (**NOT YET APPLIED** — run this on Neon)
- Run via: `cd backend && python3 -c "from database import engine; from sqlalchemy import text; conn = engine.connect(); conn.execute(text(open('migrations/003_indexes_and_cascade.sql').read())); conn.commit()"`

---

## Runtime

| Component | Version | Note |
|-----------|---------|------|
| Python | 3.9.6 | System python, needs `from __future__ import annotations` + `Optional[str]` for Pydantic models |
| Node | 24.14.0 | |
| npm | 11.9.0 | |
| Next.js | 16.2.3 | Installed via create-next-app@latest |
| React | 19.2.4 | |
| pip | Use `python3 -m pip` | `pip` alone not on PATH |

---

## Commands

```bash
# Backend
cd backend && python3 -m uvicorn main:app --reload --port 8000

# Frontend
cd frontend && npm run dev

# Run migration (if psql not available)
cd backend && python3 -c "
from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text(open('migrations/003_indexes_and_cascade.sql').read()))
    conn.commit()
"

# Verify backend
cd backend && python3 -c "from main import app; print(f'{len(app.routes)} routes')"

# Verify frontend
cd frontend && npm run build
```

---

## Still missing / deferred

These are known gaps documented in the improvement plan but not yet implemented:

1. **Stripe integration**: Config + env vars exist, but no actual payment code (no `stripe` in requirements.txt or `@stripe/stripe-js` in package.json). Users cannot actually upgrade tiers via payment.
2. **Email verification**: Resend API key configured but no verification flow exists. Users can sign up with any string that passes email regex.
3. **Forgot password flow**: No `POST /auth/forgot-password` or reset token mechanism.
4. **Progress charts**: No data visualization of training trends over time.
5. **Active workout mode**: Full-screen one-exercise-at-a-time view with giant tap targets.
6. **Personal records board**: Automatic PR detection and celebration.
7. **Progressive overload tracker**: Automated weekly volume comparison on dashboard.
8. **Async plan generation**: Plan generation is still synchronous (blocks 30-90s). Could be moved to background task with polling.
