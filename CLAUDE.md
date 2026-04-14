# FitAI — CLAUDE.md

## What this is
AI personal trainer with tiered coaching quality. Free users get a solid plan from Claude's training knowledge. Pro users get evidence-based plans backed by real research. Elite users get a sport-specific Olympic-caliber coach who periodizes around their competition schedule.

The quality gap between tiers is NOT just features unlocked — the AI's persona, research depth, and programming sophistication change fundamentally at each tier.

## Tech stack (no alternatives, no substitutions)
- Frontend: Next.js 14 App Router, TypeScript, Tailwind
- Backend: FastAPI, SQLAlchemy, Python 3.11+
- DB: PostgreSQL on Neon
- AI: Claude API claude-sonnet-4-20250514 — all calls via `backend/services/claude_client.py`
- Auth: JWT in localStorage, bcrypt password hashing
- Email: Resend API
- Deploy: Vercel (frontend) + Railway (backend)

Do NOT use: Prisma, tRPC, NextAuth, any ORM besides SQLAlchemy, any state management library.

## Environment variables
```
# backend/.env
DATABASE_URL=postgresql://...@...neon.tech/fitai
ANTHROPIC_API_KEY=sk-ant-...
RESEND_API_KEY=re_...
JWT_SECRET=<random-64-char>
FRONTEND_URL=http://localhost:3000
STRIPE_SECRET_KEY=sk_...          # for subscription billing
STRIPE_WEBHOOK_SECRET=whsec_...

# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_STRIPE_KEY=pk_...
```

---

## Tier system — the core product architecture

### Tier definitions
```
FREE:
  - Persona: "certified personal trainer"
  - Research: NO web search — Claude uses training knowledge only
  - Periodization: 4-week linear blocks
  - Plan limit: 1 active plan, 1 generation per month
  - Adaptation: NONE
  - Collective learning: NONE
  - Coach chat: NONE
  - Sport-specific: NO

PRO:
  - Persona: "world-class strength and conditioning coach"
  - Research: full web search (PubMed, meta-analyses)
  - Periodization: 8-12 week mesocycles with proper phasing
  - Plan limit: unlimited
  - Adaptation: weekly after check-in
  - Collective learning: YES (contribute + benefit)
  - Coach chat: NONE
  - Sport-specific: NO

ELITE:
  - Persona: dynamically generated sport-specific Olympic-level coach
  - Research: deep sport-specific search (more queries, sport databases)
  - Periodization: full competition-peaking model with target date
  - Plan limit: unlimited
  - Adaptation: weekly + on-demand
  - Collective learning: YES + priority sport-matched data
  - Coach chat: YES (full context awareness)
  - Sport-specific: YES
```

### Persona system (how tier changes the AI)

The system prompt is constructed dynamically based on tier + sport:

```python
PERSONAS = {
    "free": "You are a certified personal trainer with solid foundational knowledge. You give safe, effective programming based on established training principles. Keep recommendations straightforward and proven.",

    "pro": "You are a world-class strength and conditioning coach with 20+ years of experience training athletes from recreational to national level. You base every decision on current sports science literature. Your programming is precise — specific loads, specific RPE targets, specific progression schemes. You never say 'moderate weight' or 'appropriate intensity.'",

    "elite": None  # dynamically generated — see build_elite_persona()
}

SPORT_DEMANDS = {
    "swimming": "shoulder stability and mobility, rotational core power, lat and posterior chain strength, kick power through hip flexor and quad development, and the critical balance between dryland training and pool volume. You understand taper protocols for competition peaks and how to periodize strength work around high-yardage training blocks.",
    "running": "lower limb strength-endurance, injury-resilient posterior chain, plyometric capacity, running economy through force production, and the balance between strength training and running volume. You understand periodization around race calendars and the taper-to-peak cycle.",
    "powerlifting": "competition squat/bench/deadlift specificity, peaking and attempt selection, weak point identification, accessory programming for structural balance, and meet-day preparation. You understand Sheiko, Westside, conjugate, and block periodization models and when each applies.",
    "crossfit": "concurrent development of strength, gymnastics capacity, and metabolic conditioning. You understand competitive CrossFit programming, engine building, skill acquisition prioritization, and how to peak for the Open or Quarterfinals.",
    "basketball": "explosive power, lateral agility, vertical leap development, injury prevention for ankles and knees, and in-season load management. You understand how to maintain strength during a competitive season without compromising game performance.",
    "soccer": "repeated sprint ability, lower body power, hamstring injury prevention, aerobic and anaerobic capacity, and in-season load management. You understand GPS data-informed training and how to balance gym work with pitch sessions.",
    "tennis": "rotational power, shoulder durability, lateral movement capacity, anti-rotation core strength, and tournament-schedule periodization. You understand the unique demands of a sport with no off-season and frequent travel.",
    "mma": "strength-to-weight optimization, grip and neck strength, power endurance, fight-camp periodization, and weight-cut preparation. You understand how to peak strength and conditioning for a specific fight date while managing sparring load.",
    "cycling": "leg strength-endurance, power-to-weight ratio, core stability for aero position, and the balance between gym work and on-bike volume. You understand FTP-based training zones and how strength training transfers to cycling power.",
    "general": "broad physical preparedness, injury resilience, and progressive overload for lifelong health. You emphasize movement quality and sustainable programming."
}

def build_elite_persona(sport: str) -> str:
    demands = SPORT_DEMANDS.get(sport, SPORT_DEMANDS["general"])
    return (
        f"You are an elite {sport} strength and conditioning coach who has "
        f"trained multiple athletes at the Olympic or professional level. "
        f"You understand the specific physical demands of {sport}: {demands} "
        f"Your programming reflects decades of experience at the highest level. "
        f"Every exercise choice, volume prescription, and intensity target is "
        f"justified by how it transfers to {sport} performance. You never "
        f"program generic 'gym bro' training — everything serves the sport."
    )
```

### Feature gating logic
```python
TIER_FEATURES = {
    "free":  {"web_search": False, "adaptation": False, "collective": False, "coach_chat": False, "sport_specific": False, "max_plans_per_month": 1,  "max_mesocycle_weeks": 4},
    "pro":   {"web_search": True,  "adaptation": True,  "collective": True,  "coach_chat": False, "sport_specific": False, "max_plans_per_month": -1, "max_mesocycle_weeks": 12},
    "elite": {"web_search": True,  "adaptation": True,  "collective": True,  "coach_chat": True,  "sport_specific": True,  "max_plans_per_month": -1, "max_mesocycle_weeks": 16},
}

def check_feature(user: User, feature: str) -> bool:
    return TIER_FEATURES[user.tier].get(feature, False)

def check_plan_limit(user: User, db: Session) -> bool:
    limit = TIER_FEATURES[user.tier]["max_plans_per_month"]
    if limit == -1:
        return True
    count = db.query(Plan).filter(
        Plan.user_id == user.id,
        Plan.created_at >= datetime.now() - timedelta(days=30)
    ).count()
    return count < limit
```

---

## Directory structure — PHASE 1 ONLY
Do NOT create files for future phases.

