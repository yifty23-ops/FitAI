from __future__ import annotations

import json
import logging

import httpx
import anthropic

from tiers import PERSONAS, SPORT_DEMANDS, TIER_FEATURES, build_elite_persona

logger = logging.getLogger(__name__)

# --- Prompt templates (EXACT from CLAUDE.md) ---

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
  "sources": ["Author et al. (Year) — finding"]
}}

BAD: {{"weekly_volume": "moderate volume"}}
GOOD: {{"weekly_volume": "10-20 sets per muscle group per week (dose-response continues with diminishing returns beyond ~20 sets), per Pelland et al. (2024) meta-regression of 67 studies — Journal of Strength and Conditioning Research"}}
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


# --- Plan generation prompt templates (EXACT from CLAUDE.md) ---

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


# --- Adaptation prompt templates (Phase 6) ---

ADAPT_SYSTEM_PRO = (
    "You are a world-class S&C coach reviewing a client's training week. "
    "Analyse their session logs and check-in data. Compare performed vs prescribed. "
    "Return ONLY valid JSON with specific, actionable adjustments."
)

ADAPT_SYSTEM_ELITE = (
    "You are an elite {sport} S&C coach reviewing an athlete's training week. "
    "Consider both gym performance AND how this training serves their {sport} goals. "
    "Competition date: {competition_date}. Factor proximity to competition into every decision. "
    "Return ONLY valid JSON with specific, actionable adjustments."
)

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

ADAPT_ELITE_SUFFIX = """
SPORT-SPECIFIC RULES:
8. If competition is <4 weeks away: shift toward sport-specific power, reduce volume
9. If competition is <2 weeks away: begin taper — reduce volume 50%, maintain intensity
10. Flag any exercise that may compromise {sport} training (e.g., heavy deadlifts before a high-volume swim week)
11. Consider total training stress: gym + {sport} sessions combined

BAD: {{"change": "increase weight", "reason": "progressive overload"}}
GOOD: {{"change": "increase from 60kg to 62.5kg", "reason": "hit 10 reps at RPE 7 for 3 sets, below target RPE 8. Competition is 8 weeks away — still in accumulation, safe to progress."}}
"""

# --- Coach chat prompts (Phase 8) ---

COACH_CHAT_SYSTEM = """{persona}

You are this athlete's personal coach. You have full access to their training data.
Respond conversationally — short, direct, like a real coach would text. No essays.
If they ask about modifying their plan, you CAN make changes. Return your response
as JSON: {{"message": "your response text", "modifications": null}}

If you recommend a plan change, include it in modifications:
{{"message": "your response", "modifications": {{"type": "exercise_swap"|"load_change"|"skip_session"|"add_exercise",
  "details": {{specific change object}}}}}}

For exercise_swap details: {{"day": day_number, "old_exercise": "name", "new_exercise": "name"}}
For load_change details: {{"day": day_number, "exercise": "name", "new_load": "instruction"}}
For skip_session details: {{"day": day_number, "reason": "why"}}
For add_exercise details: {{"day": day_number, "exercise": "name", "sets": N, "reps": "range", "load_instruction": "instruction"}}

If no plan change needed, set modifications to null.
ALWAYS return valid JSON. No markdown fences. No preamble.
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
ATHLETE MESSAGE: {message}"""


