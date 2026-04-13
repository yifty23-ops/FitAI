# FitAI — Builder Guide

## Files in this kit

```
CLAUDE.md                → Project brain. Drop in project root.
PHASE1_SCAFFOLD.md       → Scaffold + DB + Auth + Tier system
PHASE2_ONBOARDING.md     → 5-step intake (+ 2 elite steps)
PHASE3_RESEARCH.md       → Tier-aware research (FREE QUALITY GATE)
PHASE4_PLAN.md           → Tier-aware plan gen + plan view (BIGGEST PHASE)
PHASE5_LOGGING.md        → Session logging + weekly check-ins (all tiers)
PHASE6_ADAPT.md          → AI adaptation engine (Pro + Elite only)
PHASE7_COLLECTIVE.md     → Collective learning (Pro + Elite only)
PHASE8_COACH_CHAT.md     → Conversational AI coach (Elite only)
```

## How to use

```bash
mkdir fitai && cd fitai
# Copy CLAUDE.md into this directory
# Create backend/.env with all env vars from CLAUDE.md
# Create frontend/.env.local with NEXT_PUBLIC_API_URL

# Open Claude Code. Paste PHASE1_SCAFFOLD.md.
# Verify ALL checks. Paste PHASE2_ONBOARDING.md.
# Repeat for each phase.
```

## Rules

1. NEVER paste two phases at once
2. NEVER skip verification checks
3. If a phase fails, fix before moving on
4. After each phase, read Claude Code's build log in CLAUDE.md
5. If prompts were changed, review the changes

## Phase map

```
PHASE 1 (scaffold) → PHASE 2 (onboarding) → PHASE 3 (research) → PHASE 4 (plan)
                                                                         │
  PHASE 8 (coach chat) ← PHASE 7 (collective) ← PHASE 6 (adapt) ← PHASE 5 (logging)
```

**Phases 1-4 = Free tier MVP** — user gets a plan
**Phases 5-6 = Pro tier product** — plan adapts to real performance
**Phase 7 = The moat** — gets smarter with every user
**Phase 8 = Elite premium** — conversational sport-specific coach

## Tier feature matrix

```
Feature                    Free    Pro     Elite
─────────────────────────────────────────────────
Onboarding                 5 steps 5 steps 7 steps (+ sport + competition)
Research (web search)       ✗       ✓       ✓ (deep, sport-specific)
Persona                    Basic   Pro     Olympic {sport} coach
Mesocycle length           4 wk    8-12 wk 8-16 wk
Plans per month            1       ∞       ∞
Competition peaking         ✗       ✗       ✓
Adaptation                  ✗       ✓       ✓ (sport-aware)
Collective learning         ✗       ✓       ✓ (sport-matched)
Coach chat                  ✗       ✗       ✓
Session logging             ✓       ✓       ✓
```

## Expected timeline

Phase 1: 15-20 min
Phase 2: 20-30 min
Phase 3: 20-30 min (quality gate matters — don't rush)
Phase 4: 45-75 min (biggest phase)
Phase 5: 30-45 min
Phase 6: 20-30 min
Phase 7: 20-30 min
Phase 8: 30-45 min

Total: ~4-6 hours across 3-5 Claude Code sessions.

## Quality gates that MUST pass

**Phase 3 — Research quality gap:**
Free output should be decent but generic (no citations).
Pro output should cite studies, give specific numbers.
Elite output should be sport-specific with transfer rationale.
If the gap between tiers isn't obvious, the prompts need work.

**Phase 4 — Plan quality gap:**
Free plan: solid, basic exercises, simple periodization.
Pro plan: specific loads, RPE targets, evidence-based exercise selection.
Elite plan: exercises justified by sport transfer, competition peaking, training labels reference the sport.
Compare them side by side. The upgrade must feel worth paying for.

**Phase 6 — Adaptation specificity:**
Adaptations must reference actual session data.
"Increase weight" is BAD. "Increase from 60kg to 62.5kg because you hit 10 reps at RPE 7" is GOOD.

**Phase 8 — Coach personality:**
Should feel like texting a real coach, not a chatbot.
Short responses. References your actual data. Makes plan changes when asked.

## If Claude Code hits context limits

Start a new session. Say:
"Read CLAUDE.md. Continue from Phase N. The build log shows what's done."

## The business model this enables

Free tier: acquisition. Users try the product, see the plan quality, want more.
Pro tier: bread and butter. $15-25/month. Evidence-based plans + adaptation.
Elite tier: premium. $40-60/month. Olympic-caliber coaching for competitive athletes.

The cost to you per user is minimal — a few API calls. The value perception
gap between "Personal Trainer" and "Elite Swimming Coach" is massive.