```
fitai/
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── globals.css                 # Tailwind base + print-friendly export styles
│   │   ├── error.tsx                   # Global error boundary
│   │   ├── page.tsx                    # landing + login/signup + tier selection
│   │   ├── onboarding/page.tsx         # conversational intake
│   │   ├── dashboard/page.tsx          # main hub: next session, progress, quick actions
│   │   ├── settings/page.tsx           # profile editing, change password, tier, logout
│   │   ├── calendar/page.tsx           # week-by-week training calendar
│   │   ├── chat/page.tsx              # elite-only AI coach chat
│   │   ├── plan/loading/page.tsx       # plan generation with progress animation
│   │   ├── plan/[id]/page.tsx          # plan view with export
│   │   ├── session/[planId]/[week]/[day]/page.tsx  # session logging with rest timer
│   │   └── checkin/[planId]/[week]/page.tsx         # weekly check-in
│   ├── components/
│   │   ├── OnboardingChat.tsx          # AI-driven dynamic onboarding (V3), 10 field type renderers
│   │   ├── PlanView.tsx                # week-by-week plan display
│   │   ├── NutritionPanel.tsx          # macro targets display with empty state
│   │   ├── PeriodizationBar.tsx        # visual arc of mesocycle phases with legend
│   │   ├── TierGate.tsx               # shows upgrade prompt for locked features
│   │   ├── WeekProgressDots.tsx        # session + check-in progress dots
│   │   ├── RestTimer.tsx              # countdown timer with vibration
│   │   └── Celebration.tsx            # animated success overlay
│   ├── lib/
│   │   ├── api.ts                      # fetch wrapper for backend calls
│   │   ├── auth.ts                     # JWT helpers + fetchUserMe() for server-verified tier
│   │   └── tiers.ts                    # tier feature checks (mirrors backend)
│   └── package.json
├── backend/
│   ├── main.py                         # FastAPI app + CORS + slowapi rate limiter
│   ├── config.py                       # env vars via pydantic BaseSettings
│   ├── database.py                     # engine (pooled), SessionLocal, Base, get_db
│   ├── tiers.py                        # PERSONAS, SPORT_DEMANDS, TIER_FEATURES, gating logic
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py, profile.py, research_cache.py, plan.py
│   │   ├── session.py, checkin.py, adaptation.py, collective.py, chat.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── auth.py                     # signup, login, change-password, /user/me, /user/tier + rate limiting
│   │   ├── profile.py                  # POST /profile (with plan_stale), GET /profile
│   │   ├── plan.py                     # generate, list, active, detail, confirm, delete, adapt, adaptations
│   │   ├── session.py                  # POST create, PUT edit (24h), GET list, GET week
│   │   ├── checkin.py                  # POST (with row-lock), GET + maybe_advance_week
│   │   ├── onboarding.py               # POST /next-question (AI-driven onboarding, completeness safety net)
│   │   ├── collective.py, chat.py, research.py
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── research.py                 # tier-aware research (cache hash includes age/weight buckets)
│   │   ├── plan_generator.py           # tier-aware plan generation
│   │   ├── adapt.py                    # weekly adaptation (history limited to 5)
│   │   ├── collective.py              # milestone donation + collective query
│   │   └── chat.py                    # coach chat context + modifications
│   ├── services/
│   │   ├── __init__.py
│   │   └── claude_client.py            # ClaudeClient with httpx timeout + onboarding question generation
│   ├── migrations/
│   │   ├── 001_phase1.sql
│   │   ├── 002_phase8_chat.sql
│   │   └── 003_indexes_and_cascade.sql
│   ├── requirements.txt                # includes slowapi
│   └── .env
└── CLAUDE.md
```

---

## Database schema — PHASE 1 TABLES

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  tier TEXT NOT NULL DEFAULT 'free',         -- 'free' | 'pro' | 'elite'
  sport TEXT,                                 -- NULL for free/pro, required for elite
  competition_date DATE,                      -- NULL unless elite + competing
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  goal TEXT NOT NULL,
  age INT,
  weight_kg FLOAT,
  height_cm FLOAT,
  sex TEXT NOT NULL,
  experience TEXT NOT NULL,
  days_per_week INT,
  session_minutes INT,
  equipment TEXT[],
  injuries TEXT,
  sleep_hours FLOAT,
  stress_level INT,
  job_activity TEXT,
  diet_style TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_hash TEXT NOT NULL,
  tier TEXT NOT NULL,                          -- cache is tier-specific (different depth)
  protocols JSONB NOT NULL,
  contraindications JSONB NOT NULL,
  sources TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_hash, tier)                  -- same profile, different tier = different cache
);

CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  tier_at_creation TEXT NOT NULL,             -- lock in tier so downgrades don't break plan
  profile_snapshot JSONB NOT NULL,
  mesocycle_weeks INT DEFAULT 8,
  current_week INT DEFAULT 1,
  phase TEXT DEFAULT 'accumulation',
  plan_data JSONB NOT NULL,
  nutrition JSONB NOT NULL,
  persona_used TEXT,                          -- store which persona generated this
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  milestone_pending BOOLEAN DEFAULT false
);

-- Phase 5+ tables (create now, populate later)
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id),
  user_id UUID REFERENCES users(id),
  week_number INT NOT NULL,
  day_number INT NOT NULL,
  pre_readiness JSONB,
  logged_exercises JSONB,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE weekly_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id),
  user_id UUID REFERENCES users(id),
  week_number INT NOT NULL,
  recovery_score INT,
  mood_score INT,
  sleep_avg FLOAT,
  weight_kg FLOAT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE collective_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_hash TEXT NOT NULL,
  sport TEXT,                                 -- for sport-matched collective queries
  plan_config JSONB NOT NULL,
  outcome JSONB NOT NULL,
  success_score FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE adaptation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES plans(id),
  week_number INT NOT NULL,
  assessment TEXT,
  adjustments JSONB NOT NULL,
  flags JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Types — use these exactly

### ProfileCreate (frontend sends, backend receives)
```typescript
interface ProfileCreate {
  goal: "fat_loss" | "muscle" | "performance" | "wellness";
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female";
  experience: "beginner" | "intermediate" | "advanced";
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
  injuries: string | null;
  sleep_hours: number;
  stress_level: 1 | 2 | 3 | 4 | 5;
  job_activity: "sedentary" | "light" | "active";
  diet_style: "omnivore" | "vegetarian" | "vegan" | "keto" | "halal" | "other";
  // Elite only:
  sport?: string;                    // from SPORT_DEMANDS keys
  competition_date?: string | null;  // ISO date string
}
```

### profile_hash computation (now tier-aware)
```python
def compute_profile_hash(p: Profile, tier: str) -> str:
    key_fields = {
        "goal": p.goal,
        "sex": p.sex,
        "experience": p.experience,
        "equipment": sorted(p.equipment),
        "injuries": p.injuries or "",
        "days_per_week": p.days_per_week,
    }
    raw = json.dumps(key_fields, sort_keys=True) + f":{tier}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
```

### PlanData, NutritionData, Exercise — UNCHANGED from previous version
(See PlanData, PeriodWeek, TrainingDay, Exercise, NutritionData, MacroTargets types.
These remain identical regardless of tier — the STRUCTURE is the same,
but the QUALITY and SPECIFICITY of the content scales with tier.)

### ResearchResult — UNCHANGED
(Same schema. Free tier produces shallower results. Elite produces deeper, sport-specific results.
The structure is identical — the content quality scales.)

