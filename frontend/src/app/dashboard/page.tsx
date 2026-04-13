"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser, fetchUserMe, clearToken } from "@/lib/auth";
import { api } from "@/lib/api";
import { canUse, type Tier } from "@/lib/tiers";
import TierGate from "@/components/TierGate";
import WeekProgressDots from "@/components/WeekProgressDots";
import type { PeriodWeek, TrainingDay } from "@/components/PeriodizationBar";

interface ActivePlan {
  id: string;
  tier_at_creation: string;
  mesocycle_weeks: number;
  current_week: number;
  phase: string;
  plan_data: Record<string, unknown>;
  persona_used: string;
  is_active: boolean;
  milestone_pending: boolean;
}

interface SessionSummary {
  id: string;
  week_number: number;
  day_number: number;
  completed_at: string;
}

interface CheckinSummary {
  id: string;
  week_number: number;
  created_at: string;
}

interface AdaptationAdjustment {
  type: string;
  target_day: number;
  target_exercise: string;
  change: string;
  reason: string;
}

interface AdaptationSummary {
  id: string;
  week_number: number;
  assessment: string;
  adjustments: AdaptationAdjustment[];
  flags: {
    injury_risk: string[];
    recovery_concern: boolean;
    plateau_detected: boolean;
  };
  created_at: string;
}

function normalizeWeeks(planData: Record<string, unknown>): PeriodWeek[] {
  if (Array.isArray(planData.weeks)) return planData.weeks as PeriodWeek[];
  if (
    planData.plan &&
    typeof planData.plan === "object" &&
    Array.isArray((planData.plan as Record<string, unknown>).weeks)
  ) {
    return (planData.plan as Record<string, unknown>).weeks as PeriodWeek[];
  }
  if (Array.isArray(planData)) return planData as PeriodWeek[];
  if (Array.isArray(planData.plan)) return planData.plan as PeriodWeek[];
  return [];
}