class ClaudeClient:
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(
            api_key=api_key,
            timeout=httpx.Timeout(connect=10.0, read=120.0, write=30.0, pool=10.0),
        )
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
                system=system,
            )
        else:
            # Pro + Elite: web search enabled
            response = self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": prompt}],
                system=system,
            )

        return self._extract_json(response)

    def generate_plan(
        self,
        profile: dict,
        research: dict,
        tier: str,
        sport: str | None = None,
        competition_date: str | None = None,
    ) -> dict:
        system = self._build_plan_system(tier, sport)
        prompt = self._build_plan_prompt(profile, research, tier, sport, competition_date)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
            system=system,
        )

        return self._extract_json(response)

    def adapt(
        self,
        profile: dict,
        research_protocols: dict,
        completed_sessions: list,
        checkin: dict,
        next_week_plan: dict,
        plan_history: list,
        tier: str,
        sport: str | None = None,
        competition_date: str | None = None,
    ) -> dict:
        # Build system prompt
        if tier == "elite" and sport:
            system = ADAPT_SYSTEM_ELITE.format(
                sport=sport,
                competition_date=competition_date or "none",
            )
        else:
            system = ADAPT_SYSTEM_PRO

        # Build user prompt
        prompt = ADAPT_PROMPT.format(
            profile=json.dumps(profile, indent=2),
            research=json.dumps(research_protocols, indent=2),
            sessions=json.dumps(completed_sessions, indent=2),
            checkin=json.dumps(checkin, indent=2),
            next_week=json.dumps(next_week_plan, indent=2),
            history=json.dumps(plan_history, indent=2),
        )
        if tier == "elite" and sport:
            prompt += ADAPT_ELITE_SUFFIX.format(sport=sport)

        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
            system=system,
        )

        return self._extract_json(response)

    def chat(
        self,
        context: dict,
        message: str,
        conversation_history: list,
        sport: str | None = None,
    ) -> dict:
        # Build elite persona
        if sport:
            persona = build_elite_persona(sport)
        else:
            persona = PERSONAS["elite"]

        system = COACH_CHAT_SYSTEM.format(persona=persona)

        user_prompt = COACH_CHAT_USER.format(
            profile=context["profile"],
            sport=context.get("sport", "general"),
            competition_date=context.get("competition_date", "none"),
            weeks_until=context.get("weeks_until", "N/A"),
            current_week=context["current_week"],
            total_weeks=context["total_weeks"],
            phase=context.get("phase", "unknown"),
            today_session=context.get("today_session", "unknown"),
            recent_sessions=context.get("recent_sessions", "none"),
            latest_checkin=context.get("latest_checkin", "none"),
            recent_adaptations=context.get("recent_adaptations", "none"),
            message=message,
        )

        # Build messages: conversation history + current message with full context
        messages = []
        for msg in conversation_history:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": user_prompt})

        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            messages=messages,
            system=system,
        )

        return self._extract_json(response)

    def _build_plan_system(self, tier: str, sport: str | None) -> str:
        if tier == "elite" and sport:
            persona = build_elite_persona(sport)
        else:
            persona = PERSONAS[tier]
        return (
            persona
            + "\nGenerate a complete training plan. Return ONLY valid JSON with "
            "\"plan\" and \"nutrition\" top-level keys. No preamble, no markdown."
        )

    def _build_plan_prompt(
        self,
        profile: dict,
        research: dict,
        tier: str,
        sport: str | None,
        competition_date: str | None,
    ) -> str:
        mesocycle_weeks = TIER_FEATURES[tier]["max_mesocycle_weeks"]
        format_dict = {
            "profile": json.dumps(profile, indent=2),
            "research": json.dumps(research, indent=2),
            "mesocycle_weeks": mesocycle_weeks,
        }

        if tier == "elite":
            format_dict["sport"] = sport or "general"
            format_dict["competition_date"] = competition_date or "none"
            return PLAN_PROMPT_ELITE.format(**format_dict)
        elif tier == "pro":
            return PLAN_PROMPT_PRO.format(**format_dict)
        else:
            return PLAN_PROMPT_FREE.format(**format_dict)

    def _build_research_system(self, tier: str) -> str:
        if tier == "free":
            return (
                "You are a certified personal trainer. Based on your training "
                "knowledge, recommend protocols. Return ONLY valid JSON. "
                "No web search needed."
            )
        elif tier == "pro":
            return (
                "You are a sports science researcher. Use web search to find "
                "evidence-based protocols from PubMed, NSCA, and meta-analyses. "
                "Return ONLY valid JSON."
            )
        else:  # elite
            return (
                "You are an elite sports science researcher specializing in "
                "high-performance athlete preparation. Use web search extensively "
                "— search PubMed, sport-specific journals, and elite coaching "
                "resources. Find protocols used at Olympic/professional level. "
                "Return ONLY valid JSON."
            )

    def _build_research_prompt(self, profile: dict, tier: str, sport: str | None) -> str:
        if tier == "free":
            return RESEARCH_PROMPT_FREE.format(**profile)
        elif tier == "pro":
            return RESEARCH_PROMPT_PRO.format(**profile)
        else:  # elite
            profile_with_sport = {**profile, "sport": sport or "general"}
            return RESEARCH_PROMPT_ELITE.format(**profile_with_sport)

    def _extract_json(self, response) -> dict:
        # Find the last text block (after any web search tool use)
        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text = block.text

        if not text:
            raise ValueError("No text content in Claude response")

        # Strip markdown fences
        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()

        try:
            return json.loads(clean)
        except json.JSONDecodeError as e:
            logger.warning("JSON parse failed, retrying: %s", e)
            return self._retry_json_extraction(text)

    def _retry_json_extraction(self, original_text: str, _retried: bool = False) -> dict:
        """Retry JSON extraction once. Raises ValueError if retry also fails."""
        response = self.client.messages.create(
            model=self.model,
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": (
                        "The following text was supposed to be valid JSON but failed to parse. "
                        "Extract the JSON object and return ONLY the valid JSON, no markdown fences, "
                        "no explanation:\n\n" + original_text
                    ),
                }
            ],
            system="Return ONLY valid JSON. No markdown, no explanation, no preamble.",
        )

        text = ""
        for block in response.content:
            if hasattr(block, "text"):
                text = block.text

        clean = text.strip()
        if clean.startswith("```json"):
            clean = clean[7:]
        elif clean.startswith("```"):
            clean = clean[3:]
        if clean.endswith("```"):
            clean = clean[:-3]
        clean = clean.strip()

        return json.loads(clean)