---

## AI implementation — tier-aware

### claude_client.py
```python
class ClaudeClient:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = "claude-sonnet-4-20250514"

    def research(self, profile: dict, tier: str, sport: str | None = None) -> dict:
        system = self._build_research_system(tier)
        prompt = self._build_research_prompt(profile, tier, sport)

        if tier == "free":
            # NO web search — Claude uses training knowledge only
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                messages=[{"role": "user", "content": prompt}],
                system=system
            )
        else:
            # Pro + Elite: web search enabled
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": prompt}],
                system=system
            )
        return self._extract_json(response)

    def generate_plan(self, profile: dict, research: dict, tier: str, sport: str | None, competition_date: str | None) -> dict:
        system = self._build_plan_system(tier, sport)
        prompt = self._build_plan_prompt(profile, research, tier, sport, competition_date)
        response = self.client.messages.create(
            model=self.model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
            system=system
        )
        return self._extract_json(response)

    def _build_research_system(self, tier: str) -> str:
        if tier == "free":
            return "You are a certified personal trainer. Based on your training knowledge, recommend protocols. Return ONLY valid JSON. No web search needed."
        elif tier == "pro":
            return "You are a sports science researcher. Use web search to find evidence-based protocols from PubMed, NSCA, and meta-analyses. Return ONLY valid JSON."
        else:  # elite
            return "You are an elite sports science researcher specializing in high-performance athlete preparation. Use web search extensively — search PubMed, sport-specific journals, and elite coaching resources. Find protocols used at Olympic/professional level. Return ONLY valid JSON."

    def _build_plan_system(self, tier: str, sport: str | None) -> str:
        if tier == "elite" and sport:
            persona = build_elite_persona(sport)
        else:
            persona = PERSONAS[tier]
        return persona + "\nGenerate a complete training plan. Return ONLY valid JSON matching PlanData + NutritionData schemas. No preamble."

    def _extract_json(self, response) -> dict:
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text = block.text
        clean = text.strip().removeprefix("```json").removesuffix("```").strip()
        return json.loads(clean)
```

### Research prompts by tier

```python
RESEARCH_PROMPT_FREE = """Based on your knowledge of exercise science, recommend protocols for:
- Goal: {goal}
- Sex: {sex}, Age: {age}, Experience: {experience}
- Training: {days_per_week}x/week, {session_minutes} min
- Equipment: {equipment}
- Limitations: {injuries}

Return this EXACT JSON:
{{
  "protocols": {{
    "weekly_volume": "sets per muscle group per week",
    "frequency": "sessions per muscle group per week",
    "intensity_range": "%1RM or RPE range",
    "rep_ranges": "ranges with rationale",
    "rest_periods": "seconds for compounds vs isolations",
    "progression_model": "specific method",
    "exercise_priorities": ["ordered list"],
    "periodization_style": "model description"
  }},
  "contraindications": ["risks for this profile"],
  "sources": ["general training principles applied"]
}}
"""

RESEARCH_PROMPT_PRO = """Find optimal training protocols for this person:
- Goal: {goal}
- Sex: {sex}, Age: {age}, Weight: {weight_kg}kg, Height: {height_cm}cm
- Experience: {experience} ({experience_detail})
- Training: {days_per_week}x/week, {session_minutes} min
- Equipment: {equipment}
- Limitations: {injuries}

Search for: "{goal} training protocol {experience} evidence-based"
Then: "optimal training volume {goal} meta-analysis"
Then: "periodization model {experience} {days_per_week} days"

Synthesize into this EXACT JSON:
{{same schema as above}}

BAD: {{"weekly_volume": "moderate volume"}}
GOOD: {{"weekly_volume": "12-18 sets per muscle group per week, per Schoenfeld et al. (2017) dose-response meta-analysis"}}
"""

RESEARCH_PROMPT_ELITE = """Find ELITE-LEVEL training protocols for a competitive {sport} athlete:
- Goal: {goal}
- Sex: {sex}, Age: {age}, Weight: {weight_kg}kg, Height: {height_cm}cm
- Experience: {experience}
- Training: {days_per_week}x/week, {session_minutes} min (dryland/gym only)
- Equipment: {equipment}
- Limitations: {injuries}
- Competition date: {competition_date}

Search for: "{sport} strength conditioning elite athlete protocol"
Then: "{sport} periodization competition peaking model"
Then: "{sport} injury prevention evidence-based"
Then: "Olympic {sport} S&C programme structure"

This athlete needs programming that TRANSFERS TO {sport} PERFORMANCE.
Every exercise must have a sport-specific justification.

Return this EXACT JSON:
{{
  "protocols": {{
    "weekly_volume": "...",
    "frequency": "...",
    "intensity_range": "...",
    "rep_ranges": "...",
    "rest_periods": "...",
    "progression_model": "...",
    "exercise_priorities": ["sport-specific ordered list"],
    "periodization_style": "...",
    "sport_specific_notes": "how this transfers to {sport}",
    "competition_peaking": "taper/peak strategy for {competition_date}"
  }},
  "contraindications": ["sport-specific injury risks"],
  "sources": ["Author et al. (Year) — finding"]
}}

BAD: {{"exercise_priorities": ["Bench Press", "Squat", "Deadlift"]}}
GOOD for swimming: {{"exercise_priorities": ["Pull-ups (lat strength for catch phase)", "Single-arm dumbbell row (rotational pull patterning)", "Romanian deadlift (posterior chain for starts/turns)", "Pallof press (anti-rotation core for stroke stability)"]}}
"""
```

### Plan generation prompts by tier

```python
PLAN_PROMPT_FREE = """Generate a basic {mesocycle_weeks}-week training plan.
PROFILE: {profile}
PROTOCOLS: {research}

Keep it simple and effective. 4-week blocks, straightforward progression.
Return JSON with "plan" and "nutrition" keys.

BAD: {{"load_instruction": "moderate weight"}}
GOOD: {{"load_instruction": "RPE 7-8, increase weight when all reps completed"}}
"""

PLAN_PROMPT_PRO = """Generate a complete {mesocycle_weeks}-week periodized plan.
PROFILE: {profile}
RESEARCH: {research}

Requirements:
1. Proper periodization: accumulation → intensification → deload → peak
2. Each exercise: specific load_instruction, RPE targets, 2-3 swap_options
3. Nutrition: TDEE-based, training vs rest day macros
4. rationale: explain programming choices for THIS person

BAD: {{"load_instruction": "moderate weight"}}
GOOD: {{"load_instruction": "start at 70% 1RM, add 2.5kg when 10 reps hit on all sets at RPE <8"}}
"""

PLAN_PROMPT_ELITE = """Generate an elite {mesocycle_weeks}-week plan for a competitive {sport} athlete.
PROFILE: {profile}
RESEARCH: {research}
COMPETITION DATE: {competition_date}

Requirements:
1. EVERY exercise must transfer to {sport} performance — justify each choice
2. Periodization must peak for competition date (reverse-engineer from {competition_date})
3. Phase structure: GPP → sport-specific → pre-competition → taper → peak
4. Account for sport training volume (this is SUPPLEMENTAL to their {sport} training)
5. Include sport-specific warmup/activation protocols
6. Injury prevention exercises for {sport}-specific risk areas
7. Load and volume must respect the athlete's total training stress (sport + gym combined)

BAD: {{"label": "Upper Body Day", "focus": "chest and back"}}
GOOD for swimming: {{"label": "Pull-Dominant + Rotational Core", "focus": "lat strength for catch phase, anti-rotation stability for stroke efficiency, shoulder pre-hab"}}
"""
```

