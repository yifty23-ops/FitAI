# PHASE 6 — Adaptation Engine (Pro + Elite Only)
# Paste AFTER Phase 5 verified with real session data.

Read CLAUDE.md (with Phase 1-5 build logs).

## What you're building

After each completed week, the AI analyses session logs + check-in data and adjusts next week's plan. This only runs for Pro and Elite users. The adaptation quality scales with tier:
- Pro: evidence-based adjustments, load/volume changes
- Elite: all of Pro + sport-specific considerations, competition timeline awareness

## 6A: Adaptation tool

Create `backend/tools/adapt.py` — same structure as previous Phase 6, with one addition: tier-aware prompting.

```python
async def adapt_plan(plan: Plan, user: User, db: Session) -> dict:
    if not check_feature(user, "adaptation"):
        return {"adapted": False, "reason": "adaptation not available on free tier"}

    # ... gather sessions + checkin data (unchanged) ...

    client = ClaudeClient(settings.ANTHROPIC_API_KEY)
    adaptations = client.adapt(
        profile=plan.profile_snapshot,
        research_protocols=get_cached_research(plan, db),
        completed_sessions=session_data,
        checkin=checkin_data,
        next_week_plan=next_week_plan,
        plan_history=get_adaptation_history(plan.id, db),
        tier=user.tier,
        sport=user.sport,
        competition_date=str(user.competition_date) if user.competition_date else None
    )
    # ... apply + store (unchanged) ...
```

## 6B: Tier-aware adaptation prompts

Add to claude_client.py:

```python
ADAPT_SYSTEM_PRO = """You are a world-class S&C coach reviewing a client's training week.
Analyse their session logs and check-in data. Compare performed vs prescribed.
Return ONLY valid JSON with specific, actionable adjustments."""

ADAPT_SYSTEM_ELITE = """You are an elite {sport} S&C coach reviewing an athlete's training week.
Consider both gym performance AND how this training serves their {sport} goals.
Competition date: {competition_date}. Factor proximity to competition into every decision.
Return ONLY valid JSON with specific, actionable adjustments."""

ADAPT_PROMPT = """PROFILE: {profile}
RESEARCH PROTOCOLS: {research}
COMPLETED SESSIONS (last week): {sessions}
WEEKLY CHECK-IN: {checkin}
NEXT WEEK'S CURRENT PLAN: {next_week}
PREVIOUS ADAPTATIONS: {history}

Return JSON:
{{
  "assessment": "2-3 sentence summary",
  "adjustments": [
    {{
      "type": "volume_change" | "load_change" | "exercise_swap" | "rest_change" | "deload_trigger",
      "target_day": 1,
      "target_exercise": "exact name",
      "change": "specific change",
      "reason": "data-backed reason"
    }}
  ],
  "flags": {{
    "injury_risk": [],
    "recovery_concern": false,
    "plateau_detected": false
  }}
}}

RULES:
1. RPE consistently >9 → reduce load 5-10% OR reduce 1 set
2. RPE consistently <7 → increase load 2.5-5% OR add 1 set
3. Same area sore 3+ sessions → swap exercise, explain why
4. recovery_score ≤2 AND sleep_avg <6 → mini-deload (volume -40%)
5. All lifts hit top of rep range at target RPE → progress load
6. NEVER reduce without data-backed reason
7. Max 3 exercise changes per week
"""

# Elite addition to the prompt:
ADAPT_ELITE_SUFFIX = """
SPORT-SPECIFIC RULES:
8. If competition is <4 weeks away: shift toward sport-specific power, reduce volume
9. If competition is <2 weeks away: begin taper — reduce volume 50%, maintain intensity
10. Flag any exercise that may compromise {sport} training (e.g., heavy deadlifts before a high-volume swim week)
11. Consider total training stress: gym + {sport} sessions combined

BAD: {{"change": "increase weight", "reason": "progressive overload"}}
GOOD: {{"change": "increase from 60kg to 62.5kg", "reason": "hit 10 reps at RPE 7 for 3 sets, below target RPE 8. Competition is 8 weeks away — still in accumulation, safe to progress."}}
"""
```

## 6C-6F: Adaptation log, wiring, display, manual trigger

Same as previous Phase 6 — tier gating is handled at the entry point (adapt_plan checks feature).

One addition to dashboard display:

For Elite users, adaptation cards should show sport context:
- "Your pull-up load was increased — lat strength transfers directly to your catch phase"
- The adaptation assessment should reference sport when relevant

## Verification

1. Free user: week advances → NO adaptation runs → dashboard shows upgrade prompt
2. Pro user: week advances → adaptation runs → changes appear on dashboard
3. Elite swimmer: week advances → adaptation runs with sport-specific rules
4. Elite with competition <4 weeks away: adaptation shifts toward peaking
5. RPE >9 scenario → load decrease for both pro and elite
6. Same-area soreness 3x → exercise swap with explanation
7. Manual "Re-analyse" button works for pro+elite, greyed for free
8. Adaptation history shows on dashboard
9. Elite adaptation mentions sport transfer where relevant
10. Free tier upgrade prompt is visible but not pushy

## STOP
Build log in CLAUDE.md. Note adaptation quality for pro vs elite.
