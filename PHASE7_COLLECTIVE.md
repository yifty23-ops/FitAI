# PHASE 7 — Collective Learning (Pro + Elite)
# Paste AFTER Phase 6 adaptation verified working.

Read CLAUDE.md (with Phase 1-6 build logs).

## What you're building

Same concept as before — milestone donations, collective pool, feed into research — but now tier and sport-aware. Elite users get sport-matched collective data (a swimmer's successful plan helps future swimmers more than a powerlifter's plan would).

## Changes from previous version

### 7A: Milestone detection
Unchanged — triggers at every 3 weeks for Pro+Elite users only.

```python
if check_feature(user, "collective") and plan.current_week % 3 == 0:
    plan.milestone_pending = True
```

Free users never see the milestone prompt.

### 7B: Result donation — now stores sport
```python
result = CollectiveResult(
    profile_hash=profile_hash,
    sport=user.sport,               # NEW: store sport for matching
    plan_config=plan_config,
    outcome=outcome,
    success_score=success_score
)
```

### 7C: Success rating — unchanged

### 7D: Feed collective into research — sport-aware matching

Update `query_collective()`:

```python
def query_collective(profile_hash: str, profile: Profile, user: User, db: Session) -> str:
    if not check_feature(user, "collective"):
        return "Collective data not available on free tier."

    results = []

    # Elite: prioritize sport-matched data
    if user.tier == "elite" and user.sport:
        sport_matched = db.query(CollectiveResult)\
            .filter_by(sport=user.sport)\
            .filter(CollectiveResult.success_score >= 0.7)\
            .order_by(CollectiveResult.success_score.desc())\
            .limit(5).all()
        results.extend(sport_matched)

    # All tiers: exact profile hash match
    exact = db.query(CollectiveResult)\
        .filter_by(profile_hash=profile_hash)\
        .filter(CollectiveResult.success_score >= 0.7)\
        .order_by(CollectiveResult.success_score.desc())\
        .limit(5).all()
    results.extend(exact)

    # Broader: same goal + experience
    broader = db.query(CollectiveResult)\
        .filter(CollectiveResult.plan_config["goal"].astext == profile.goal)\
        .filter(CollectiveResult.plan_config["experience"].astext == profile.experience)\
        .filter(CollectiveResult.success_score >= 0.7)\
        .order_by(CollectiveResult.success_score.desc())\
        .limit(10).all()
    results.extend(broader)

    # Deduplicate
    seen = set()
    unique = []
    for r in results:
        if r.id not in seen:
            seen.add(r.id)
            unique.append(r)

    if not unique:
        return "No collective data available yet."

    lines = []
    for r in unique[:10]:
        sport_tag = f" [{r.sport}]" if r.sport else ""
        lines.append(f"Profile: {r.profile_hash[:8]}{sport_tag}, Score: {r.success_score:.1f}, "
                     f"Config: {json.dumps(r.plan_config)}")

    return "COLLECTIVE DATA (successful plans for similar profiles):\n" + "\n".join(lines)
```

### 7E-7F: API routes + landing page — unchanged

Add to landing page social proof: "Built on [N] real training outcomes across [M] sports"

### Free tier experience
Free users don't see milestone prompts, don't contribute to collective, and collective data is not injected into their research phase. This is a genuine value-add for paid tiers.

## Verification

Same 10 checks as previous Phase 7, PLUS:
11. Free user: never sees milestone prompt, collective not queried during research
12. Elite swimmer donates → collective_results row has sport="swimming"
13. New elite swimmer: research query includes sport-matched collective data
14. New elite powerlifter: does NOT receive swimming collective data
15. Privacy audit: `SELECT * FROM collective_results` — no PII, only hashes + aggregates

## STOP
Build log in CLAUDE.md. Privacy audit results.
