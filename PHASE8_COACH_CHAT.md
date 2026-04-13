# PHASE 8 — Coach Chat (Elite Only)
# Paste AFTER Phase 7 verified.
# This is the premium Elite feature — a conversational AI coach with full context.

Read CLAUDE.md (with Phase 1-7 build logs).

## What you're building

A chat interface where Elite users can talk to their AI coach. The coach has full context: profile, current plan, session history, adaptation history, research protocols, competition date. Users can ask things like "should I train today?", "my shoulder hurts what should I do?", "can I swap bench for dumbbell press this week?", "what should I eat before my swim meet?".

This is NOT a generic chatbot. It's a coach who KNOWS YOUR PLAN and KNOWS YOUR DATA.

## 8A: Chat route

Create `backend/routes/chat.py`:

```
POST /chat
  Requires: Elite tier (return 403 for free/pro with upgrade message)
  Body: { message: string, plan_id: string }
  Returns: { response: string, plan_modified: bool, modifications?: object }
```

The route:
1. Verify user is Elite
2. Load full context: profile, active plan, recent sessions (last 2 weeks), recent check-ins, adaptation history, research cache
3. Build context-rich prompt
4. Call Claude
5. If Claude's response includes plan modifications → apply them and flag plan_modified=true
6. Return response text + modification flag

## 8B: Coach chat prompt

```python
COACH_CHAT_SYSTEM = """You are {persona}

You are this athlete's personal coach. You have full access to their training data.
Respond conversationally — short, direct, like a real coach would text. No essays.
If they ask about modifying their plan, you CAN make changes. Return your response
as JSON: {{"message": "your response text", "modifications": null_or_object}}

If you recommend a plan change, include it in modifications:
{{"modifications": {{"type": "exercise_swap"|"load_change"|"skip_session"|"add_exercise",
  "details": {{specific change object}}}}}}

If no plan change needed, set modifications to null.
"""

COACH_CHAT_USER = """ATHLETE CONTEXT:
Profile: {profile}
Sport: {sport}
Competition: {competition_date} ({weeks_until} weeks away)
Current plan week: {current_week} / {total_weeks} (phase: {phase})
Today's planned session: {today_session}

RECENT PERFORMANCE (last 2 weeks):
{recent_sessions}

LATEST CHECK-IN:
{latest_checkin}

ADAPTATION HISTORY:
{recent_adaptations}

---
ATHLETE MESSAGE: {message}
"""
```

## 8C: Conversation history

Store chat history for context continuity within a session:

```sql
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    plan_id UUID REFERENCES plans(id),
    role TEXT NOT NULL,          -- 'user' | 'assistant'
    content TEXT NOT NULL,
    modifications JSONB,         -- null or plan change object
    created_at TIMESTAMPTZ DEFAULT now()
);
```

When calling Claude, include last 10 messages as conversation history.

## 8D: Frontend chat UI

Create `frontend/src/app/chat/page.tsx`:

- Gate: if tier !== "elite", show upgrade page
- Standard chat UI: messages list + input bar at bottom
- Coach messages styled differently from user messages
- If coach response includes modifications:
  - Show inline card: "I've adjusted your plan: [description]"
  - Card has "View changes" link → goes to plan view
- Quick-action chips above input: "Should I train today?", "I'm feeling sore", "Swap an exercise"
- Context indicator at top: "Coaching you for [Sport] — Week [N] of [M]"

Mobile-first: full-screen chat, input fixed at bottom, keyboard-safe.

## 8E: Smart context compression

The full context (profile + plan + sessions + adaptations) can get large. Compress it:

```python
def build_coach_context(user, plan, db):
    # Profile: just key fields, not full snapshot
    profile_summary = f"{user.sport} athlete, {plan.profile_snapshot['experience']}, "
                      f"{plan.profile_snapshot['days_per_week']}x/week, "
                      f"goal: {plan.profile_snapshot['goal']}"

    # Plan: only current week + next week, not full plan
    current_week_plan = plan.plan_data["periodization"][plan.current_week - 1]
    today = determine_today_session(plan)

    # Sessions: last 2 weeks only, summarized
    recent = summarize_recent_sessions(plan.id, db, weeks=2)

    # Adaptations: last 2 only
    adaptations = db.query(AdaptationLog).filter_by(plan_id=plan.id)\
        .order_by(AdaptationLog.created_at.desc()).limit(2).all()

    return {
        "profile": profile_summary,
        "sport": user.sport,
        "competition_date": str(user.competition_date) if user.competition_date else "none",
        "weeks_until": compute_weeks_until(user.competition_date),
        "current_week": plan.current_week,
        "total_weeks": plan.mesocycle_weeks,
        "phase": plan.phase,
        "today_session": format_session_plan(today),
        "recent_sessions": recent,
        "latest_checkin": format_latest_checkin(plan.id, db),
        "recent_adaptations": format_adaptations(adaptations),
    }
```

## 8F: Plan modification from chat

When Claude returns modifications:
1. Parse the modification object
2. Apply to plan_data (same as adaptation engine)
3. Save plan
4. Return plan_modified=true to frontend
5. Frontend shows "Plan updated" card in chat

Supported modification types:
- exercise_swap: replace exercise X with Y in day Z
- load_change: adjust load for exercise X
- skip_session: mark today as rest (injury/recovery reason)
- add_exercise: add a prehab/mobility exercise to a day

## Verification

1. Free user: /chat returns 403 with upgrade message
2. Pro user: /chat returns 403 with upgrade message
3. Elite user: /chat works, coach responds conversationally
4. Ask "should I train today?" → coach references today's planned session + recent readiness data
5. Say "my shoulder hurts" → coach asks clarifying questions, may suggest exercise swap
6. Say "swap bench press for dumbbell press" → coach modifies plan, plan_modified=true
7. Check DB: plan_data actually changed after chat modification
8. Conversation history: messages persist, coach references earlier messages
9. Quick-action chips work on mobile
10. Chat context stays compressed (<4000 tokens of context per message)

## STOP
Build log in CLAUDE.md. Note:
- Coach response quality — does it feel like a real coach or a chatbot?
- Context compression — does the coach have enough info to give useful answers?
- Modification reliability — do plan changes apply correctly?

This completes the full product across all tiers:
Free: signup → onboard → plan → log
Pro: + research + adaptation + collective
Elite: + sport-specific persona + competition peaking + coach chat
