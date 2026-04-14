"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import type { PeriodWeek, TrainingDay } from "@/components/PeriodizationBar";
import { normalizeWeeks } from "@/lib/normalizeWeeks";

interface ActivePlan {
  id: string;
  mesocycle_weeks: number;
  current_week: number;
  plan_data: Record<string, unknown>;
}

interface SessionSummary {
  week_number: number;
  day_number: number;
  completed_at: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [weeks, setWeeks] = useState<PeriodWeek[]>([]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }

    async function load() {
      try {
        const activePlan = await api<ActivePlan>("/plan/active");
        setPlan(activePlan);
        setWeeks(normalizeWeeks(activePlan.plan_data));

        const allSessions = await api<SessionSummary[]>(
          `/session/${activePlan.id}`
        );
        setSessions(allSessions);
      } catch {
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  if (!plan) return null;

  const completedSet = new Set(
    sessions.map((s) => `${s.week_number}-${s.day_number}`)
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-zinc-400 hover:text-white text-sm transition-colors"
        >
          &larr; Dashboard
        </button>

        <h1 className="text-xl font-semibold">Training Calendar</h1>
        <p className="text-zinc-400 text-sm">
          Week {plan.current_week} of {plan.mesocycle_weeks}
        </p>

        <div className="space-y-3">
          {weeks.map((week) => {
            const weekNum = week.week_number ?? 0;
            const isCurrent = weekNum === plan.current_week;
            const isPast = weekNum < plan.current_week;
            const days: TrainingDay[] = week.days ?? [];

            return (
              <div
                key={weekNum}
                className={`bg-zinc-900 border rounded-2xl p-4 ${
                  isCurrent
                    ? "border-blue-600/50"
                    : "border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      Week {weekNum}
                    </span>
                    {week.phase && (
                      <span className="text-xs text-zinc-500">
                        {week.phase
                          .replace(/[_-]/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                    )}
                  </div>
                  {isCurrent && (
                    <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                  {isPast && (
                    <span className="text-xs text-zinc-500">
                      {days.filter((d) =>
                        completedSet.has(
                          `${weekNum}-${d.day_number ?? 0}`
                        )
                      ).length}
                      /{days.length} done
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {days.map((day, i) => {
                    const dayNum = day.day_number ?? i + 1;
                    const isCompleted = completedSet.has(
                      `${weekNum}-${dayNum}`
                    );
                    const isClickable =
                      isCurrent || (isPast && isCompleted);

                    return (
                      <button
                        key={dayNum}
                        onClick={() => {
                          if (isClickable) {
                            router.push(
                              `/session/${plan.id}/${weekNum}/${dayNum}`
                            );
                          }
                        }}
                        disabled={!isClickable}
                        className={`flex-1 min-w-[80px] py-2 px-3 rounded-xl text-xs font-medium transition-colors ${
                          isCompleted
                            ? "bg-green-900/30 border border-green-700/50 text-green-300"
                            : isCurrent
                            ? "bg-zinc-800 border border-zinc-600 text-zinc-200 hover:bg-zinc-700"
                            : "bg-zinc-800/50 border border-zinc-800 text-zinc-600 cursor-not-allowed"
                        }`}
                      >
                        <span className="block truncate">
                          {day.label ?? `Day ${dayNum}`}
                        </span>
                        {isCompleted && (
                          <span className="text-green-400 text-[10px]">
                            Done
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
