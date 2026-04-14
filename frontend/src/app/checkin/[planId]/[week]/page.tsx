"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api } from "@/lib/api";
import ScoreSelector from "@/components/ScoreSelector";

interface CheckinData {
  id: string;
  plan_id: string;
  week_number: number;
  recovery_score: number;
  mood_score: number;
  sleep_avg: number;
  weight_kg: number | null;
  notes: string | null;
  created_at: string;
}

export default function CheckinPage({
  params,
}: {
  params: Promise<{ planId: string; week: string }>;
}) {
  const { planId, week: weekStr } = use(params);
  const week = parseInt(weekStr, 10);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [existing, setExisting] = useState<CheckinData | null>(null);

  const [recovery, setRecovery] = useState(5);
  const [mood, setMood] = useState(5);
  const [sleepAvg, setSleepAvg] = useState(7);
  const [weightKg, setWeightKg] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  // Escape key closes confirmation modal
  useEffect(() => {
    if (!showConfirm) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowConfirm(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showConfirm]);

  // Warn before navigating away with unsaved data
  const hasCheckinData = recovery !== 5 || mood !== 5 || sleepAvg !== 7 || weightKg !== "" || notes !== "";
  useEffect(() => {
    if (!hasCheckinData || existing) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasCheckinData, existing]);

  useEffect(() => {
    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }

    async function load() {
      try {
        const checkins = await api<CheckinData[]>(`/checkin/${planId}`);
        const found = checkins.find((c) => c.week_number === week);
        if (found) setExisting(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load check-in data.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [planId, week, router]);

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await api(`/checkin/${planId}/${week}`, {
        method: "POST",
        body: JSON.stringify({
          recovery_score: recovery,
          mood_score: mood,
          sleep_avg: sleepAvg,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          notes: notes || null,
        }),
      });
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit check-in.");
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

  // Read-only if already submitted
  if (existing) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white pb-20">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            &larr; Dashboard
          </button>

          <h1 className="text-xl font-semibold">Week {week} Check-in</h1>

          <div className="bg-green-900/20 border border-green-700/50 rounded-2xl p-3">
            <p className="text-green-300 text-sm font-medium">
              Submitted on{" "}
              {new Date(existing.created_at).toLocaleDateString()}
            </p>
          </div>

          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Recovery</span>
              <span className="text-white">{existing.recovery_score}/10</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Mood</span>
              <span className="text-white">{existing.mood_score}/10</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-400">Avg Sleep</span>
              <span className="text-white">{existing.sleep_avg}h</span>
            </div>
            {existing.weight_kg != null && (
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">Weight</span>
                <span className="text-white">{existing.weight_kg}kg</span>
              </div>
            )}
            {existing.notes && (
              <div className="pt-2 border-t border-zinc-800">
                <p className="text-zinc-400 text-sm">{existing.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <button
          onClick={() => {
            if (hasCheckinData && !existing && !confirm("You have unsaved check-in data. Leave?")) return;
            router.push("/dashboard");
          }}
          className="text-zinc-400 hover:text-white text-sm transition-colors"
        >
          &larr; Dashboard
        </button>

        <h1 className="text-xl font-semibold">Week {week} Check-in</h1>
        <p className="text-zinc-400 text-sm">
          How did this week go? Your feedback helps track progress.
        </p>

        <div className="space-y-5">
          <ScoreSelector
            label="Recovery"
            value={recovery}
            onChange={setRecovery}
            max={10}
            disabled={saving}
            lowLabel="Exhausted"
            highLabel="Fully recovered"
          />

          <ScoreSelector
            label="Mood"
            value={mood}
            onChange={setMood}
            max={10}
            disabled={saving}
            lowLabel="Terrible"
            highLabel="Excellent"
          />

          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-2">
              Average sleep (hours)
            </label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={24}
              step={0.5}
              value={sleepAvg}
              onChange={(e) => setSleepAvg(parseFloat(e.target.value) || 0)}
              disabled={saving}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-2">
              Current weight <span className="text-zinc-500">optional</span>
            </label>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={20}
                max={500}
                step={0.1}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                disabled={saving}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 pr-10 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                placeholder="e.g. 75.5"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">kg</span>
            </div>
          </div>

          <div>
            <label className="text-zinc-300 text-sm font-medium block mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
              placeholder="Anything notable this week..."
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={() => setShowConfirm(true)}
          disabled={saving}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-xl font-medium text-white transition-colors"
        >
          {saving ? "Submitting..." : "Submit Check-in"}
        </button>

        {/* Confirmation overlay */}
        {showConfirm && (
          <div
            className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-checkin-title"
            onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-md space-y-4">
              <h3 id="confirm-checkin-title" className="text-white font-semibold text-lg">Submit check-in?</h3>
              <div className="text-zinc-400 text-sm space-y-1">
                <p>Recovery: {recovery}/10 &middot; Mood: {mood}/10</p>
                <p>Sleep: {sleepAvg}h{weightKg ? ` \u00b7 Weight: ${weightKg}kg` : ""}</p>
              </div>
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
                  {saving ? "Submitting..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