---

## Onboarding flow — AI-driven (V4)

The onboarding is fully AI-driven with a free-text goal input and tier-aware questioning depth.

```
1. Welcome screen: user types goal in free text ("Get stronger for swimming", "Lose 10kg before summer")
2. Frontend classifies goal to enum (fat_loss/muscle/performance/wellness) via keyword regex
3. Frontend sends { goal, goal_description, tier } to POST /onboarding/next-question
4. Claude generates the next question with structured JSON (field types, options, validation)
5. Frontend renders polished UI components based on field type (one question at a time, no history shown)
6. AI decides when it has enough info — question count varies by tier (free ~5-7, pro ~7-10, elite ~8-12)
7. Frontend submits to existing POST /profile (no schema changes)
```

### How Claude adapts the conversation
- Uses `goal_description` free text to personalize questions (mentions sport → sport questions early, mentions deadline → timeline questions)
- Injury/pain mentioned → safety questions follow up naturally
- Beginner → strength benchmarks skipped
- Elite tier → sport phase, competition date, weekly hours woven in contextually
- Field grouping scales with tier: free groups 2-4, pro groups 2-3, elite groups 1-3

### Tier-aware questioning depth
- **Free**: Collect required fields + 1-2 useful optionals. Brisk, basic plan fast.
- **Pro**: All required + actively pursue optionals (training history, body comp, pain/mobility). Evidence-based depth.
- **Elite**: Collect everything. Sport demands, competition timeline, training history, limitations. Olympic-caliber profiling.
- AI signals done only when it genuinely has enough for the best plan that tier can produce.

### Completeness safety net (3 layers)
1. System prompt checklist — Claude never signals done while required fields missing
2. Backend validation — overrides premature "done", asks for missing fields
3. Frontend pre-submission — deterministic profile_data builder from raw answers

### Supported field types (10)
single_select, multi_select, number, text, textarea, slider, date, day_picker, yes_no, strength_benchmarks

### UX design
- Welcome screen with free-text goal input, rotating placeholders, suggestion chips
- One-question-at-a-time layout (no conversation history shown, data kept for back navigation)
- Sticky header (back button + progress bar + step counter), sticky footer (continue button)
- Fade-slide-up animations between questions, staggered field appearance
- Auto-advance on single-field single_select and yes_no steps (350ms delay)
- Field renderers: stepper +/- for numbers, circle day picker, glow selections, gradient slider with value bubble
- Soft safety valve at 20 questions (escape hatch link, not forced completion)

### Session persistence
Key: `fitai_onboarding_v4` in sessionStorage. Survives page refresh. 24h expiry.

---

## API routes — updated (32 route-methods as of 2026-04-14)

### Auth
```
POST /auth/signup
  Body: { email (validated), password (min 8 chars), tier?: "free"|"pro"|"elite" }
  Rate limit: 3/min/IP
  Returns: { token, user_id, tier }

POST /auth/login
  Body: { email, password }
  Rate limit: 5/min/IP
  Returns: { token, user_id, tier }

PUT /auth/change-password
  Auth required
  Body: { current_password, new_password (min 8 chars) }
  Returns: { detail: "Password changed" }
```

### User
```
GET /user/tier
  Returns: { tier, features: TIER_FEATURES[tier] }

GET /user/me
  Returns: { user_id, email, tier, sport, features }
  Used by frontend to verify tier from DB (not JWT)
```

### Plan
```
POST /plan/generate
  Rate limit: 2/min/IP
  Checks: tier plan limit, profile exists
  Creates plan as DRAFT (is_active=False). Cleans up previous drafts.
  Returns: { plan_id, plan, nutrition, persona_used }

GET /plan/
  Paginated: skip, limit (default 20)
  Returns lightweight plan list

GET /plan/active
  Returns active plan with milestone_pending flag

GET /plan/{plan_id}
  Returns full plan detail

POST /plan/{plan_id}/confirm
  Activates a draft plan, deactivates others

DELETE /plan/{plan_id}
  Deletes draft plan only (400 if active)

POST /plan/{plan_id}/adapt
  Pro/elite only (403 for free). Tier downgrade guarded.

GET /plan/{plan_id}/adaptations
  Adaptation history
```

### Session
```
POST /session/{plan_id}/{week}/{day}
  Validates non-empty (at least one set with reps>0 or weight>0)
  Input bounds: reps 0-999, weight 0-1000, RPE 1-10

PUT /session/{plan_id}/{week}/{day}
  Edit session within 24 hours of completion

GET /session/{plan_id}          — paginated
GET /session/{plan_id}/{week}   — week sessions
```

### Check-in
```
POST /checkin/{plan_id}/{week}
  Score bounds: recovery/mood 1-10, sleep 0-24, weight 20-500

GET /checkin/{plan_id}          — paginated
```

### Chat
```
POST /chat/
  Elite only. Rate limit: 10/min. Message max 5000 chars.

GET /chat/{plan_id}             — paginated history
```

### Collective
```
POST /collective/{plan_id}/donate
GET /collective/stats           — public, no auth
```

### Onboarding
```
POST /onboarding/next-question
  Auth required. Rate limit: 10/min.
  Body: { answers_so_far: dict, tier: string, force_complete?: bool }
  Returns: { done: bool, message: string, fields: OnboardingField[], profile_data?: dict }
  Completeness safety net: validates required fields before allowing done=true
```

### Tier management (NOT YET IMPLEMENTED)
```
POST /user/upgrade
  Body: { tier: "pro"|"elite", stripe_payment_method_id: string }
  Side effects: Stripe subscription, update user.tier
  Returns: { tier, features }
  NOTE: Stripe integration not built yet. Config exists but no code.
```

---

## Anti-patterns — NEVER do these

### Code
- NEVER create files for future phases
- NEVER add a utils/ or helpers/ directory
- NEVER install shadcn — use raw Tailwind
- NEVER use `any` type in TypeScript
- NEVER add loading skeleton libraries or toast libraries
- NEVER create more than 25 files total in Phase 1
- NEVER use React context for auth — just a simple hook reading localStorage
- NEVER hardcode tier checks — always use check_feature() from tiers.py

### AI
- NEVER generate a plan without running research first (even free tier runs research, just without web search)
- NEVER skip profile_hash cache check before research
- NEVER store raw Claude response — parse to typed schema, discard the rest
- NEVER call Claude API from frontend or from route handlers — always through claude_client.py
- NEVER let the research prompt run without BAD/GOOD examples
- NEVER use the same persona/prompt for different tiers — the quality gap IS the product
- NEVER give free tier the pro/elite prompt — that's the value proposition for upgrading

### UX
- NEVER make onboarding a single form — it must be stepped
- NEVER show raw JSON to the user
- NEVER skip loading states on AI calls
- NEVER skip error handling on AI calls
- NEVER block the UI during plan generation
- NEVER hide the tier — always show what tier generated the plan
- NEVER show locked features without an upgrade path

