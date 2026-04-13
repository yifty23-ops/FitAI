# PHASE 3 — Research Tool (Tier-Aware)
# Paste AFTER Phase 2 passes all verification checks.
# THE MOAT. Get this right.

Read CLAUDE.md (with Phase 1-2 build logs).

## What you're building

The research phase where tier quality differences become real. Free tier gets Claude's built-in knowledge (no web search, fast, decent). Pro tier gets evidence-based research with web search (slower, much better). Elite tier gets deep sport-specific research with multiple targeted searches (slowest, best).

## Step 1: claude_client.py

Create `backend/services/claude_client.py` with the tier-aware implementation from CLAUDE.md:
- research(profile, tier, sport) — different behavior per tier
- Free: NO tools, NO web search. Just Claude's training knowledge.
- Pro: web_search tool enabled. Standard research queries.
- Elite: web_search tool enabled. 4+ sport-specific queries.
- _extract_json() — handles multi-block responses, strips markdown fences, retry once on parse failure.

## Step 2: research.py tool

Create `backend/tools/research.py`:

```python
async def research_for_profile(user: User, profile: Profile, db: Session) -> ResearchResult:
    tier = user.tier
    sport = user.sport  # None for free/pro

    # 1. Compute tier-aware hash
    profile_hash = compute_profile_hash(profile, tier)

    # 2. Check cache (keyed by hash + tier)
    cached = db.query(ResearchCache).filter_by(profile_hash=profile_hash, tier=tier).first()
    if cached:
        return cached_to_result(cached)

    # 3. Cache miss — call Claude
    client = ClaudeClient(settings.ANTHROPIC_API_KEY)
    result = client.research(
        profile=profile_to_research_dict(profile),
        tier=tier,
        sport=sport
    )

    # 4. Validate required keys
    assert "protocols" in result and "contraindications" in result

    # 5. Cache with tier tag
    entry = ResearchCache(
        profile_hash=profile_hash,
        tier=tier,
        protocols=result["protocols"],
        contraindications=result["contraindications"],
        sources=result.get("sources", [])
    )
    db.add(entry)
    db.commit()

    return result
```

Use the EXACT prompts from CLAUDE.md:
- RESEARCH_PROMPT_FREE for free tier
- RESEARCH_PROMPT_PRO for pro tier
- RESEARCH_PROMPT_ELITE for elite tier

The BAD/GOOD examples in each prompt are CRITICAL. Do NOT simplify them.

## Step 3: Test all three tiers

Create `backend/test_research.py`:

```python
"""Test each tier's research quality. Run: python test_research.py"""
import json

# Test profile: 28yo male, intermediate, muscle, 4x/week, barbell+dumbbells

# Test 1: Free tier
print("=== FREE TIER ===")
result_free = research_for_profile(user_free, profile, db)
print(json.dumps(result_free, indent=2))
# EXPECTED: decent but generic. No citations. Fast (<5s).

# Test 2: Pro tier
print("\n=== PRO TIER ===")
result_pro = research_for_profile(user_pro, profile, db)
print(json.dumps(result_pro, indent=2))
# EXPECTED: specific numbers with citations. Schoenfeld, Krieger, etc. 10-20s.

# Test 3: Elite tier (swimming)
print("\n=== ELITE TIER (swimming) ===")
result_elite = research_for_profile(user_elite_swim, profile, db)
print(json.dumps(result_elite, indent=2))
# EXPECTED: sport-specific exercises, transfer rationale, competition peaking. 15-30s.

# Test 4: Cache hit
print("\n=== CACHE TEST ===")
import time
t = time.time()
result_cached = research_for_profile(user_pro, profile, db)
elapsed = time.time() - t
print(f"Cache hit in {elapsed:.2f}s")  # Should be <0.1s
```

Run it. Read ALL output carefully.

## QUALITY GATE — MOST IMPORTANT CHECK IN THE ENTIRE PROJECT

Read the three outputs side by side. Verify the quality gap is REAL:

**Free tier should:**
- Return protocols based on general knowledge
- Be somewhat generic but correct
- Have NO citations (no web search)
- Complete in <5 seconds

**Pro tier should:**
- Cite actual studies (Schoenfeld, Krieger, etc.)
- Give specific numbers (e.g., "12-18 sets" not "moderate volume")
- Reference meta-analyses
- Complete in 10-20 seconds

**Elite tier should (for swimming example):**
- List exercises with sport transfer rationale ("pull-ups for catch phase")
- Reference sport-specific research or elite coaching practices
- Include competition_peaking field
- Include sport_specific_notes field
- Complete in 15-30 seconds

**If the quality gap between tiers is NOT obvious:**
- Free is too good? → Make the free prompt simpler, remove specificity requests
- Pro is too generic? → Add more BAD/GOOD examples, make search queries more specific
- Elite isn't sport-specific enough? → Add more sport-specific BAD/GOOD examples

THE WHOLE PRODUCT HINGES ON THIS GAP. Users must feel the upgrade is worth paying for.

## Step 4: Wire test route

```
POST /research/test
  Requires auth
  Uses user's tier + profile
  Returns: ResearchResult
```

## Step 5: Cache verification

1. Pro: call research → note time (10-20s). Call again → instant (cache hit).
2. Free: call research → note time (<5s). Call again → instant.
3. Same profile, different tier → different cache entries (check DB: two rows, same profile_hash prefix but different tier column).
4. Change goal in profile → new cache entry.

## STOP

Build log in CLAUDE.md. CRITICAL notes:
- Response time per tier
- Quality comparison: paste 1-2 lines from each tier's output as evidence
- Any prompt changes? UPDATE CLAUDE.md with improved versions
- JSON parsing issues?

Do NOT proceed until the quality gap between tiers is visually obvious.
