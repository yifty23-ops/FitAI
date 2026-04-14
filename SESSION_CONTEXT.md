# FitAI — Session Context

> **Purpose**: Read this file at the start of every new chat to restore full project context.
> Updated after Onboarding V4 UX Redesign on 2026-04-14.

---

## What this project is

AI personal trainer with 3 subscription tiers (free/pro/elite) where the AI's persona, research depth, and programming sophistication change fundamentally at each tier. See CLAUDE.md for full architecture.

## Current state: All core features + AI-Driven Onboarding V3 DEPLOYED

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

**Plan generation bug fix (2026-04-13):**
Fixed 3 bugs causing "Plan generation failed" on every attempt:
1. Frontend timeout too short: `plan/loading/page.tsx` used default 30s timeout instead of `LONG_TIMEOUT_MS` (120s). Plan generation takes 30-110s (research + Claude plan call). Now passes `timeoutMs: LONG_TIMEOUT_MS`.
2. "Try Again" button broken: Button reset `started.current = false` but the `useEffect` depended on `[router]` (stable ref), so generation never re-triggered. Fixed with `attempt` state counter as useEffect dependency.
3. Unprotected collective query: `_attach_collective()` in `backend/tools/research.py` called `query_collective()` without try-catch. If collective query failed (e.g., JSONB access on empty table), entire research pipeline crashed. Now wrapped in try-catch with warning log.

---

## Onboarding V2 Redesign (2026-04-14) — DEPLOYED

### What changed and why
Research from sports science intake forms (NASM, NSCA), competitor apps (JuggernautAI, RP Hypertrophy, Caliber), and coaching best practices identified 17 missing profile fields critical for AI plan quality. The old 5-step onboarding (goal, body stats, experience, schedule, lifestyle) produced generic AI prompts. The new 6-step flow (8 for elite) collects training history depth, movement quality proxies, goal specificity, exercise preferences, and sport phasing — enabling the AI to make precise programming decisions like percentage-based loading, re-introduction phases, and volume ceilings.

### Files modified (10 total)