---

## CORS config
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Design rules
- Mobile-first — gym usage on phone
- Font: system-ui only
- Tailwind only, no inline styles, no CSS modules
- Plan view must be screenshot-friendly
- Loading states on every AI call
- Error states on every AI call, never silent failure
- Tier badge visible on plan view: "Generated by [Free Coach / Pro Coach / Elite {Sport} Coach]"
- Upgrade prompts: subtle, not aggressive. Show value, not pressure.

---

## Phase 1 build sequence — FOLLOW THIS ORDER

### Step 1: Scaffold
Both apps + DB + tiers.py with all persona/feature definitions.

### Step 2: Auth + tier
Signup with tier selection, JWT with tier claim, get_current_user returns tier.

### Step 3: Onboarding
5 steps for all tiers + steps 6-7 for Elite.

### Step 4: Research tool
Tier-aware: free=no search, pro=standard search, elite=deep sport search.

### Step 5: Plan generation
Tier-aware personas and prompts. Different quality at each tier.

### Step 6: Plan view
Shows tier badge. Upgrade prompts where pro/elite features would appear.

### Step 7: Confirm flow
Save plan with tier_at_creation and persona_used.

---

## Commands
```bash
cd backend && pip install -r requirements.txt
uvicorn main:app --reload --port 8000

cd frontend && npm install && npm run dev

psql $DATABASE_URL -f backend/migrations/001_phase1.sql
```

---

## Build log

### Phase 1 — 2026-04-12
- Built:
  - backend/requirements.txt, main.py, config.py, database.py, tiers.py
  - backend/models/__init__.py, user.py, profile.py, research_cache.py, plan.py
  - backend/routes/__init__.py, routes/auth.py
  - backend/tools/__init__.py, services/__init__.py
  - backend/migrations/001_phase1.sql
  - backend/.env (placeholder — user fills in real values)
  - frontend/ (via create-next-app@latest, Next.js 16 + React 19)
  - frontend/src/lib/auth.ts, api.ts, tiers.ts
  - frontend/src/app/layout.tsx, page.tsx, onboarding/page.tsx
  - frontend/.env.local
- Works:
  - Check 1: Migration creates all 8 tables on Neon
  - Check 2: Backend starts with no errors
  - Check 3: Health check returns {"status":"ok"}
  - Check 4: Free signup returns token with tier="free"
  - Check 5: Elite signup returns token with tier="elite"
  - Check 6: Login with existing credentials works
  - Check 7: JWT contains user_id, tier, exp claims
  - Check 8: GET /user/tier returns correct features for each tier
  - Check 9: Frontend builds with zero TypeScript errors
  - Check 10: Browser testing pending (user needs to run dev servers)
- Broke:
  - Circular import: models/__init__.py imported Base then model files which imported Base from models. Fixed by extracting Base/engine/SessionLocal into database.py.
  - psql not on PATH: ran migration via Python/SQLAlchemy instead.
  - channel_binding=require in Neon URL: removed since psycopg2 doesn't support it.
- Decisions:
  - Created database.py (not in CLAUDE.md spec) to break circular import between models/__init__.py and individual model files. All model files import Base from database.py; models/__init__.py re-exports everything.
  - Used Next.js 16 (latest from create-next-app) instead of 14 since the kickoff prompt uses @latest. App Router API is the same.

### Phase 2 — 2026-04-12
- Built:
  - backend/routes/profile.py (POST /profile upsert + GET /profile)
  - frontend/src/components/OnboardingChat.tsx (7-step tier-aware wizard)
  - Modified backend/main.py (registered profile_router at /profile)
  - Modified frontend/src/app/onboarding/page.tsx (replaced placeholder with OnboardingChat)
- Works:
  - Check 1: profile_router imports cleanly, both routes registered in app
  - Check 2: Frontend builds with zero TypeScript errors
  - Check 3: All pages generate successfully (static)
  - Browser testing pending: full onboarding flow needs manual testing with both dev servers
- Decisions:
  - OnboardingChat receives `tier` as prop from onboarding/page.tsx (page owns auth gate, component stays testable)
  - Step 1 (goal) auto-advances on card tap; steps 2-7 have explicit Continue button
  - Equipment "bodyweight_only" clears all other selections; selecting other equipment clears bodyweight_only
  - Elite "Other" sport shows free text input with separate Continue button
  - Profile upsert pattern: updates existing profile if user revisits onboarding
  - Elite sport + competition_date saved to users table (account-level), not profiles table

### Phase 3 — 2026-04-12
- Built:
  - backend/services/claude_client.py (ClaudeClient class with tier-aware research)
  - backend/tools/research.py (research pipeline with profile hash cache)
  - backend/routes/research.py (POST /research/test endpoint)
  - backend/test_research.py (manual test script for all 3 tiers + cache)
  - Modified backend/main.py (registered research_router at /research)
- Works:
  - Check 1: All imports resolve cleanly, no circular imports
  - Check 2: Backend starts with all routes registered including /research/test
  - Check 3: POST /research/test requires auth + profile (returns 400 without profile)
  - Check 4-6: Tier-specific research quality — pending user testing with valid ANTHROPIC_API_KEY
  - Check 7: Cache hit — pending user testing
- Broke:
  - Python 3.9 doesn't support `str | None` union syntax. Fixed with `from __future__ import annotations`.
- Decisions:
  - Used `from __future__ import annotations` in claude_client.py and test_research.py to support `str | None` on Python 3.9
  - _extract_json finds last text block in response (handles web search tool_use blocks in between)
  - Retry logic: on JSON parse failure, makes one additional Claude call asking it to fix the JSON
  - Free tier prompt intentionally simpler — no BAD/GOOD examples (per CLAUDE.md spec), keeping quality gap real
  - research_for_profile is synchronous (not async) since the route handler is sync and SQLAlchemy session isn't async

### Phase 4 — 2026-04-12
- Built:
  - Modified backend/services/claude_client.py (added generate_plan, _build_plan_system, _build_plan_prompt + 3 plan prompt templates)
  - backend/tools/plan_generator.py (generate_plan_for_profile pipeline: research → Claude plan → validate → save)
  - backend/routes/plan.py (POST /plan/generate, GET /plan/, GET /plan/{plan_id})
  - Modified backend/main.py (registered plan_router at /plan)
- Works:
  - Check 1: All imports resolve cleanly, no circular imports
  - Check 2: Backend starts with all routes registered including /plan/generate, /plan/, /plan/{plan_id}
  - Check 3: POST /plan/generate requires auth + profile (returns 400 without profile)
  - Check 4: Plan limit enforcement via check_plan_limit (free=1/month, pro/elite=unlimited)
  - Check 5-7: Tier-specific plan generation quality — pending user testing with valid ANTHROPIC_API_KEY
  - Check 8: GET /plan/ returns lightweight plan list (no plan_data/nutrition)
  - Check 9: GET /plan/{id} returns full plan with plan_data + nutrition
