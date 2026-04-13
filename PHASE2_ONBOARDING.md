# PHASE 2 — Onboarding Flow (Tier-Aware)
# Paste AFTER Phase 1 passes all verification checks.

Read CLAUDE.md (with Phase 1 build log).

## What you're building

A stepped intake wizard. Steps 1-5 are identical for all tiers. Elite users get steps 6-7 (sport selection + competition date).

## Step 1: Profile route

Create `backend/routes/profile.py`:
- POST /profile — accepts ProfileCreate body. For elite users, validates that sport is provided.
- GET /profile — returns current user's profile or null.

If user.tier == "elite" and sport is not in request body, return 400 "Elite tier requires sport selection."
Save user.sport and user.competition_date to the users table (not profiles — these are account-level).

## Step 2: OnboardingChat component

Create `frontend/src/components/OnboardingChat.tsx`:

Fetch user tier on mount (from JWT or GET /user/tier).

```typescript
const totalSteps = tier === "elite" ? 7 : 5;
const [step, setStep] = useState(1);
const [answers, setAnswers] = useState<Partial<ProfileCreate>>({});
```

**Steps 1-5 — ALL TIERS (unchanged from previous version):**

Step 1 → "What's your main goal?" — 4 tappable cards
Step 2 → "Tell me about yourself" — age, weight, height, sex
Step 3 → "Training experience" — beginner/intermediate/advanced + injuries
Step 4 → "Your schedule" — days, duration, equipment
Step 5 → "Lifestyle" — sleep, stress, job, diet

**Steps 6-7 — ELITE ONLY:**

Step 6 → "What sport do you compete in?"
  UI: scrollable 2-column grid of sport cards, each with:
  - Sport emoji icon (🏊 🏃 🏋️ 💪 🏀 ⚽ 🎾 🥊 🚴 🏆)
  - Sport name
  - 1-line subtitle: "Swimming", "Running / Track", "Powerlifting", etc.
  - "Other" card at the end with free text input
  On tap: set sport, advance to step 7

Step 7 → "Are you preparing for a competition?"
  UI:
  - Yes/No toggle (two pill buttons)
  - If Yes: date picker appears (minimum date = 4 weeks from now)
  - If No: competition_date = null
  - Below: a note in muted text: "Your plan will be periodized to peak on this date"
  - CTA button: "Generate my elite plan"

**For Free/Pro users:** Step 5's button says "Generate my plan" (not "Continue")

## Step 3: Progress + animation

- Progress dots at top: 5 dots (free/pro) or 7 dots (elite)
- Slide animation between steps (CSS transform)
- Back arrow on steps 2+
- Greeting message at top of each step changes to feel conversational:
  - Step 1: "Let's build your perfect programme"
  - Step 2: "Good choice. Quick body stats"
  - Step 3: "How experienced are you?"
  - Step 4: "What does your training week look like?"
  - Step 5: "Last one — lifestyle context"
  - Step 6 (elite): "Now let's dial in your sport"
  - Step 7 (elite): "Competition peaking?"

## Step 4: Submit flow

On final step submit:
1. POST /profile with all answers (including sport + competition_date for elite)
2. Redirect to /plan/loading

## Verification

1. Free user: sees 5 steps, no sport/competition steps
2. Pro user: sees 5 steps, no sport/competition steps
3. Elite user: sees 7 steps, sport selection + competition date appear
4. Elite user: "Other" sport with custom text saves correctly
5. Elite user: competition date picker works, saves to users table
6. Back button works on every step for all tiers
7. Progress dots show correct count per tier (5 or 7)
8. Profile saved in DB with correct data
9. Mobile viewport (375px): all cards tappable, nothing overflows
10. Try submitting step 3 with no experience selected — validation blocks it

## STOP
Build log entry in CLAUDE.md. Note any UX decisions about the sport cards layout.