| File | Change |
|------|--------|
| `backend/migrations/005_onboarding_v2.sql` | **NEW FILE**. Adds 15 nullable columns to profiles table, 2 to users table, plus CHECK constraints. **APPLIED to Neon DB on 2026-04-14.** |
| `backend/models/profile.py` | Added 15 new Column definitions (training_age_years, training_recency, goal_sub_category, body_fat_est, goal_deadline, injury_ortho_history, current_pain_level, chair_stand_proxy, overhead_reach_proxy, training_days_specific, exercise_blacklist, protein_intake_check, current_max_bench/squat/deadlift). New imports: Boolean, Date, JSONB. |
| `backend/models/user.py` | Added sport_phase (String) + sport_weekly_hours (Integer) columns. Added Integer import. |
| `backend/routes/profile.py` | Full rewrite. 17 new Optional fields on ProfileCreate/ProfileResponse. New StrengthBenchmark Pydantic model. 7 new validation sets (VALID_TRAINING_RECENCY, VALID_GOAL_SUB_CATEGORY, VALID_BODY_FAT_EST, VALID_PROTEIN_INTAKE, VALID_SPORT_PHASE, VALID_WEEKDAYS). Expanded VALID_JOB_ACTIVITY to include "moderate" and "heavy_labor". Expanded stress_level from ge=1,le=5 to ge=1,le=10. days_per_week auto-derived from training_days_specific. injuries auto-populated from injury_ortho_history for backward compat. New helper functions _validate_optional_enum() and _validate_weekdays(). |
| `backend/tools/research.py` | compute_profile_hash now includes goal_sub_category, training_recency, current_pain_level, exercise_blacklist, body_fat_est in key_fields. profile_to_research_dict returns 30+ fields with safe defaults for all new data. |
| `backend/services/claude_client.py` | All 3 research prompts (FREE/PRO/ELITE) enriched with new profile fields. New TRAINING_RULES constant block with 14 mandatory programming rules + TRAINING_RULES_ELITE_SUFFIX with 4 sport-specific rules. Rules injected into all 3 plan prompts via two-stage template formatting (first injects rules, then formats with profile/research data). |
| `backend/tools/plan_generator.py` | _build_profile_snapshot captures all V2 fields (goal_sub_category, body_fat_est, goal_deadline, training_age_years, training_recency, training_days_specific, injury_ortho_history, current_pain_level, chair_stand_proxy, overhead_reach_proxy, exercise_blacklist, protein_intake_check, current_max_bench/squat/deadlift). |
| `backend/tools/adapt.py` | _compute_snapshot_hash mirrors research.compute_profile_hash with all V2 key fields (goal_sub_category, training_recency, current_pain_level, exercise_blacklist, body_fat_est, age_bucket, weight_bucket). |
| `frontend/src/components/OnboardingChat.tsx` | Complete rewrite. 8 steps (6 non-elite, 8 elite). New ProfileCreate interface with all V2 fields. New constants: GOAL_SUB_CATEGORIES (mapped per goal), BODY_FAT_RANGES, TRAINING_RECENCY_OPTIONS, WEEKDAYS, EXERCISE_BLACKLIST_OPTIONS, OCCUPATIONAL_DEMAND_OPTIONS, PROTEIN_OPTIONS, SPORT_PHASE_OPTIONS. Reusable CardButton/PillButton helpers. Strength benchmarks conditionally shown for Pro+ non-beginners. Mobility proxy yes/no toggles. Weekday multi-select replaces days_per_week number picker. Exercise blacklist grid. Storage key changed to `fitai_onboarding_v2`. |
| `frontend/src/app/settings/page.tsx` | Full rewrite. ProfileData interface expanded with all V2 fields. All new fields editable: goal_sub_category dropdown, body_fat_est dropdown, goal_deadline date picker, training_age_years number, training_recency dropdown, training_days_specific weekday toggles, injury_ortho_history textarea, current_pain_level slider, chair_stand_proxy/overhead_reach_proxy pass/fail toggles, exercise_blacklist multi-select, stress_level expanded to 1-10 slider, occupational_demand 4 options, protein_intake_check 3 options. Strength benchmarks shown for Pro+. Elite sport section with sport_phase dropdown and sport_weekly_hours. PillBtn helper component. |

### New onboarding step flow

| Step | Title | Fields | Tier |
|------|-------|--------|------|
| 1 | Your Destination | goal (4 cards), goal_sub_category (conditional), body_fat_est (5 ranges), goal_deadline (optional date) | All |
| 2 | Your Body & Experience | age, weight, height, sex, experience, training_age_years, training_recency, [Pro+ non-beginner: bench/squat/deadlift maxes] | All |
| 3 | Safety Screen | injury_ortho_history (textarea), current_pain_level (0-10 slider), chair_stand_proxy (yes/no), overhead_reach_proxy (yes/no) | All |
| 4 | Your Training Setup | training_days_specific (Mon-Sun multi-select), session_minutes, equipment | All |
| 5 | Recovery & Lifestyle | sleep_hours, stress_level (1-10), occupational_demand (4 options), protein_intake_check, diet_style | All |
| 6 | Preferences | exercise_blacklist (multi-select grid) | All |
| 7 | Sport Selection | sport (9 sport cards + Other) | Elite |
| 8 | Athlete Sync | sport_phase (3 cards), sport_weekly_hours, competition_date (optional) | Elite |

### 14 AI training rules (TRAINING_RULES block in claude_client.py)

These rules are injected into every plan generation prompt. They encode the data-to-prompt mapping from the Gemini research:

1. training_recency > 3mo → 2-week structural integrity re-intro phase
2. Strength benchmarks provided → Epley 1RM formula, percentage-based loading
3. current_pain_level > 3 → blacklist technical/heavy joint variations
4. chair_stand_proxy = false → no barbell back squats, use goblet/box squats
5. overhead_reach_proxy = false → no overhead pressing, use incline/landmine
6. goal_sub_category → fine-tune rep ranges (strength=3-5, hypertrophy=8-12, etc.)
7. body_fat_est → dictates surplus/deficit magnitude
8. occupational_demand = heavy_labor → reduce leg volume 20-30%
9. protein_intake_check = no → cap hypertrophy volume to maintenance
10. Sleep < 7h → weekly set ceiling 10/muscle group; sleep >= 8h → ceiling 16-20
11. Training days consecutive → Heavy-Light-Medium split; spread → full-body viable
12. exercise_blacklist → swap for biomechanically equivalent alternatives
13. goal_deadline → reverse-engineer periodization to peak on date
14. training_age_years + experience → set volume floor/ceiling

