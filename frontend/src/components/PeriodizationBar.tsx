"use client";

import type { Tier } from "@/lib/tiers";

export interface PeriodWeek {
  week_number: number;
  phase?: string;
  days?: TrainingDay[];
}

export interface TrainingDay {
  day_number?: number;
  label?: string;
  focus?: string;
  exercises?: Exercise[];
  warmup?: string;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  load_instruction?: string;
  rest_seconds?: number;
  notes?: string;
  swap_options?: string[];
  sport_justification?: string;
}

interface PeriodizationBarProps {
  weeks: PeriodWeek[];
  currentWeek: number;
  selectedWeek: number;
  onWeekSelect: (week: number) => void;
  tier: Tier;
  competitionDate?: string | null;
}

const PHASE_COLORS: Record<string, string> = {
  accumulation: "bg-blue-700",
  gpp: "bg-blue-700",
  intensification: "bg-blue-500",
  "sport-specific": "bg-blue-500",
  "sport_specific": "bg-blue-500",
  deload: "bg-zinc-600",
  recovery: "bg-zinc-600",
  peak: "bg-amber-500",
  taper: "bg-amber-500",
  "pre-competition": "bg-amber-500",
  "pre_competition": "bg-amber-500",
};

function getPhaseColor(phase: string | undefined): string {
  if (!phase) return "bg-zinc-700";
  const key = phase.toLowerCase().replace(/\s+/g, "-");
  return PHASE_COLORS[key] ?? "bg-zinc-700";
}

function formatPhaseLabel(phase: string): string {
  return phase
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PhaseGroup {
  phase: string;
  startIdx: number;
  count: number;
}

function groupPhases(weeks: PeriodWeek[]): PhaseGroup[] {
  const groups: PhaseGroup[] = [];
  for (let i = 0; i < weeks.length; i++) {
    const phase = weeks[i].phase ?? "Training";
    const last = groups[groups.length - 1];
    if (last && last.phase === phase) {
      last.count++;
    } else {
      groups.push({ phase, startIdx: i, count: 1 });
    }
  }
  return groups;
}

export default function PeriodizationBar({
  weeks,
  currentWeek,
  selectedWeek,
  onWeekSelect,
  competitionDate,
}: PeriodizationBarProps) {
  if (weeks.length === 0) return null;

  const groups = groupPhases(weeks);

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold text-sm">Mesocycle Overview</h3>
        {competitionDate && (
          <span className="text-amber-400 text-xs font-medium">
            Competition: {new Date(competitionDate).toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Week segments */}
      <div className="flex gap-0.5 overflow-x-auto pb-1">
        {weeks.map((week, i) => {
          const weekNum = week.week_number ?? i + 1;
          const isSelected = weekNum === selectedWeek;
          const isCurrent = weekNum === currentWeek;

          return (
            <button
              key={weekNum}
              onClick={() => onWeekSelect(weekNum)}
              className={`
                relative flex-1 min-w-[32px] h-8 rounded-sm transition-all
                ${getPhaseColor(week.phase)}
                ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-900" : ""}
                ${isCurrent && !isSelected ? "ring-1 ring-blue-400" : ""}
                hover:brightness-110
              `}
              title={`Week ${weekNum}${week.phase ? ` — ${formatPhaseLabel(week.phase)}` : ""}`}
            >
              <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white/80">
                {weekNum}
              </span>
            </button>
          );
        })}

        {competitionDate && (
          <div className="min-w-[24px] h-8 flex items-center justify-center" title="Competition">
            <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 6l7-4 7 4v2l-7 4-7-4V6zm7 6l5.196-2.971L17 10v2l-7 4-7-4v-2l1.804-1.029L10 12z" />
            </svg>
          </div>
        )}
      </div>

      {/* Phase labels */}
      <div className="flex gap-0.5 mt-2">
        {groups.map((group) => (
          <div
            key={`${group.phase}-${group.startIdx}`}
            className="text-center"
            style={{ flex: group.count }}
          >
            <span className="text-[10px] text-zinc-400 truncate block">
              {formatPhaseLabel(group.phase)}
            </span>
          </div>
        ))}
      </div>

      {/* Phase color legend */}
      {(() => {
        const uniquePhases = Array.from(
          new Map(
            weeks
              .filter((w) => w.phase)
              .map((w) => {
                const key = w.phase!.toLowerCase().replace(/\s+/g, "-");
                return [getPhaseColor(w.phase), { color: getPhaseColor(w.phase), label: formatPhaseLabel(w.phase!), key }];
              })
          ).values()
        );
        if (uniquePhases.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-zinc-800">
            {uniquePhases.map((p) => (
              <div key={p.key} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${p.color}`} />
                <span className="text-xs text-zinc-400">{p.label}</span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
