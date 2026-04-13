# PHASE 5 — Session Logging + Weekly Check-ins
# Paste AFTER Phase 4 full flow verified for all 3 tiers.

Read CLAUDE.md (with Phase 1-4 build logs).

## What you're building

Session logging works for ALL tiers (everyone needs to track workouts). Weekly check-ins work for ALL tiers too — but the data only feeds into the adaptation engine for Pro+Elite (Phase 6). Free users still see their check-in history, they just don't get AI-driven plan adjustments.

## 5A: Dashboard page

Create `frontend/src/app/dashboard/page.tsx`:

On load: GET /plan/active → if no active plan, redirect to /onboarding.

Layout:
- **Tier badge** at top: same as plan view
- **Today's session card:** next uncompleted session
  - Day label + focus + exercise count
  - "Start session" button → /session/[planId]/[week]/[day]
- **Week progress:** filled dots for completed sessions
- **Quick actions:**
  - "Log a past session" (always)
  - "Weekly check-in" (always, but shown only if ≥1 session this week)
  - "Re-analyse my plan" (Pro+Elite only — greyed with upgrade prompt for free)

For free tier, show a subtle banner: "You're using the free plan. Upgrade for AI-powered weekly adaptations." — not aggressive, just informative.

## 5B-5E: Session logging, API routes, check-in, week advancement

IDENTICAL to previous Phase 5 — no tier changes needed for logging mechanics.
Session logging is the same regardless of tier.
Weekly check-in is the same regardless of tier.
Week advancement logic is the same.

The ONLY difference: in maybe_advance_week(), the adaptation call (Phase 6) is tier-gated:

```python
def maybe_advance_week(plan: Plan, user: User, db: Session):
    # ... same week advancement logic ...

    if plan.current_week > prev_week:
        # Adaptation only for pro+elite
        if check_feature(user, "adaptation"):
            adaptation = await adapt_plan(plan, db)
            # ... store adaptation log ...
```

Build everything from the previous Phase 5 spec. The only addition is that adaptation call gating.

## Verification

Same 10 checks as previous Phase 5, PLUS:
11. Free user completes a week → week advances → NO adaptation runs
12. Pro user completes a week → week advances → adaptation runs (verify in Phase 6)
13. Dashboard shows "Re-analyse" button greyed for free, active for pro/elite
14. Upgrade prompt on dashboard is visible but not obstructive for free users

## STOP
Build log in CLAUDE.md.