Plus 4 elite-specific rules: in-season 60% volume reduction, sport hours as total stress, <4wk competition power shift, <2wk taper.

### Backward compatibility

- All new DB columns nullable → existing profiles work without changes
- days_per_week column still populated (derived from training_days_specific.length)
- injuries column still populated (copied from injury_ortho_history)
- stress_level 1-5 values valid within new 1-10 range
- job_activity old values "sedentary"/"light"/"active" still valid; "moderate"/"heavy_labor" added
- profile_to_research_dict defaults all new fields ("unknown"/"none") → old profiles produce valid prompts
- profile_hash changes → cache miss for old profiles → fresh research (desirable)

---

## Onboarding V4 UX Redesign (2026-04-14) — DEPLOYED

### What changed and why

V3 had two problems: (1) the first question was a generic 4-card goal picker that didn't capture nuance or sport context, and (2) the UI looked clinical and cluttered — conversation history stacked up creating noise, progress dots were meaningless, field renderers looked like form widgets, and there was no visual warmth.

V4 replaces the goal picker with a free-text input ("What are you training for?"), redesigns the layout to show one question at a time with no history visible, adds tier-aware questioning depth so the AI collects exactly what it needs for each tier's plan quality, and upgrades all 10 field renderers with polished interactions.

### Architecture

```
User types goal in free text ("Get stronger for swimming")
  → Frontend classifies to enum (fat_loss/muscle/performance/wellness) via keyword regex
  → Frontend sends { goal, goal_description, tier } to POST /onboarding/next-question
  → Claude reads goal_description to personalize questions, uses tier-aware depth rules
  → Claude returns structured question JSON (field types, options, validation)
  → Frontend renders one question at a time (sticky header/footer, centered content)
  → AI decides when done — free ~5-7 questions, pro ~7-10, elite ~8-12
  → Frontend submits to existing POST /profile (no schema changes)
```

### Files modified/created (4 total)

| File | Change |
|------|--------|
| `frontend/src/lib/classifyGoal.ts` | **NEW FILE**. Keyword regex maps free-text goal to enum (fat_loss/muscle/performance/wellness). |
| `frontend/src/components/OnboardingChat.tsx` | **FULL REWRITE** (~650 lines). Welcome screen with free-text goal + suggestion chips. One-question-at-a-time layout. Sticky header (back + progress bar) + sticky footer (continue). 10 upgraded field renderers. Auto-advance on single-field steps. Fade-slide-up animations. Session key `fitai_onboarding_v4`. |
| `frontend/src/app/globals.css` | Added `fadeSlideUp` and `fadeIn` keyframe animations. |
| `backend/services/claude_client.py` | `ONBOARDING_SYSTEM` updated: goal marked as pre-collected, `goal_description` support, RULES replaced with TIER-AWARE QUESTIONING DEPTH. `generate_onboarding_question()` includes goal_description in user prompt. |

### Tier-aware questioning depth

The AI decides when it has enough information — no arbitrary cap. Depth scales with tier:

- **Free**: Required fields + 1-2 useful optionals. 5-7 questions. Groups 2-4 fields. Brisk.
- **Pro**: Required + actively pursue optionals (training history, body comp, pain/mobility). 7-10 questions. Groups 2-3.
- **Elite**: Everything relevant — sport phase, competition dates, weekly hours, strength benchmarks, weak points. 8-12 questions. Groups 1-3. Olympic-caliber profiling.

### UX design