- Decisions:
  - Plan prompts use {profile} and {research} as JSON-serialized strings (not individual field placeholders like research prompts)
  - persona_used stored as display string: "Free Coach" / "Pro Coach" / "Elite {Sport} Coach"
  - Only one active plan per user — previous plans deactivated on new generation
  - generate_plan uses max_tokens=8192 (larger than research's 4096) since plans are more complex
  - No web search tool on plan generation call — research already gathered evidence
  - GET /plan/ route defined before GET /plan/{plan_id} to avoid FastAPI path conflicts
  - Used `from __future__ import annotations` in both new files for Python 3.9 compat

### Phase 5 — 2026-04-12
- Built:
  - frontend/src/components/TierGate.tsx (subtle upgrade prompt with lock icon, guards via canUse())
  - frontend/src/components/NutritionPanel.tsx (training/rest day macros with colored proportion bars)
  - frontend/src/components/PeriodizationBar.tsx (tappable phase-colored week timeline with competition marker)
  - frontend/src/components/PlanView.tsx (collapsible day cards with exercise pills, swap options, sport justifications)
  - frontend/src/app/plan/loading/page.tsx (triggers POST /plan/generate, tier-aware animated progress, error handling)
  - frontend/src/app/plan/[id]/page.tsx (composes all components: tier badge, periodization bar, plan view, nutrition, tier gates)
- Works:
  - Check 1: Frontend builds with zero TypeScript errors
  - Check 2: All routes registered: /, /onboarding, /plan/loading, /plan/[id]
  - Check 3-10: Browser testing pending (full onboarding → loading → plan view flow)
- Decisions:
  - Next.js 16 params Promise handled with React use() in client component /plan/[id]/page.tsx
  - AI output resilience: normalizeWeeks() handles multiple plan_data JSON shapes (weeks at top level, nested under plan key, or as array)
  - Only selected week rendered at a time (not all weeks) for mobile performance
  - Elite loading messages personalized with sport name fetched from GET /profile
  - Swap options cycle through alternatives with local state only (no backend call)
  - PeriodWeek/TrainingDay/Exercise types defined in PeriodizationBar.tsx, re-exported and imported by PlanView.tsx and page.tsx
  - NutritionData type defined and exported from NutritionPanel.tsx
  - TierGate self-hides when user already has the feature (canUse guard returns null)
  - Tier badge colors: gray (free), blue (pro), amber (elite)
  - Phase colors in PeriodizationBar: blue-700 (accumulation/GPP), blue-500 (intensification/sport-specific), zinc-600 (deload), amber-500 (peak/taper)

### Phase 6 — 2026-04-12
- Built:
  - Modified backend/tools/plan_generator.py (plans created as drafts, old drafts cleaned up, deactivation moved to confirm endpoint)
  - Modified backend/routes/plan.py (added POST /{plan_id}/confirm + DELETE /{plan_id})
  - Modified frontend/src/app/plan/[id]/page.tsx (draft banner with confirm/regenerate buttons, amber "Draft" badge)
- Works:
  - Check 1: All imports resolve cleanly, no circular imports
  - Check 2: Backend starts with all 15 routes registered including /plan/{plan_id}/confirm and DELETE /plan/{plan_id}
  - Check 3: Frontend builds with zero TypeScript errors
  - Check 4-8: Browser testing pending (confirm flow, regenerate flow, draft cleanup)
- Decisions:
  - No new DB columns — is_active=False represents draft state
  - No new files — all changes in 3 existing files
  - Deactivation of previous plans moved from plan_generator.py to POST /confirm endpoint
  - Orphan draft cleanup: existing drafts deleted before new generation in plan_generator.py
  - DELETE endpoint only allows deleting drafts (is_active=False), refuses active plans
  - Draft banner uses amber color scheme (bg-amber-900/20, border-amber-700/50, text-amber-300) consistent with elite tier accent
  - Footer badge changed from gray "Inactive" to amber "Draft" for unconfirmed plans

### Phase 5 (Session Logging) — 2026-04-12
- Built:
  - backend/models/session.py (SessionLog model mapping to sessions table)
  - backend/models/checkin.py (WeeklyCheckin model mapping to weekly_checkins table)
  - backend/routes/session.py (POST /{plan_id}/{week}/{day}, GET /{plan_id}, GET /{plan_id}/{week})
  - backend/routes/checkin.py (POST /{plan_id}/{week}, GET /{plan_id}, maybe_advance_week())
  - frontend/src/components/WeekProgressDots.tsx (filled/hollow dots for session + check-in progress)
  - frontend/src/app/dashboard/page.tsx (today's session, week progress, quick actions, tier gates)
  - frontend/src/app/session/[planId]/[week]/[day]/page.tsx (exercise logging with reps/weight/RPE, pre-readiness, read-only for completed)
  - frontend/src/app/checkin/[planId]/[week]/page.tsx (recovery, mood, sleep, weight, notes, read-only for submitted)
  - Modified backend/models/__init__.py (added SessionLog + WeeklyCheckin imports)
  - Modified backend/main.py (registered session_router at /session, checkin_router at /checkin)
  - Modified backend/routes/plan.py (added GET /plan/active above /{plan_id})
  - Modified frontend/src/app/page.tsx (redirects logged-in users to /dashboard instead of /onboarding)
- Works:
  - Check 1: Backend starts with all 21 routes registered
  - Check 2: Frontend builds with zero TypeScript errors
  - Check 3: All 7 frontend routes generate (/, /onboarding, /plan/loading, /plan/[id], /dashboard, /session/[planId]/[week]/[day], /checkin/[planId]/[week])
  - Check 4-15: Browser testing pending (full dashboard → session → check-in → week advance flow)
- Decisions:
  - Model named SessionLog (not Session) to avoid collision with SQLAlchemy's Session class
  - GET /plan/active placed before GET /plan/{plan_id} in plan_router to avoid FastAPI path conflict
  - "Today's session" computed client-side: dashboard diffs plan_data days vs completed sessions for current_week
  - Week advancement requires ALL sessions + check-in: maybe_advance_week() called after check-in POST only
  - Adaptation hook gated with check_feature(user, "adaptation") — placeholder pass for Phase 6
  - Duplicate prevention: 409 Conflict for same plan+week+day session or same plan+week check-in
  - Pre-readiness (sleep/energy/soreness 1-10) is optional — collapsed by default
  - Session logging page shows read-only view if session already logged
  - Check-in page shows read-only view if check-in already submitted
  - Landing page now redirects to /dashboard; dashboard handles redirect to /onboarding if no active plan
  - Used from __future__ import annotations in both new route files for Python 3.9 compat
  - Free tier sees subtle upgrade banner on dashboard + TierGate for adaptation feature

### Phase 6 (Adaptation) — 2026-04-12
- Built:
  - backend/models/adaptation.py (AdaptationLog model mapping to adaptation_log table)
  - backend/tools/adapt.py (adapt_plan pipeline: gather sessions/checkin → Claude adapt → apply adjustments → save log)
  - Modified backend/services/claude_client.py (added ADAPT_SYSTEM_PRO, ADAPT_SYSTEM_ELITE, ADAPT_PROMPT, ADAPT_ELITE_SUFFIX + adapt() method)
  - Modified backend/routes/checkin.py (replaced adaptation placeholder with adapt_plan() call in maybe_advance_week)
  - Modified backend/routes/plan.py (added POST /{plan_id}/adapt + GET /{plan_id}/adaptations)
  - Modified backend/models/__init__.py (added AdaptationLog import)
  - Modified frontend/src/app/dashboard/page.tsx (adaptation card, manual adapt button, fetch adaptation data)
- Works:
  - Check 1: All imports resolve cleanly, no circular imports
  - Check 2: Backend starts with all 24 routes registered including /plan/{plan_id}/adapt and /plan/{plan_id}/adaptations
  - Check 3: Frontend builds with zero TypeScript errors
  - Check 4: All 7 frontend routes generate successfully
  - Check 5-11: Browser/API testing pending (adaptation pipeline, manual adapt, free tier gating)
- Decisions:
  - adapt_plan() is synchronous (matches existing codebase pattern) — adds ~5-15s to check-in response for pro/elite
  - Adaptation failure wrapped in try/except in checkin.py — never blocks check-in response
  - Local import of adapt_plan in checkin.py to avoid loading tools/adapt for free-tier users
  - _compute_snapshot_hash mirrors research.compute_profile_hash but works from plan.profile_snapshot dict
  - flag_modified(plan, "plan_data") used to ensure SQLAlchemy detects in-place JSONB mutations
  - _apply_adjustments uses case-insensitive partial name matching to find target exercises
  - Manual adapt (POST /plan/{id}/adapt) returns 403 for free tier, 400 if on week 1
  - No new router needed — adaptation endpoints added to existing plan_router
  - Dashboard "Re-analyse" button changed to "Adapt My Plan" — calls POST /plan/{id}/adapt directly instead of regenerating plan
  - Adaptation card shows adjustment type badges (color-coded: blue=load, purple=volume, amber=swap, red=deload)
  - Elite adaptation prompt includes sport-specific rules (competition proximity, taper, total stress awareness)
  - Pro adaptation uses ADAPT_SYSTEM_PRO persona; elite uses ADAPT_SYSTEM_ELITE with sport + competition_date

### Phase 7 (Collective Learning) — 2026-04-12
- Built:
  - backend/models/collective.py (CollectiveResult model mapping to collective_results table)
  - backend/tools/collective.py (donate_result + query_collective — sport-aware collective pipeline)
  - backend/routes/collective.py (POST /{plan_id}/donate + GET /stats)
  - Modified backend/models/__init__.py (added CollectiveResult import)
  - Modified backend/main.py (registered collective_router at /collective)
  - Modified backend/routes/checkin.py (milestone detection in maybe_advance_week: sets milestone_pending at every 3 weeks for pro/elite)
  - Modified backend/routes/plan.py (added milestone_pending to GET /plan/active response)
  - Modified backend/tools/research.py (inject collective data into research pipeline via _attach_collective helper — not cached, always fresh)
  - Modified frontend/src/app/dashboard/page.tsx (milestone donation card with 1-5 rating, optional notes, purple theme)
  - Modified frontend/src/app/page.tsx (social proof stats from GET /collective/stats, shown below tier cards)
- Works:
  - Check 1: Backend starts with all 26 routes registered including /collective/stats and /collective/{plan_id}/donate
  - Check 2: Frontend builds with zero TypeScript errors
  - Check 3: All 7 frontend routes generate successfully
  - Check 4-12: Browser/API testing pending (milestone trigger, donation flow, sport matching, free tier gating, social proof)
- Decisions:
  - CollectiveResult model maps to existing collective_results table (created in migration 001)
  - Milestone detection: plan.current_week % 3 == 0 && check_feature(user, "collective") — fires at weeks 3, 6, 9, etc.
  - Success score mapping: user rates 1-5, stored as 0.0-1.0 ((raw - 1) / 4.0)
  - Collective data NOT cached in research_cache — always queried fresh via _attach_collective() for both cache hits and misses
  - query_collective uses 3-tier query: sport-matched (elite only) → exact profile_hash → broader goal+experience
  - Only results with success_score >= 0.7 are surfaced (maps to user rating of ~4+)
  - GET /collective/stats is public (no auth) for landing page social proof
  - donate_result gathers outcome data from sessions + checkins in the 3-week milestone window
  - No PII in collective_results — only profile_hash, sport, plan_config, outcome aggregates
  - Milestone card uses purple color scheme (bg-purple-900/20, border-purple-700/50) to distinguish from adaptation (blue) and draft (amber)
  - Used from __future__ import annotations in collective.py and routes/collective.py for Python 3.9 compat

### Phase 8 (Coach Chat) — 2026-04-12
- Built:
  - backend/migrations/002_phase8_chat.sql (chat_messages table + indexes)
  - backend/models/chat.py (ChatMessage model)
  - backend/tools/chat.py (build_coach_context, get_conversation_history, apply_chat_modifications + helpers)
  - backend/routes/chat.py (POST /chat, GET /chat/{plan_id})
  - frontend/src/app/chat/page.tsx (full-screen elite-only chat UI)
  - Modified backend/models/__init__.py (added ChatMessage import)
  - Modified backend/main.py (registered chat_router at /chat)
  - Modified backend/services/claude_client.py (added COACH_CHAT_SYSTEM, COACH_CHAT_USER prompts + chat() method)
  - Modified frontend/src/app/dashboard/page.tsx (added "Chat with Coach" button for elite, TierGate for pro)
- Works:
  - Check 1: Migration creates chat_messages table with indexes on Neon
  - Check 2: Backend starts with all 28 route-methods registered (24 distinct paths) including POST /chat/ and GET /chat/{plan_id}
  - Check 3: Frontend builds with zero TypeScript errors
  - Check 4: All 8 frontend routes generate successfully (added /chat)
  - Check 5-10: Browser/API testing pending (elite chat flow, tier gating, plan modifications, conversation history, quick actions)
- Decisions:
  - Chat page at /chat (not /chat/[planId]) — loads active plan automatically, matches dashboard pattern
  - Context compression: profile as compact string (~50 tokens), today's session capped at 6 exercises, sessions summarized as one-liners, last 2 checkins/adaptations only
  - Conversation history: last 10 messages prepended to Claude messages array, current message gets full context appended
  - Plan modifications reuse _apply_adjustments from tools/adapt.py for exercise_swap and load_change; skip_session and add_exercise handled directly
  - Modification failure wrapped in try/except — never blocks coach response, appends note to message instead
  - Both user + assistant messages saved to chat_messages in single transaction after Claude call succeeds
  - Optimistic UI: user message appears immediately, removed on error
  - Quick-action chips shown only when messages.length < 3
  - max_tokens=2048 for chat (shorter than plan generation's 8192 — coach should be conversational)
  - Used from __future__ import annotations in tools/chat.py and routes/chat.py for Python 3.9 compat

### UX/Security/Performance Improvement Sweep — 2026-04-13
- Built:
  - backend/migrations/003_indexes_and_cascade.sql (8 indexes + CASCADE constraints)
  - frontend/src/app/settings/page.tsx (profile editing, change password, tier display, logout)
  - frontend/src/app/calendar/page.tsx (week-by-week training calendar with completion status)
  - frontend/src/app/error.tsx (global error boundary with retry + dashboard link)
  - frontend/src/components/RestTimer.tsx (fixed-bottom countdown timer with vibration)
  - frontend/src/components/Celebration.tsx (animated checkmark overlay, auto-dismiss 2s)
  - Modified backend/main.py (slowapi rate limiter middleware)
  - Modified backend/requirements.txt (added slowapi==0.1.9)
  - Modified backend/database.py (connection pooling: pool_size=5, max_overflow=10, pool_pre_ping, pool_recycle=300)
  - Modified backend/routes/auth.py (GET /user/me, PUT /change-password, email validation, password min 8 chars, rate limiting)
  - Modified backend/routes/plan.py (rate limiting on generate, pagination on list, tier downgrade guard on adapt)
  - Modified backend/routes/chat.py (rate limiting, message max_length=5000, pagination on history)
  - Modified backend/routes/session.py (empty session rejection, PUT edit with 24h window, pagination, input bounds)
  - Modified backend/routes/checkin.py (score bounds ge=1 le=10, weight 20-500, pagination, SELECT FOR UPDATE race condition fix)
  - Modified backend/routes/profile.py (plan_stale flag on profile update)
  - Modified backend/services/claude_client.py (httpx.Timeout on Anthropic client)
  - Modified backend/tools/adapt.py (adaptation history limited to 5 most recent)
  - Modified backend/tools/research.py (profile hash includes age_bucket + weight_bucket)
  - Modified frontend/src/lib/auth.ts (added fetchUserMe() for server-side tier verification)
  - Modified frontend/src/app/dashboard/page.tsx (logout button, fetchUserMe, calendar link, settings link)
  - Modified frontend/src/app/chat/page.tsx (fetchUserMe for tier verification)
  - Modified frontend/src/app/plan/[id]/page.tsx (fetchUserMe, preview/activate UX, export button, Active badge)
  - Modified frontend/src/app/session/[planId]/[week]/[day]/page.tsx (rest timer, prev-week comparison, confirmation modal, celebration, empty data check, scale labels, green borders, session editing, pre-readiness visibility)
  - Modified frontend/src/app/checkin/[planId]/[week]/page.tsx (confirmation modal, scale labels, weight kg suffix)
  - Modified frontend/src/components/OnboardingChat.tsx (sessionStorage persistence, equipment checkmarks + count)
  - Modified frontend/src/components/PeriodizationBar.tsx (text-xs week numbers, phase color legend)
  - Modified frontend/src/components/NutritionPanel.tsx (empty state placeholder)
  - Modified frontend/src/components/TierGate.tsx (upgrade link to /settings)
  - Modified frontend/src/app/globals.css (print-friendly CSS for plan export)
- Works:
  - Check 1: Backend starts with 31 API routes, all imports clean
  - Check 2: Frontend builds with zero TypeScript errors, 11 pages generate
  - Check 3-N: Browser testing pending for all new features
- Decisions:
  - Rate limiting uses per-IP via slowapi (not per-user) — sufficient for current scale
  - Session editing window is 24 hours from completion, not configurable
  - Rest timer default is 90 seconds when exercise has no rest_seconds field
  - Celebration auto-dismisses after 2 seconds — no user action needed
  - Profile hash now includes age decade and weight 10kg bucket — existing cache entries won't match (acceptable: forces re-research with better matching)
  - Settings page combines profile editing + account management in one page (not separate)
  - Calendar page shows all weeks at once (not a month-view calendar)
  - Print styles force white background + black text for readability
  - fetchUserMe() called on every tier-gated page load — adds one API call but prevents tier spoofing

### AI-Driven Onboarding V3 — 2026-04-14
- Built:
  - backend/routes/onboarding.py (NEW: POST /next-question with AI-driven question generation, input sanitization, completeness safety net, rate limiting 10/min)
  - Modified backend/services/claude_client.py (added ONBOARDING_SYSTEM prompt ~7500 chars with complete field registry + contextual rules; added generate_onboarding_question() method with prompt caching via cache_control: ephemeral)
  - Modified backend/main.py (registered onboarding_router at /onboarding)
  - frontend/src/components/OnboardingChat.tsx (FULL REWRITE: 580 lines down from 1081. AI-driven dynamic conversation loop replacing hardcoded 8-step wizard. 10 field type renderers. Conversation history display. Back button support with answer rollback. Session persistence fitai_onboarding_v3. 15-question hard cap.)
- Decisions:
  - First question (goal selection) hardcoded for instant display — avoids cold API call on page load
  - Claude generates all subsequent questions based on accumulated answers + tier context
  - field_name values are exact ProfileCreate keys — no translation layer needed
  - Backend builds profile_data deterministically from raw answers (doesn't trust Claude's mapping)
  - 3-layer completeness safety net: (1) system prompt checklist, (2) backend validation that overrides premature "done", (3) frontend pre-submission check
  - Prompt caching: system prompt identical across all calls for same tier, cache_control ephemeral reduces cost/latency for questions 2-10
  - sessionStorage key bumped to fitai_onboarding_v3 to avoid conflicts with V2 state format
  - Hard cap at 15 questions — sends force_complete flag, backend prompt forces Claude to signal done
  - No database changes — final submission still uses existing POST /profile with same ProfileCreate schema

### Onboarding V4 UX Redesign — 2026-04-14
- Built:
  - frontend/src/lib/classifyGoal.ts (NEW: keyword regex maps free-text goal to enum — fat_loss/muscle/performance/wellness)
  - frontend/src/components/OnboardingChat.tsx (FULL REWRITE: ~650 lines. Free-text goal welcome screen with rotating placeholders + suggestion chips. One-question-at-a-time layout replacing scrolling conversation history. Sticky header with back button + gradient progress bar. Sticky footer with always-visible continue button. 10 upgraded field renderers: stepper numbers, circle day picker, gradient slider with value bubble, grid multi-select with SVG checkmarks, auto-advance on single-field single_select/yes_no. Fade-slide-up animations. Contextual loading messages. iOS safe-area padding.)
  - frontend/src/app/globals.css (added fadeSlideUp + fadeIn keyframe animations)
  - Modified backend/services/claude_client.py (ONBOARDING_SYSTEM prompt updated: goal field marked as pre-collected, goal_description support added for personalization, RULES section replaced with TIER-AWARE QUESTIONING DEPTH — free 5-7 questions, pro 7-10, elite 8-12. generate_onboarding_question() includes goal_description prominently in user prompt.)
- Works:
  - Check 1: Frontend builds with zero TypeScript errors, all 11 pages generate
  - Check 2: Backend imports resolve cleanly (ONBOARDING_SYSTEM prompt 9582 chars)
  - Check 3-10: Browser testing pending (requires valid ANTHROPIC_API_KEY)
- Decisions:
  - Free-text goal input replaces 4-card picker — user types naturally ("Get stronger for swimming"), frontend classifies to enum, raw text sent as goal_description
  - Client-side keyword regex classification is best-effort — AI sees raw text via goal_description and personalizes regardless
  - Removed MAX_QUESTIONS=15 hard cap and force_complete logic. AI decides when done based on tier depth requirements.
  - Soft safety valve: "Finish setup" link appears after 20 questions as escape hatch (not forced completion)
  - Conversation history data kept for back navigation + session persistence but NOT rendered — clean single-question view
  - Auto-advance (350ms delay) on single-field single_select and yes_no steps — eliminates unnecessary "Continue" taps
  - Progress bar uses tier-based estimates (free ~6, pro ~9, elite ~11), capped at 95% until done
  - sessionStorage key bumped to fitai_onboarding_v4
  - No database changes, no new API endpoints
