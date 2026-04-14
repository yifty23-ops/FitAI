"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import RestTimer from "@/components/RestTimer";
import Celebration from "@/components/Celebration";
import type { PeriodWeek, TrainingDay, Exercise } from "@/components/PeriodizationBar";
import ScoreSelector from "@/components/ScoreSelector";
import { normalizeWeeks } from "@/lib/normalizeWeeks";

interface PlanDetail {
  id: string;
  plan_data: Record<string, unknown>;
  profile_snapshot?: Record<string, unknown>;
  current_week: number;
  mesocycle_weeks: number;
}

interface LoggedSet {
  reps: number;
  weight_kg: number;
  rpe: number | null;
}

interface LoggedExercise {
  name: string;
  sets: LoggedSet[];
}

interface PreReadiness {
  sleep: number;
  energy: number;
  soreness: number;
}

interface SessionData {
  id: string;
  week_number: number;
  day_number: number;
  pre_readiness: PreReadiness | null;
  logged_exercises: LoggedExercise[] | null;
  notes: string | null;
  completed_at: string;
}

export default function SessionPage({
  params,
}: {
  params: Promise<{ planId: string; week: string; day: string }>;
}) {
  const { planId, week: weekStr, day: dayStr } = use(params);
  const week = parseInt(weekStr, 10);
  const day = parseInt(dayStr, 10);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [dayData, setDayData] = useState<TrainingDay | null>(null);
  const [existingSession, setExistingSession] = useState<SessionData | null>(null);

  // Pre-readiness — expanded by default for day 1
  const [showReadiness, setShowReadiness] = useState(day === 1);
  const [sleep, setSleep] = useState(5);
  const [energy, setEnergy] = useState(5);
  const [soreness, setSoreness] = useState(5);

  // Exercise logs
  const [exerciseLogs, setExerciseLogs] = useState<LoggedExercise[]>([]);
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Previous week comparison
  const [prevWeekExercises, setPrevWeekExercises] = useState<
    Map<string, { weight_kg: number; reps: number }>
  >(new Map());

  // Rest timer
  const [restTimerActive, setRestTimerActive] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);

  // Celebration
  const [showCelebration, setShowCelebration] = useState(false);

  // Quick log mode
  const [quickMode, setQuickMode] = useState(false);

  // Swipe navigation
  const [totalDays, setTotalDays] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Time adjustment
  const [planSessionMinutes, setPlanSessionMinutes] = useState(60);
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustedExercises, setAdjustedExercises] = useState<Exercise[] | null>(null);
  const [adjustSummary, setAdjustSummary] = useState("");
  const [adjustError, setAdjustError] = useState("");

  // Escape key closes confirmation modal
  useEffect(() => {
    if (!showConfirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConfirm(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showConfirm]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }

    async function load() {
      try {
        const fetches: [Promise<PlanDetail>, Promise<SessionData[]>, Promise<SessionData[]> | null] = [
          api<PlanDetail>(`/plan/${planId}`),
          api<SessionData[]>(`/session/${planId}/${week}`),
          week > 1 ? api<SessionData[]>(`/session/${planId}/${week - 1}`) : null,
        ];

        const [plan, weekSessions] = await Promise.all([fetches[0], fetches[1]]);

        // Fetch previous week data (non-blocking — don't let failure break the page)
        if (fetches[2]) {
          try {
            const prevSessions = await fetches[2];
            const prevDaySession = prevSessions.find((s) => s.day_number === day);
            if (prevDaySession?.logged_exercises) {
              const map = new Map<string, { weight_kg: number; reps: number }>();
              for (const ex of prevDaySession.logged_exercises) {
                // Use the best (heaviest) set as the reference
                const bestSet = ex.sets.reduce(
                  (best, s) => (s.weight_kg > best.weight_kg ? s : best),
                  ex.sets[0]
                );
                if (bestSet) {
                  map.set(ex.name.toLowerCase(), {
                    weight_kg: bestSet.weight_kg,
                    reps: bestSet.reps,
                  });
                }
              }
              setPrevWeekExercises(map);
            }
          } catch {
            // Previous week data is optional — silently ignore errors
          }
        }

        // Extract session_minutes from profile snapshot
        const snapshotMinutes = plan.profile_snapshot?.session_minutes;
        if (typeof snapshotMinutes === "number" && snapshotMinutes > 0) {
          setPlanSessionMinutes(snapshotMinutes);
          setAvailableMinutes(snapshotMinutes);
        }

        // Find the day in plan_data
        const weeks = normalizeWeeks(plan.plan_data);
        const weekData =
          weeks.find((w) => w.week_number === week) ?? weeks[week - 1] ?? null;
        const days = weekData?.days ?? [];
        setTotalDays(days.length);
        const targetDay =
          days.find((d) => d.day_number === day) ?? days[day - 1] ?? null;

        setDayData(targetDay);

        // Check if already logged
        const existing = weekSessions.find((s) => s.day_number === day);
        if (existing) {
          setExistingSession(existing);
        } else if (targetDay) {
          // Initialize exercise log state from planned exercises
          const exercises = targetDay.exercises ?? [];
          setExerciseLogs(
            exercises.map((ex) => ({
              name: ex.name,
              sets: Array.from({ length: ex.sets ?? 3 }, () => ({
                reps: 0,
                weight_kg: 0,
                rpe: null,
              })),
            }))
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [planId, week, day, router]);

  function updateSet(
    exIdx: number,
    setIdx: number,
    field: keyof LoggedSet,
    value: number | null
  ) {
    // Haptic feedback when a set transitions from incomplete to complete
    const currentSet = exerciseLogs[exIdx]?.sets[setIdx];
    if (currentSet) {
      const newSet = { ...currentSet, [field]: value };
      const wasComplete = currentSet.reps > 0 && currentSet.weight_kg > 0;
      const isNowComplete = (newSet.reps ?? 0) > 0 && (newSet.weight_kg ?? 0) > 0;
      if (!wasComplete && isNowComplete) {
        navigator.vibrate?.(10);
      }
    }

    setExerciseLogs((prev) =>
      prev.map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, j) =>
                j === setIdx ? { ...s, [field]: value } : s
              ),
            }
          : ex
      )
    );
  }

  const handleCelebrationComplete = useCallback(() => {
    setShowCelebration(false);
    router.push("/dashboard");
  }, [router]);

  const handleRestTimerComplete = useCallback(() => {
    setRestTimerActive(false);
  }, []);

  async function adjustTime() {
    if (availableMinutes === null || availableMinutes === planSessionMinutes) return;
    setAdjusting(true);
    setAdjustError("");
    try {
      const result = await api<{
        adjusted_exercises: Exercise[];
        summary: string;
        estimated_minutes: number;
      }>(`/session/${planId}/${week}/${day}/adjust`, {
        method: "POST",
        body: JSON.stringify({ available_minutes: availableMinutes }),
        timeoutMs: 60_000,
      });
      setAdjustedExercises(result.adjusted_exercises);
      setAdjustSummary(result.summary);
      // Re-initialize exercise logs from adjusted exercises
      setExerciseLogs(
        result.adjusted_exercises.map((ex) => ({
          name: ex.name,
          sets: Array.from({ length: ex.sets ?? 3 }, () => ({
            reps: 0,
            weight_kg: 0,
            rpe: null,
          })),
        }))
      );
    } catch (err) {
      setAdjustError(err instanceof Error ? err.message : "Failed to adjust session");
    } finally {
      setAdjusting(false);
    }
  }

  function resetAdjustment() {
    setAdjustedExercises(null);
    setAdjustSummary("");
    setAvailableMinutes(planSessionMinutes);
    // Re-initialize from original exercises
    if (dayData) {
      const exercises = dayData.exercises ?? [];
      setExerciseLogs(
        exercises.map((ex) => ({
          name: ex.name,
          sets: Array.from({ length: ex.sets ?? 3 }, () => ({
            reps: 0,
            weight_kg: 0,
            rpe: null,
          })),
        }))
      );
    }
  }

  const handleRestTimerDismiss = useCallback(() => {
    setRestTimerActive(false);
  }, []);

  function startRestTimer(restSeconds: number | undefined) {
    setRestTimerSeconds(restSeconds ?? 90);
    setRestTimerActive(true);
  }

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await api(`/session/${planId}/${week}/${day}`, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify({
          pre_readiness: showReadiness ? { sleep, energy, soreness } : null,
          logged_exercises: exerciseLogs,
          notes: notes || null,
        }),
      });
      navigator.vibrate?.([50, 50, 50]);
      setShowCelebration(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save session.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (error && !dayData) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-red-400 font-medium mb-4">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const plannedExercises: Exercise[] = adjustedExercises ?? dayData?.exercises ?? [];

  // Check if any exercise has actual data logged
  const hasAnyData = exerciseLogs.some((ex) =>
    ex.sets.some((s) => s.reps > 0 || s.weight_kg > 0)
  );

  // Warn before navigating away with unsaved data
  useEffect(() => {
    if (!hasAnyData || existingSession || showCelebration) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasAnyData, existingSession, showCelebration]);

  // Swipe navigation between training days
  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const deltaX = touchStartX.current - e.changedTouches[0].clientX;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;

    // Only act on horizontal swipes exceeding 50px that are more horizontal than vertical
    if (Math.abs(deltaX) < 50 || Math.abs(deltaX) < Math.abs(deltaY)) return;

    // Guard: confirm before navigating away with unsaved data
    if (hasAnyData && !existingSession) {
      if (!confirm("You have unsaved session data. Navigate away?")) return;
    }

    if (deltaX > 0 && day < totalDays) {
      // Swiped left → next day
      router.push(`/session/${planId}/${week}/${day + 1}`);
    } else if (deltaX < 0 && day > 1) {
      // Swiped right → previous day
      router.push(`/session/${planId}/${week}/${day - 1}`);
    }
  }

  // Read-only view for already-logged sessions
  if (existingSession) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white pb-20" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            &larr; Dashboard
          </button>

          <h1 className="text-xl font-semibold">
            Week {week} &mdash; Day {day}
          </h1>

          <div className="bg-green-900/20 border border-green-700/50 rounded-2xl p-3 flex items-center justify-between">
            <p className="text-green-300 text-sm font-medium">
              Session logged on{" "}
              {new Date(existingSession.completed_at).toLocaleDateString()}
            </p>
            {(() => {
              const completedAt = new Date(existingSession.completed_at).getTime();
              const hoursAgo = (Date.now() - completedAt) / (1000 * 60 * 60);
              return hoursAgo < 24 ? (
                <button
                  onClick={() => {
                    // Switch to edit mode by clearing existing session and populating form
                    const logs = (existingSession.logged_exercises ?? []).map((ex) => ({
                      name: ex.name,
                      sets: ex.sets.map((s) => ({
                        reps: s.reps,
                        weight_kg: s.weight_kg,
                        rpe: s.rpe,
                      })),
                    }));
                    setExerciseLogs(logs);
                    setNotes(existingSession.notes ?? "");
                    if (existingSession.pre_readiness) {
                      setSleep(existingSession.pre_readiness.sleep);
                      setEnergy(existingSession.pre_readiness.energy);
                      setSoreness(existingSession.pre_readiness.soreness);
                      setShowReadiness(true);
                    }
                    setExistingSession(null);
                    setIsEditing(true);
                    setSaving(false);
                  }}
                  className="text-blue-400 hover:text-blue-300 text-xs transition-colors"
                >
                  Edit
                </button>
              ) : null;
            })()}
          </div>

          {existingSession.pre_readiness && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-2">Pre-Session Readiness</h3>
              <div className="flex gap-4 text-sm text-zinc-400">
                <span>Sleep: {existingSession.pre_readiness.sleep}/10</span>
                <span>Energy: {existingSession.pre_readiness.energy}/10</span>
                <span>Soreness: {existingSession.pre_readiness.soreness}/10</span>
              </div>
            </div>
          )}

          {existingSession.logged_exercises?.map((ex, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              <p className="text-white font-medium text-sm mb-2">{ex.name}</p>
              <div className="space-y-1">
                {ex.sets.map((s, j) => (
                  <p key={j} className="text-zinc-400 text-sm">
                    Set {j + 1}: {s.reps} reps @ {s.weight_kg}kg
                    {s.rpe != null && ` (RPE ${s.rpe})`}
                  </p>
                ))}
              </div>
            </div>
          ))}

          {existingSession.notes && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
              <h3 className="text-sm font-medium text-zinc-300 mb-1">Notes</h3>
              <p className="text-zinc-400 text-sm">{existingSession.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <button
          onClick={() => {
            if (hasAnyData && !existingSession && !confirm("You have unsaved session data. Leave?")) return;
            router.push("/dashboard");
          }}
          className="text-zinc-400 hover:text-white text-sm transition-colors"
        >
          &larr; Dashboard
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            Week {week} &mdash; {dayData?.label ?? `Day ${day}`}
          </h1>
          <button
            type="button"
            onClick={() => setQuickMode((q) => !q)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              quickMode
                ? "bg-amber-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white"
            }`}
            title={quickMode ? "Switch to full view" : "Switch to quick log mode"}
          >
            {quickMode ? "Quick" : "Full"}
          </button>
        </div>
        {totalDays > 1 && (
          <div className="flex justify-between text-xs text-zinc-600">
            {day > 1 ? <span>&larr; Day {day - 1}</span> : <span />}
            {day < totalDays ? <span>Day {day + 1} &rarr;</span> : <span />}
          </div>
        )}
        {!quickMode && dayData?.focus && (
          <p className="text-zinc-400 text-sm">{dayData.focus}</p>
        )}

        {/* Pre-readiness (optional) */}
        {!quickMode && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowReadiness(!showReadiness)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/50 transition-colors"
            >
              <div>
                <span className="text-sm font-medium text-zinc-300">
                  Pre-Session Readiness
                </span>
                <span className="text-xs text-zinc-500 block">
                  Quick 3-tap check — helps your coach adjust your plan
                </span>
              </div>
              <span className="text-xs text-zinc-500">
                {showReadiness ? "Hide" : "Expand"}
              </span>
            </button>
            {showReadiness && (
              <div className="px-4 pb-4 border-t border-zinc-800 space-y-3 pt-3">
                <ScoreSelector label="Sleep quality" value={sleep} onChange={setSleep} max={10} disabled={saving} lowLabel="Terrible" highLabel="Amazing" />
                <ScoreSelector label="Energy level" value={energy} onChange={setEnergy} max={10} disabled={saving} lowLabel="Depleted" highLabel="Energized" />
                <ScoreSelector label="Soreness" value={soreness} onChange={setSoreness} max={10} disabled={saving} lowLabel="None" highLabel="Severe" />
              </div>
            )}
          </div>
        )}

        {/* Time adjustment */}
        {!quickMode && !existingSession && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
            <p className="text-sm font-medium text-zinc-300 mb-3">
              How much time do you have?
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAvailableMinutes(Math.max(15, (availableMinutes ?? planSessionMinutes) - 5))}
                disabled={adjusting}
                className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 active:scale-90 transition-all flex items-center justify-center text-lg"
              >
                −
              </button>
              <div className="text-center">
                <span className="text-2xl font-bold text-white">
                  {availableMinutes ?? planSessionMinutes}
                </span>
                <span className="text-sm text-zinc-500 ml-1">min</span>
              </div>
              <button
                type="button"
                onClick={() => setAvailableMinutes(Math.min(180, (availableMinutes ?? planSessionMinutes) + 5))}
                disabled={adjusting}
                className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 active:scale-90 transition-all flex items-center justify-center text-lg"
              >
                +
              </button>
              <div className="ml-auto flex items-center gap-2">
                {adjustedExercises && (
                  <button
                    type="button"
                    onClick={resetAdjustment}
                    className="px-3 py-2 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    Reset
                  </button>
                )}
                {availableMinutes !== null && availableMinutes !== planSessionMinutes && !adjustedExercises && (
                  <button
                    type="button"
                    onClick={adjustTime}
                    disabled={adjusting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-medium text-white transition-colors"
                  >
                    {adjusting ? "Adjusting..." : "Adjust"}
                  </button>
                )}
              </div>
            </div>
            {adjustSummary && (
              <p className="text-xs text-blue-400 mt-2">{adjustSummary}</p>
            )}
            {adjustError && (
              <p className="text-xs text-red-400 mt-2">{adjustError}</p>
            )}
          </div>
        )}

        {/* Exercises */}
        {plannedExercises.map((planned, exIdx) => {
          const exHasData = exerciseLogs[exIdx]?.sets.some(
            (s) => s.reps > 0 || s.weight_kg > 0
          );
          const prevData = prevWeekExercises.get(planned.name.toLowerCase());
          return (
          <div
            key={`${planned.name}-${exIdx}`}
            className={`bg-zinc-900 border rounded-2xl p-4 space-y-3 transition-colors ${
              exHasData ? "border-green-700/60" : "border-zinc-700"
            }`}
          >
            <div>
              <p className="text-white font-medium text-sm">{planned.name}</p>
              {!quickMode && prevData && !existingSession && (
                <p className="text-zinc-500 text-xs mt-0.5">
                  Last week: {prevData.weight_kg}kg x {prevData.reps}
                </p>
              )}
              {!quickMode && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {planned.sets != null && planned.reps && (
                    <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
                      Prescribed: {planned.sets} &times; {planned.reps}
                    </span>
                  )}
                  {planned.load_instruction && (
                    <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
                      {planned.load_instruction}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className={`grid ${quickMode ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-[auto_1fr_1fr_auto]"} gap-2 text-xs text-zinc-500`}>
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                {!quickMode && <span>RPE</span>}
              </div>
              {exerciseLogs[exIdx]?.sets.map((s, setIdx) => (
                <div
                  key={setIdx}
                  className={`grid ${quickMode ? "grid-cols-[auto_1fr_1fr]" : "grid-cols-[auto_1fr_1fr_auto]"} gap-2 items-center`}
                >
                  <span className="text-xs text-zinc-500 w-6 text-center">
                    {setIdx + 1}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={s.reps || ""}
                    onChange={(e) =>
                      updateSet(exIdx, setIdx, "reps", parseInt(e.target.value, 10) || 0)
                    }
                    disabled={saving}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.5}
                    value={s.weight_kg || ""}
                    onChange={(e) =>
                      updateSet(exIdx, setIdx, "weight_kg", parseFloat(e.target.value) || 0)
                    }
                    disabled={saving}
                    className="bg-zinc-800 border border-zinc-700 rounded-xl px-2 py-1.5 text-sm text-white w-full focus:outline-none focus:border-blue-500"
                    placeholder="0"
                  />
                  {!quickMode && (
                    <select
                      value={s.rpe ?? ""}
                      onChange={(e) =>
                        updateSet(
                          exIdx,
                          setIdx,
                          "rpe",
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      disabled={saving}
                      className="bg-zinc-800 border border-zinc-700 rounded-xl px-1 py-1.5 text-sm text-white w-14 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-</option>
                      {[6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ))}
            </div>

            {/* Rest timer trigger */}
            {!quickMode && exHasData && (
              <button
                type="button"
                onClick={() => startRestTimer(planned.rest_seconds)}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Start Rest ({planned.rest_seconds ?? 90}s)
              </button>
            )}
          </div>
          );
        })}

        {/* Notes */}
        {!quickMode && (
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
            <label className="text-sm font-medium text-zinc-300 block mb-2">
              Session Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="How did it go? Any observations..."
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={saving || !hasAnyData}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-xl font-medium text-white transition-colors"
        >
          {saving ? "Saving..." : !hasAnyData ? "Log at least one set to continue" : "Complete Session"}
        </button>

        {/* Bottom spacer when rest timer is active */}
        {restTimerActive && <div className="h-24" />}

        {/* Confirmation overlay */}
        {showConfirm && (
          <div
            className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-session-title"
            onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-md space-y-4">
              <h3 id="confirm-session-title" className="text-white font-semibold text-lg">Submit session?</h3>
              <p className="text-zinc-400 text-sm">
                You logged {exerciseLogs.filter((ex) => ex.sets.some((s) => s.reps > 0 || s.weight_kg > 0)).length} of {exerciseLogs.length} exercises. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  autoFocus
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-medium text-zinc-300 transition-colors"
                >
                  Go Back
                </button>
                <button
                  onClick={() => {
                    setShowConfirm(false);
                    handleSubmit();
                  }}
                  disabled={saving}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium text-white transition-colors"
                >
                  {saving ? "Saving..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rest timer */}
      <RestTimer
        defaultSeconds={restTimerSeconds}
        active={restTimerActive}
        onComplete={handleRestTimerComplete}
        onDismiss={handleRestTimerDismiss}
      />

      {/* Celebration overlay */}
      <Celebration
        show={showCelebration}
        onComplete={handleCelebrationComplete}
        message="Session Complete!"
      />
    </div>
  );
}