- **Welcome screen**: "What are you training for?" + free-text textarea with rotating placeholders + 4 suggestion chips + "Let's go" gradient button
- **Question flow**: One question at a time, no conversation history shown (data kept for back navigation)
- **Sticky header**: Back chevron (44px touch target) + gradient progress bar (blue→cyan) + "Step N"
- **Sticky footer**: Continue button always visible, iOS safe-area padding
- **Animations**: fadeSlideUp on question transitions, staggered field appearance, contextual loading messages
- **Auto-advance**: 350ms delay on single-field single_select and yes_no steps
- **Soft safety valve**: "Finish setup" link at 20 questions (not forced)

### Field renderer upgrades

| Type | V3 | V4 |
|------|----|----|
| `single_select` | Plain card/pill buttons | Left accent bars, glow selection, auto-advance |
| `multi_select` | Pill row with text checkmarks | 2-column grid with SVG checkmarks, bodyweight toggle |
| `number` | Plain HTML number input | Large centered display + round stepper buttons (hold-to-repeat) |
| `text` | Basic input | Large rounded, auto-focus, Enter to submit |
| `textarea` | Text area + char count text | Auto-resize + color-coded progress bar |
| `slider` | Plain range with accent-blue | Custom gradient track + floating value bubble + stress color coding |
| `date` | Basic date input | Rounded container, same native picker |
| `day_picker` | Small pills in row | Round circles with glow, day count below |
| `yes_no` | Two small pills | Large two-card layout, green "Yes" tint, auto-advance |
| `strength_benchmarks` | Dense inline inputs | Three stacked cards per lift, centered inputs |

### What stays the same

- `POST /profile` endpoint unchanged — final submission uses same `ProfileCreate` schema
- `POST /onboarding/next-question` endpoint unchanged — same request/response schema
- Profile database model unchanged — no new columns
- Research prompts, plan generation, training rules, adaptation — all unchanged
- Settings page still allows editing all V2 profile fields
- 3-layer completeness safety net unchanged

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

6. **Profile input validation ADDED** (`backend/routes/profile.py`): Pydantic Field validators: age 13-120, weight 20-500, height 50-300, days_per_week 1-7, session_minutes 10-300, stress_level 1-10 (expanded from 1-5), injuries max 1000 chars, sport max 50 chars. Enum validation for goal, sex, experience, job_activity, diet_style + all V2 enum fields.

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

### New migration files

- `backend/migrations/004_unique_constraints_and_checks.sql` — **APPLIED to Neon DB**. 3 UNIQUE + 3 CHECK constraints.
- `backend/migrations/005_onboarding_v2.sql` — **APPLIED to Neon DB** (2026-04-14). 15 columns on profiles, 2 on users, 3 CHECK constraints. Note: the migration runner's `startswith('--')` filter skipped statements after comment lines — 8 missing columns were applied manually.

---

### API routes (32 route-methods as of 2026-04-14)

```
POST /auth/signup           — register (rate-limited 3/min, email validated+normalized, password min 8, tier always "free")
POST /auth/login            — authenticate (rate-limited 5/min, email normalized)
PUT  /auth/change-password  — change password (requires auth + current password)
GET  /user/tier             — get tier + features
GET  /user/me               — get user details from DB (tier, email, sport, features)

POST /profile               — upsert profile (rate-limited 3/min, validated bounds+enums including V2 fields, returns plan_stale flag)
GET  /profile               — get profile (includes all V2 fields + sport_phase/sport_weekly_hours for elite)

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

POST /onboarding/next-question — AI-driven onboarding question generation (rate-limited 10/min, completeness safety net)

POST /research/test    — test research (rate-limited 2/min)
GET  /                 — health check
```

### Frontend routes (11 pages)

