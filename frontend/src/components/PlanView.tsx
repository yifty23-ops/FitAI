"use client";

import { useState } from "react";
import type { Tier } from "@/lib/tiers";
import type { PeriodWeek, TrainingDay, Exercise } from "./PeriodizationBar";

interface PlanViewProps {
  week: PeriodWeek;
  tier: Tier;
}

function ExerciseRow({
  exercise,
  tier,
}: {
  exercise: Exercise;
  tier: Tier;
}) {
  const [swapIdx, setSwapIdx] = useState(0);
  const hasSwaps =
    exercise.swap_options && exercise.swap_options.length > 0;

  const displayName =
    swapIdx > 0 && hasSwaps
      ? exercise.swap_options![swapIdx - 1]
      : exercise.name;

  return (
    <div className="py-3 border-b border-zinc-800 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-white font-medium text-sm">{displayName}</p>
          {swapIdx > 0 && (
            <p className="text-zinc-600 text-xs line-through mt-0.5">
              {exercise.name}
            </p>
          )}
          {tier === "elite" && exercise.sport_justification && (
            <p className="text-zinc-500 text-xs italic mt-0.5">
              {exercise.sport_justification}
            </p>
          )}
        </div>
        {hasSwaps && (
          <button
            onClick={() =>
              setSwapIdx((prev) =>
                prev >= exercise.swap_options!.length ? 0 : prev + 1
              )
            }
            className="text-xs text-blue-400 hover:text-blue-300 shrink-0 transition-colors"
          >
            {swapIdx > 0 ? "Undo" : "Swap"}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {exercise.sets != null && exercise.reps && (
          <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-300">
            {exercise.sets} &times; {exercise.reps}
          </span>
        )}
        {exercise.load_instruction && (
          <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-300">
            {exercise.load_instruction}
          </span>
        )}
        {exercise.rest_seconds != null && (
          <span className="text-xs px-2 py-0.5 bg-zinc-800 rounded-full text-zinc-400">
            {exercise.rest_seconds}s rest
          </span>
        )}
      </div>

      {exercise.notes && (
        <p className="text-zinc-500 text-xs mt-1.5">{exercise.notes}</p>
      )}
    </div>
  );
}

function DayCard({
  day,
  tier,
  defaultOpen,
}: {
  day: TrainingDay;
  tier: Tier;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const exercises = day.exercises ?? [];
  const label = day.label ?? `Day ${day.day_number ?? "?"}`;
  const focus = day.focus ?? "";

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="min-w-0">
          <p className="text-white font-medium">{label}</p>
          {focus && (
            <p className="text-zinc-400 text-sm mt-0.5 truncate">{focus}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {exercises.length} exercise{exercises.length !== 1 ? "s" : ""}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
            />
          </svg>
        </div>
      </button>

      {open && exercises.length > 0 && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          {day.warmup && (
            <p className="text-zinc-500 text-xs py-2 border-b border-zinc-800">
              Warmup: {day.warmup}
            </p>
          )}
          {exercises.map((ex, i) => (
            <ExerciseRow key={`${ex.name}-${i}`} exercise={ex} tier={tier} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlanView({ week, tier }: PlanViewProps) {
  const days = week.days ?? [];

  if (days.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 text-center">
        <p className="text-zinc-400">No training days for this week.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((day, i) => (
        <DayCard
          key={`day-${day.day_number ?? i}`}
          day={day}
          tier={tier}
          defaultOpen={i === 0}
        />
      ))}
    </div>
  );
}