const TIER_BADGE_STYLES: Record<string, string> = {
  free: "bg-zinc-700 text-zinc-200",
  pro: "bg-blue-600 text-white",
  elite: "bg-amber-600 text-white",
};

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [checkins, setCheckins] = useState<CheckinSummary[]>([]);
  const [adaptations, setAdaptations] = useState<AdaptationSummary[]>([]);
  const [adapting, setAdapting] = useState(false);
  const [userTier, setUserTier] = useState<Tier>("free");
  const [milestoneRating, setMilestoneRating] = useState(0);
  const [milestoneNotes, setMilestoneNotes] = useState("");
  const [donating, setDonating] = useState(false);
  const [milestoneDismissed, setMilestoneDismissed] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }

    async function load() {
      // Fetch tier from server (not JWT) to prevent client-side tier spoofing
      const me = await fetchUserMe();
      if (!me) {
        router.push("/");
        return;
      }
      const tier = me.tier as Tier;
      setUserTier(tier);
      try {
        const activePlan = await api<ActivePlan>("/plan/active");
        setPlan(activePlan);

        // Fetch sessions, check-ins, and adaptations in parallel
        const fetches: [Promise<SessionSummary[]>, Promise<CheckinSummary[]>, Promise<AdaptationSummary[]> | null] = [
          api<SessionSummary[]>(`/session/${activePlan.id}/${activePlan.current_week}`),
          api<CheckinSummary[]>(`/checkin/${activePlan.id}`),
          canUse(tier, "adaptation")
            ? api<AdaptationSummary[]>(`/plan/${activePlan.id}/adaptations`)
            : null,
        ];
        const [weekSessions, planCheckins] = await Promise.all([fetches[0], fetches[1]]);
        setSessions(weekSessions);
        setCheckins(planCheckins);
        if (fetches[2]) {
          const adaptationLogs = await fetches[2];
          setAdaptations(adaptationLogs);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to load";
        if (msg === "No active plan") {
          router.push("/onboarding");
          return;
        }
        setError(msg);
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

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <p className="text-red-400 font-medium mb-4">
            {error || "Something went wrong."}
          </p>
          <button
            onClick={() => router.push("/")}
            className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    );
  }

  // Compute current week's days from plan_data
  const weeks = normalizeWeeks(plan.plan_data);
  const currentWeekData =
    weeks.find((w) => w.week_number === plan.current_week) ??
    weeks[plan.current_week - 1] ??
    null;
  const days: TrainingDay[] = currentWeekData?.days ?? [];
  const completedDayNumbers = sessions.map((s) => s.day_number);
  const currentWeekCheckin = checkins.find(
    (c) => c.week_number === plan.current_week
  );

  // Find next uncompleted day
  const nextDay = days.find(
    (d) => !completedDayNumbers.includes(d.day_number ?? 0)
  );
  const nextDayNumber = nextDay?.day_number ?? (days.length > 0 ? days.findIndex(
    (d) => !completedDayNumbers.includes(d.day_number ?? 0)
  ) + 1 : 0);

  const allSessionsDone =
    days.length > 0 && completedDayNumbers.length >= days.length;

  const tier = plan.tier_at_creation as Tier;
  const badgeStyle = TIER_BADGE_STYLES[tier] ?? TIER_BADGE_STYLES.free;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <div className="flex items-center gap-2">
            <div className={`${badgeStyle} rounded-lg px-3 py-1.5 text-xs font-medium`}>
              {plan.persona_used ?? "Coach"}
            </div>
            <button
              onClick={() => {
                clearToken();
                router.push("/");
              }}
              className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Log out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
            </button>
          </div>
        </div>

        {/* Week info */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-zinc-300">
              Week {plan.current_week} of {plan.mesocycle_weeks}
            </h2>
            {currentWeekData?.phase && (
              <span className="text-xs text-zinc-500">
                {currentWeekData.phase.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
              </span>
            )}
          </div>
          <WeekProgressDots
            totalDays={days.length}
            completedDays={completedDayNumbers}
            hasCheckin={!!currentWeekCheckin}
          />
        </div>

        {/* Free tier banner */}
        {userTier === "free" && (
          <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-4">
            <p className="text-zinc-400 text-sm">
              You&apos;re using the free plan. Upgrade for AI-powered weekly
              adaptations.{" "}
              <a
                href="/"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Learn more
              </a>
            </p>
          </div>
        )}

        {/* Milestone donation card */}
        {plan.milestone_pending && canUse(userTier, "collective") && !milestoneDismissed && (
          <div className="bg-purple-900/20 border border-purple-700/50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-medium text-purple-300">
              3-Week Milestone!
            </h3>
            <p className="text-zinc-400 text-sm">
              Rate your progress to help others with similar goals get better plans.
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setMilestoneRating(star)}
                  className={`w-10 h-10 rounded-lg text-lg font-medium transition-colors ${
                    milestoneRating >= star
                      ? "bg-purple-600 text-white"
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                  }`}
                >
                  {star}
                </button>
              ))}
            </div>
            <textarea
              value={milestoneNotes}
              onChange={(e) => setMilestoneNotes(e.target.value)}
              placeholder="Any notes? (optional)"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <button
              onClick={async () => {
                if (!milestoneRating || donating) return;
                setDonating(true);
                try {
                  await api<{ milestone_pending: boolean }>(`/collective/${plan.id}/donate`, {
                    method: "POST",
                    body: JSON.stringify({
                      success_score: milestoneRating,
                      notes: milestoneNotes || null,
                    }),
                  });
                  setMilestoneDismissed(true);
                  setPlan((prev) => prev ? { ...prev, milestone_pending: false } : prev);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Donation failed");
                } finally {
                  setDonating(false);
                }
              }}
              disabled={!milestoneRating || donating}
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors ${
                milestoneRating && !donating
                  ? "bg-purple-600 hover:bg-purple-500 text-white"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              {donating ? "Submitting..." : "Donate & Continue"}
            </button>
          </div>
        )}

        {/* Today's session card */}
        {nextDay && !allSessionsDone ? (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">
              Next Session
            </h3>
            <p className="text-white font-medium">
              {nextDay.label ?? `Day ${nextDayNumber}`}
            </p>
            {nextDay.focus && (
              <p className="text-zinc-400 text-sm mt-0.5">{nextDay.focus}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-zinc-500">
                {(nextDay.exercises ?? []).length} exercise
                {(nextDay.exercises ?? []).length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() =>
                router.push(
                  `/session/${plan.id}/${plan.current_week}/${nextDayNumber}`
                )
              }
              className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm text-white transition-colors"
            >
              Start Session
            </button>
          </div>
        ) : allSessionsDone && !currentWeekCheckin ? (
          <div className="bg-zinc-900 border border-blue-700/50 rounded-xl p-4">
            <h3 className="text-sm font-medium text-blue-400 mb-1">
              All sessions complete!
            </h3>
            <p className="text-zinc-400 text-sm">
              Submit your weekly check-in to wrap up this week.
            </p>
            <button
              onClick={() =>
                router.push(`/checkin/${plan.id}/${plan.current_week}`)
              }
              className="mt-3 w-full py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-sm text-white transition-colors"
            >
              Weekly Check-in
            </button>
          </div>
        ) : allSessionsDone && currentWeekCheckin ? (
          <div className="bg-green-900/20 border border-green-700/50 rounded-xl p-4">
            <p className="text-green-300 text-sm font-medium">
              Week {plan.current_week} complete! Great work.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-center">
            <p className="text-zinc-400 text-sm">
              No training days found for this week.
            </p>
          </div>
        )}

        {/* Latest adaptation card */}
        {adaptations.length > 0 && canUse(userTier, "adaptation") && (() => {
          const latest = adaptations[0];
          return (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">
                  Week {latest.week_number} Adaptation
                </h3>
                {latest.created_at && (
                  <span className="text-xs text-zinc-500">
                    {new Date(latest.created_at).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-300">{latest.assessment}</p>
              {latest.adjustments.length > 0 && (
                <div className="space-y-1">
                  {latest.adjustments.slice(0, 3).map((adj, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 font-medium ${
                        adj.type === "load_change" ? "bg-blue-900/50 text-blue-300" :
                        adj.type === "volume_change" ? "bg-purple-900/50 text-purple-300" :
                        adj.type === "exercise_swap" ? "bg-amber-900/50 text-amber-300" :
                        adj.type === "deload_trigger" ? "bg-red-900/50 text-red-300" :
                        "bg-zinc-800 text-zinc-300"
                      }`}>
                        {adj.type.replace("_", " ")}
                      </span>
                      <span className="text-zinc-400">
                        {adj.target_exercise}: {adj.change}
                      </span>
                    </div>
                  ))}
                  {latest.adjustments.length > 3 && (
                    <p className="text-xs text-zinc-500">
                      +{latest.adjustments.length - 3} more adjustment{latest.adjustments.length - 3 !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              )}
              {latest.flags && (
                <>
                  {(latest.flags.injury_risk ?? []).length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <span>Injury risk:</span>
                      <span className="text-amber-300">{latest.flags.injury_risk.join(", ")}</span>
                    </div>
                  )}
                  {latest.flags.recovery_concern && (
                    <p className="text-xs text-orange-400">Recovery concern flagged</p>
                  )}
                  {latest.flags.plateau_detected && (
                    <p className="text-xs text-zinc-400">Plateau detected — adjustments made</p>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* Quick actions */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-zinc-400">Quick Actions</h3>

          {/* View full plan */}
          <button
            onClick={() => router.push(`/plan/${plan.id}`)}
            className="w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl p-3 hover:bg-zinc-800/50 transition-colors"
          >
            <span className="text-sm text-white">View Full Plan</span>
            <span className="text-xs text-zinc-500 ml-2">
              Browse all weeks and exercises
            </span>
          </button>

          {/* Calendar view */}
          <button
            onClick={() => router.push("/calendar")}
            className="w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl p-3 hover:bg-zinc-800/50 transition-colors"
          >
            <span className="text-sm text-white">Training Calendar</span>
            <span className="text-xs text-zinc-500 ml-2">
              See all weeks at a glance
            </span>
          </button>

          {/* Log a past session */}
          {days.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3">
              <span className="text-sm text-white block mb-2">
                Log a Past Session
              </span>
              <div className="flex flex-wrap gap-2">
                {days.map((d, i) => {
                  const dn = d.day_number ?? i + 1;
                  const done = completedDayNumbers.includes(dn);
                  return (
                    <button
                      key={dn}
                      onClick={() =>
                        router.push(
                          `/session/${plan.id}/${plan.current_week}/${dn}`
                        )
                      }
                      disabled={done}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        done
                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {d.label ?? `Day ${dn}`}
                      {done && " ✓"}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly check-in */}
          {sessions.length >= 1 && !currentWeekCheckin && (
            <button
              onClick={() =>
                router.push(`/checkin/${plan.id}/${plan.current_week}`)
              }
              className="w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl p-3 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-sm text-white">Weekly Check-in</span>
              <span className="text-xs text-zinc-500 ml-2">
                Recovery, mood, sleep, weight
              </span>
            </button>
          )}

          {/* Adapt plan (tier-gated) */}
          {canUse(userTier, "adaptation") ? (
            <button
              onClick={async () => {
                if (adapting || !plan || plan.current_week <= 1) return;
                setAdapting(true);
                try {
                  const result = await api<AdaptationSummary & { adapted?: boolean }>(`/plan/${plan.id}/adapt`, { method: "POST" });
                  if (result.adapted !== false && result.assessment) {
                    setAdaptations((prev) => [result as AdaptationSummary, ...prev]);
                    const updatedPlan = await api<ActivePlan>("/plan/active");
                    setPlan(updatedPlan);
                  }
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Adaptation failed");
                } finally {
                  setAdapting(false);
                }
              }}
              disabled={adapting || plan.current_week <= 1}
              className={`w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl p-3 transition-colors ${
                adapting || plan.current_week <= 1
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:bg-zinc-800/50"
              }`}
            >
              <span className="text-sm text-white">
                {adapting ? "Adapting..." : "Adapt My Plan"}
              </span>
              {adapting ? (
                <span className="inline-block ml-2 w-3 h-3 rounded-full border border-zinc-600 border-t-blue-400 animate-spin align-middle" />
              ) : (
                <span className="text-xs text-zinc-500 ml-2">
                  {plan.current_week <= 1
                    ? "Complete a week first"
                    : "AI analyses your progress and adjusts next week"}
                </span>
              )}
            </button>
          ) : (
            <TierGate
              feature="adaptation"
              currentTier={userTier}
              title="AI Plan Adaptation"
              description="Get your plan automatically adjusted based on your weekly progress."
              requiredTier="pro"
            />
          )}

          {/* Profile & Settings */}
          <button
            onClick={() => router.push("/settings")}
            className="w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl p-3 hover:bg-zinc-800/50 transition-colors"
          >
            <span className="text-sm text-white">Profile &amp; Settings</span>
            <span className="text-xs text-zinc-500 ml-2">
              Edit profile, change password, manage subscription
            </span>
          </button>

          {/* Coach chat (elite-only) */}
          {canUse(userTier, "coach_chat") ? (
            <button
              onClick={() => router.push("/chat")}
              className="w-full text-left bg-zinc-900 border border-zinc-700 rounded-xl p-3 hover:bg-zinc-800/50 transition-colors"
            >
              <span className="text-sm text-white">Chat with Coach</span>
              <span className="text-xs text-zinc-500 ml-2">
                Ask your AI coach anything about your training
              </span>
            </button>
          ) : userTier === "pro" ? (
            <TierGate
              feature="coach_chat"
              currentTier={userTier}
              title="AI Coach Chat"
              description="Chat directly with your AI coach. Ask questions, get advice, modify your plan through conversation."
              requiredTier="elite"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