```
/                                    — Landing: login/signup + tier cards
/onboarding                          — AI-driven onboarding V3 (dynamic questions from Claude, sessionStorage persisted as fitai_onboarding_v3)
/plan/loading                        — Plan generation with tier-specific progress messages
/plan/[id]                           — Plan detail with export, preview/activate banner
/dashboard                           — Main hub with logout, rest timer, next session, progress
/session/[planId]/[week]/[day]       — Session logging with rest timer, confirmation, prev-week comparison
/checkin/[planId]/[week]             — Weekly check-in with labeled scales, confirmation modal
/chat                                — Elite coach chat
/settings                            — Profile editing (all V2 fields), change password, tier display, logout
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

6. **`from __future__ import annotations`**: Used in `claude_client.py`, `test_research.py`, `plan_generator.py`, `tools/adapt.py`, `tools/collective.py`, `tools/chat.py`, `models/chat.py`, and `routes/plan.py`. **NOT used in**: `routes/auth.py`, `routes/profile.py` (was removed due to FastAPI body param bug). Avoid adding it to route files with Pydantic body params + `request: Request`.

7. **`research_for_profile` is synchronous**: Not async despite spec. The route handler is sync and SQLAlchemy session isn't async, so keeping it synchronous is correct.

8. **`slowapi` (extra dependency)**: Added for rate limiting. Not in original CLAUDE.md spec but essential for security.

9. **`settings/page.tsx`, `calendar/page.tsx`, `error.tsx` (extra frontend files)**: Not in original Phase 1 directory structure spec. Added during improvement sweep for account management, training calendar, and error handling.

10. **`RestTimer.tsx`, `Celebration.tsx` (extra components)**: Not in original component list. Added for gym UX improvements.

11. **`003_indexes_and_cascade.sql`, `004_unique_constraints_and_checks.sql`, `005_onboarding_v2.sql` (extra migrations)**: Not in original migration plan. 003 adds performance indexes and CASCADE constraints. 004 adds UNIQUE + CHECK constraints. 005 adds onboarding V2 profile columns. **All applied to Neon DB.**

---

## File tree (65 source files as of 2026-04-14)

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
│   │   ├── user.py                    # User: +sport_phase, +sport_weekly_hours (V2)
│   │   ├── profile.py                 # Profile: +15 V2 columns (training_age_years, training_recency, goal_sub_category, body_fat_est, goal_deadline, injury_ortho_history, current_pain_level, chair_stand_proxy, overhead_reach_proxy, training_days_specific, exercise_blacklist, protein_intake_check, current_max_bench/squat/deadlift)
│   │   ├── research_cache.py, plan.py
│   │   ├── session.py, checkin.py, adaptation.py, collective.py, chat.py
│   ├── routes/
│   │   ├── __init__.py                # Empty
│   │   ├── auth.py                    # Signup (tier forced free), login (email normalized), change-password, /me, /tier. NO from __future__ import annotations.
│   │   ├── profile.py                 # POST upsert (rate-limited, all V2 fields, StrengthBenchmark model, expanded validation), GET (returns all V2 fields)
│   │   ├── plan.py                    # generate (rate-limited, concurrent lock), list, active, detail, confirm, delete, adapt (tier_at_creation), adaptations
│   │   ├── research.py                # POST /test (rate-limited)
│   │   ├── session.py                 # POST (rate-limited, week/day bounds, UNIQUE), PUT (rate-limited, 24h), GET list, GET week
│   │   ├── checkin.py                 # POST (rate-limited, week bounds, UNIQUE+IntegrityError, atomic advance), GET
│   │   ├── collective.py              # POST donate (rate-limited, validated), GET stats
│   │   ├── chat.py                    # POST (rate-limited, sanitized), GET (tier-gated)
│   │   └── onboarding.py             # POST /next-question (AI-driven onboarding, rate-limited 10/min, completeness safety net)
│   ├── tools/
│   │   ├── __init__.py                # Empty
│   │   ├── research.py                # sanitize_for_prompt(), compute_profile_hash (V2 fields in key), profile_to_research_dict (30+ fields), research_for_profile, _attach_collective
│   │   ├── plan_generator.py          # generate_plan_for_profile (V2 profile snapshot), _build_profile_snapshot (all V2 fields)
│   │   ├── adapt.py                   # adapt_plan (uses plan.tier_at_creation), _compute_snapshot_hash (V2 key fields synced with research.py)
│   │   ├── collective.py              # donate_result + query_collective (sport-aware 3-tier query)
│   │   └── chat.py                    # build_coach_context (sanitized notes), get_conversation_history, apply_chat_modifications
│   ├── services/
│   │   ├── __init__.py                # Empty
│   │   └── claude_client.py           # ClaudeClient (V2 enriched research prompts + TRAINING_RULES block in plan prompts + adapt + chat + ONBOARDING_SYSTEM prompt + generate_onboarding_question, httpx timeout, retry guard, prompt caching)
│   └── migrations/
│       ├── 001_phase1.sql             # All 8 CREATE TABLE statements (APPLIED)
│       ├── 002_phase8_chat.sql        # chat_messages table + indexes (APPLIED)
│       ├── 003_indexes_and_cascade.sql # 8 indexes + CASCADE constraints (APPLIED)
│       ├── 004_unique_constraints_and_checks.sql # 3 UNIQUE + 3 CHECK constraints (APPLIED)
│       └── 005_onboarding_v2.sql      # 15 profile columns + 2 user columns + 3 CHECK constraints (APPLIED)
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
│       │   ├── settings/page.tsx      # Settings V2: all profile fields (V2), strength benchmarks (Pro+), sport phase (Elite), change password, tier display, logout
│       │   ├── calendar/page.tsx      # Training calendar: week-by-week
│       │   ├── session/[planId]/[week]/[day]/page.tsx  # Session logging
│       │   ├── checkin/[planId]/[week]/page.tsx         # Weekly check-in
│       │   └── plan/
│       │       ├── loading/page.tsx   # Plan generation: animated progress, 120s timeout, retry with attempt counter
│       │       └── [id]/page.tsx      # Plan detail: preview/activate, export
│       ├── components/
│       │   ├── OnboardingChat.tsx     # V3: AI-driven dynamic onboarding (Claude generates questions), 10 field type renderers, CardButton/PillButton helpers, conversation history, back support, sessionStorage key "fitai_onboarding_v3", 15-question hard cap
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
- **Migrations applied**: 001, 002, 003, 004, 005. All applied to Neon DB.
- **profiles table**: 32 columns (17 original + 15 V2). **users table**: 10 columns (8 original + 2 V2).

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
8. **Async plan generation**: Plan generation is still synchronous (blocks 30-90s). Frontend now uses 120s timeout which is sufficient, but could be moved to background task with polling for better UX.
9. **Account lockout**: No lockout after failed login attempts (only rate-limited 5/min).
10. **Frontend AbortController cleanup on unmount**: Timeouts added to `api.ts` but individual page useEffect hooks don't yet pass AbortController signals for cleanup on navigation.
11. **ANTHROPIC_API_KEY**: Still a placeholder in `.env`. AI features (research, plan generation, adaptation, chat) will fail until a real key is provided.

---

## What has been tested locally (2026-04-14)

- Backend starts cleanly with 32 routes (verified after AI-Driven Onboarding V3 — includes POST /onboarding/next-question)
- Frontend builds with zero TypeScript errors, all 11 pages generate (verified after Onboarding V3 rewrite)
- Signup: tier spoofing blocked (sends `elite`, gets `free`)
- Login: email normalization works (`" TEST-HACK@EXAMPLE.COM "` matches lowercase DB entry)
- Profile: age=-5 rejected (ge=13), goal="INJECT_HACK" rejected (enum validation)
- Profile: valid profile creates successfully
- Security headers present on all responses (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
- `sanitize_for_prompt()` strips `{}` from injection attempts
- `build_elite_persona()` strips special chars from freetext sport names
- All DB constraints (UNIQUE, CHECK) applied and verified on Neon (migrations 001-005)
- Migration 005 applied to Neon DB — all 17 new columns + 3 CHECK constraints verified present (profiles: 32 columns, users: 10 columns)
- POST /profile with all V2 fields returns 200 with correct data (tested via curl: goal_sub_category, body_fat_est, training_days_specific, injury_ortho_history, exercise_blacklist, etc.)
- GET /profile returns all 34 fields including V2 data
- Backward compatibility verified: injuries auto-populated from injury_ortho_history, days_per_week auto-derived from training_days_specific length
- All frontend pages return HTTP 200 (/onboarding, /settings, /dashboard, /plan/loading, etc.)
- **Browser testing of V3 AI-driven onboarding PENDING** — backend endpoint and frontend component verified (imports, build, routes), but full interactive flow with Claude API needs manual browser walkthrough with valid ANTHROPIC_API_KEY
