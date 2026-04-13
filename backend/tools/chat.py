from __future__ import annotations

import logging
from datetime import date

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from models.adaptation import AdaptationLog
from models.chat import ChatMessage
from models.checkin import WeeklyCheckin
from models.plan import Plan
from models.session import SessionLog
from models.user import User

logger = logging.getLogger(__name__)


def build_coach_context(user: User, plan: Plan, db: Session) -> dict:
    """Build compressed context dict for coach chat (~1500-2000 tokens)."""
    snapshot = plan.profile_snapshot or {}

    # Compact profile summary (not full JSON dump)
    profile_summary = (
        f"{user.sport or 'general'} athlete, "
        f"{snapshot.get('experience', 'unknown')} level, "
        f"{snapshot.get('days_per_week', '?')}x/week, "
        f"goal: {snapshot.get('goal', 'unknown')}, "
        f"{snapshot.get('sex', '?')}, age {snapshot.get('age', '?')}, "
        f"{snapshot.get('weight_kg', '?')}kg"
    )

    # Competition weeks
    weeks_until = "N/A"
    comp_date_str = "none"
    if user.competition_date:
        comp_date_str = str(user.competition_date)
        delta = user.competition_date - date.today()
        weeks_until = str(max(0, delta.days // 7))

    return {
        "profile": profile_summary,
        "sport": user.sport or "general",
        "competition_date": comp_date_str,
        "weeks_until": weeks_until,
        "current_week": plan.current_week,
        "total_weeks": plan.mesocycle_weeks,
        "phase": plan.phase or "unknown",
        "today_session": _get_today_session(plan, db),
        "recent_sessions": _summarize_sessions(plan.id, plan.current_week, db),
        "latest_checkin": _format_latest_checkin(plan.id, db),
        "recent_adaptations": _format_recent_adaptations(plan.id, db),
    }


def get_conversation_history(plan_id, db: Session, limit: int = 10) -> list:
    """Load last N chat messages for a plan in chronological order."""
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.plan_id == plan_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
        .all()
    )
    messages.reverse()
    return [{"role": m.role, "content": m.content} for m in messages]


def apply_chat_modifications(plan: Plan, modifications: dict, db: Session) -> None:
    """Apply coach chat modifications to plan_data."""
    from tools.adapt import _apply_adjustments, _get_week_data

    mod_type = modifications.get("type", "")
    details = modifications.get("details", {})
    if not details:
        logger.warning("Chat modification has no details, skipping")
        return

    if mod_type == "exercise_swap":
        adjustments = [{
            "type": "exercise_swap",
            "target_day": details.get("day", details.get("target_day")),
            "target_exercise": details.get("old_exercise", details.get("target_exercise", "")),
            "change": details.get("new_exercise", details.get("change", "")),
        }]
        _apply_adjustments(plan, plan.current_week, adjustments)

    elif mod_type == "load_change":
        adjustments = [{
            "type": "load_change",
            "target_day": details.get("day", details.get("target_day")),
            "target_exercise": details.get("exercise", details.get("target_exercise", "")),
            "change": details.get("new_load", details.get("change", "")),
        }]
        _apply_adjustments(plan, plan.current_week, adjustments)

    elif mod_type == "skip_session":
        target_day = details.get("day", details.get("target_day"))
        week_data = _get_week_data(plan.plan_data, plan.current_week)
        if week_data:
            days = week_data.get("days", [])
            for d in days:
                if d.get("day_number") == target_day:
                    d["skipped"] = True
                    d["skip_reason"] = details.get("reason", "Coach recommended rest")
                    break
            flag_modified(plan, "plan_data")

    elif mod_type == "add_exercise":
        target_day = details.get("day", details.get("target_day"))
        week_data = _get_week_data(plan.plan_data, plan.current_week)
        if week_data:
            days = week_data.get("days", [])
            for d in days:
                if d.get("day_number") == target_day:
                    exercises = d.get("exercises", [])
                    new_ex = {
                        "name": details.get("exercise", ""),
                        "sets": details.get("sets", 3),
                        "reps": details.get("reps", "10-12"),
                        "load_instruction": details.get("load_instruction", "light, focus on form"),
                        "added_by_coach": True,
                    }
                    exercises.append(new_ex)
                    d["exercises"] = exercises
                    break
            flag_modified(plan, "plan_data")

    else:
        logger.warning("Unknown chat modification type: %s", mod_type)
        return

    db.commit()


def _get_today_session(plan: Plan, db: Session) -> str:
    """Determine next uncompleted session for current week, formatted compactly."""
    from tools.adapt import _get_week_data

    completed = (
        db.query(SessionLog.day_number)
        .filter(
            SessionLog.plan_id == plan.id,
            SessionLog.week_number == plan.current_week,
        )
        .all()
    )
    done_days = {r[0] for r in completed}

    week_data = _get_week_data(plan.plan_data, plan.current_week)
    if not week_data:
        return "No plan data for current week."

    days = week_data.get("days", [])
    for d in days:
        dn = d.get("day_number", 0)
        if dn not in done_days:
            label = d.get("label", "Day %d" % dn)
            focus = d.get("focus", "")
            exercises = d.get("exercises", [])
            ex_lines = []
            for ex in exercises[:6]:
                name = ex.get("name", "?")
                sets = ex.get("sets", "?")
                reps = ex.get("reps", "?")
                load = ex.get("load_instruction", "")
                ex_lines.append("  - %s %sx%s %s" % (name, sets, reps, load))
            header = "%s (%s)" % (label, focus) if focus else label
            return header + "\n" + "\n".join(ex_lines) if ex_lines else header

    return "All sessions completed for this week."


def _summarize_sessions(plan_id, current_week: int, db: Session) -> str:
    """Summarize sessions from last 2 weeks as compact one-liners."""
    start_week = max(1, current_week - 1)
    sessions = (
        db.query(SessionLog)
        .filter(
            SessionLog.plan_id == plan_id,
            SessionLog.week_number >= start_week,
            SessionLog.week_number <= current_week,
        )
        .order_by(SessionLog.week_number, SessionLog.day_number)
        .all()
    )
    if not sessions:
        return "No recent sessions logged."

    lines = []
    for s in sessions:
        exercises = s.logged_exercises or []
        ex_count = len(exercises)
        readiness = s.pre_readiness or {}
        readiness_str = "sleep:%s energy:%s soreness:%s" % (
            readiness.get("sleep", "?"),
            readiness.get("energy", "?"),
            readiness.get("soreness", "?"),
        )
        high_rpe = []
        for ex in exercises:
            for set_data in ex.get("sets", []):
                if set_data.get("rpe") and set_data["rpe"] >= 9:
                    high_rpe.append(ex.get("name", "?"))
                    break
        rpe_note = " HIGH RPE: %s" % ", ".join(high_rpe) if high_rpe else ""
        lines.append("W%dD%d: %d exercises, %s%s" % (
            s.week_number, s.day_number, ex_count, readiness_str, rpe_note
        ))
    return "\n".join(lines)


def _format_latest_checkin(plan_id, db: Session) -> str:
    """Format the most recent check-in compactly."""
    checkin = (
        db.query(WeeklyCheckin)
        .filter(WeeklyCheckin.plan_id == plan_id)
        .order_by(WeeklyCheckin.created_at.desc())
        .first()
    )
    if not checkin:
        return "No check-in data yet."

    parts = ["Week %d" % checkin.week_number]
    if checkin.recovery_score is not None:
        parts.append("Recovery: %d/10" % checkin.recovery_score)
    if checkin.mood_score is not None:
        parts.append("Mood: %d/10" % checkin.mood_score)
    if checkin.sleep_avg is not None:
        parts.append("Sleep: %.1fh" % checkin.sleep_avg)
    if checkin.weight_kg is not None:
        parts.append("Weight: %.1fkg" % checkin.weight_kg)
    if checkin.notes:
        parts.append("Notes: %s" % checkin.notes[:100])
    return ", ".join(parts)


def _format_recent_adaptations(plan_id, db: Session) -> str:
    """Format last 2 adaptation logs compactly."""
    adaptations = (
        db.query(AdaptationLog)
        .filter(AdaptationLog.plan_id == plan_id)
        .order_by(AdaptationLog.created_at.desc())
        .limit(2)
        .all()
    )
    if not adaptations:
        return "No adaptations yet."

    lines = []
    for a in adaptations:
        adj_count = len(a.adjustments) if isinstance(a.adjustments, list) else 0
        assessment = (a.assessment or "No assessment")[:120]
        lines.append("Week %d: %s (%d adjustments)" % (
            a.week_number, assessment, adj_count
        ))
    return "\n".join(lines)
