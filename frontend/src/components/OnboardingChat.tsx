"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Tier } from "@/lib/tiers";

interface ProfileCreate {
  goal: "fat_loss" | "muscle" | "performance" | "wellness";
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female";
  experience: "beginner" | "intermediate" | "advanced";
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
  injuries: string | null;
  sleep_hours: number;
  stress_level: 1 | 2 | 3 | 4 | 5;
  job_activity: "sedentary" | "light" | "active";
  diet_style: "omnivore" | "vegetarian" | "vegan" | "keto" | "halal" | "other";
  sport?: string;
  competition_date?: string | null;
}

const GOALS = [
  { id: "fat_loss" as const, label: "Lose Fat", sub: "Burn fat, get lean" },
  { id: "muscle" as const, label: "Build Muscle", sub: "Size and strength" },
  { id: "performance" as const, label: "Boost Performance", sub: "Faster, stronger, better" },
  { id: "wellness" as const, label: "General Wellness", sub: "Health and longevity" },
];

const EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "pull_up_bar", label: "Pull-up Bar" },
  { id: "cables", label: "Cables" },
  { id: "machines", label: "Machines" },
  { id: "bands", label: "Resistance Bands" },
  { id: "bodyweight_only", label: "Bodyweight Only" },
];

const SPORT_OPTIONS = [
  { id: "swimming", label: "Swimming", emoji: "\u{1F3CA}" },
  { id: "running", label: "Running / Track", emoji: "\u{1F3C3}" },
  { id: "powerlifting", label: "Powerlifting", emoji: "\u{1F3CB}\uFE0F" },
  { id: "crossfit", label: "CrossFit", emoji: "\u{1F4AA}" },
  { id: "basketball", label: "Basketball", emoji: "\u{1F3C0}" },
  { id: "soccer", label: "Soccer", emoji: "\u26BD" },
  { id: "tennis", label: "Tennis", emoji: "\u{1F3BE}" },
  { id: "mma", label: "MMA", emoji: "\u{1F94A}" },
  { id: "cycling", label: "Cycling", emoji: "\u{1F6B4}" },
];

const GREETINGS = [
  "Let\u2019s build your perfect programme",
  "Good choice. Quick body stats",
  "How experienced are you?",
  "What does your training week look like?",
  "Last one \u2014 lifestyle context",
  "Now let\u2019s dial in your sport",
  "Competition peaking?",
];

const DURATION_OPTIONS = [30, 45, 60, 75, 90];

const DIET_OPTIONS: { id: ProfileCreate["diet_style"]; label: string }[] = [
  { id: "omnivore", label: "Omnivore" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "keto", label: "Keto" },
  { id: "halal", label: "Halal" },
  { id: "other", label: "Other" },
];

const STORAGE_KEY = "fitai_onboarding";

export default function OnboardingChat({ tier }: { tier: Tier }) {
  const router = useRouter();
  const totalSteps = tier === "elite" ? 7 : 5;

  // Restore progress from sessionStorage on mount
  const [step, setStep] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).step ?? 1;
    } catch { /* ignore */ }
    return 1;
  });
  const [answers, setAnswers] = useState<Partial<ProfileCreate>>(() => {
    if (typeof window === "undefined") return { equipment: [] };
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).answers ?? { equipment: [] };
    } catch { /* ignore */ }
    return { equipment: [] };
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showOtherSport, setShowOtherSport] = useState(false);
  const [otherSportText, setOtherSportText] = useState("");
  const [competing, setCompeting] = useState(false);

  // Persist progress to sessionStorage on every change
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, answers }));
    } catch { /* ignore */ }
  }, [step, answers]);

  function update<K extends keyof ProfileCreate>(key: K, value: ProfileCreate[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function canAdvance(): boolean {
    switch (step) {
      case 1: return !!answers.goal;
      case 2: return !!answers.age && !!answers.weight_kg && !!answers.height_cm && !!answers.sex;
      case 3: return !!answers.experience;
      case 4: return !!answers.days_per_week && !!answers.session_minutes && (answers.equipment?.length ?? 0) > 0;
      case 5: return !!answers.sleep_hours && !!answers.stress_level && !!answers.job_activity && !!answers.diet_style;
      case 6: return !!answers.sport;
      case 7: return !competing || !!answers.competition_date;
      default: return false;
    }
  }

  function next() {
    if (!canAdvance()) {
      setError("Please fill in all required fields");
      return;
    }
    setError("");
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  }

  function back() {
    if (step > 1) {
      setError("");
      setStep(step - 1);
    }
  }

  function toggleEquipment(id: string) {
    const current = answers.equipment ?? [];
    if (id === "bodyweight_only") {
      update("equipment", current.includes("bodyweight_only") ? [] : ["bodyweight_only"]);
    } else {
      const without = current.filter((e) => e !== "bodyweight_only" && e !== id);
      if (current.includes(id)) {
        update("equipment", without);
      } else {
        update("equipment", [...without, id]);
      }
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      await api("/profile", {
        method: "POST",
        body: JSON.stringify(answers),
      });
      sessionStorage.removeItem(STORAGE_KEY);
      router.push("/plan/loading");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const minCompDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const isFinalStep = step === totalSteps;
  const ctaLabel = isFinalStep
    ? submitting
      ? "Saving..."
      : tier === "elite"
        ? "Generate my elite plan"
        : "Generate my plan"
    : "Continue";

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-white px-4 py-8">
      <div className="w-full max-w-lg mx-auto">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-6">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i + 1 <= step ? "bg-blue-500" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* Back arrow */}
        {step > 1 && (
          <button
            onClick={back}
            className="mb-4 text-zinc-400 hover:text-white transition-colors text-sm flex items-center gap-1"
          >
            <span>&larr;</span> Back
          </button>
        )}

        {/* Greeting */}
        <h2 className="text-2xl font-bold mb-6">{GREETINGS[step - 1]}</h2>

        {/* Step content */}
        <div className="space-y-4">
          {/* Step 1: Goal */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    update("goal", g.id);
                    setError("");
                    setStep(2);
                  }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    answers.goal === g.id
                      ? "border-blue-500 bg-zinc-800"
                      : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                  }`}
                >
                  <div className="font-semibold mb-1">{g.label}</div>
                  <div className="text-sm text-zinc-400">{g.sub}</div>
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Body stats */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Age</label>
                <input
                  type="number"
                  min={13}
                  max={100}
                  value={answers.age ?? ""}
                  onChange={(e) => update("age", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="25"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    min={30}
                    max={300}
                    step={0.1}
                    value={answers.weight_kg ?? ""}
                    onChange={(e) => update("weight_kg", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="75"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    min={100}
                    max={250}
                    step={0.1}
                    value={answers.height_cm ?? ""}
                    onChange={(e) => update("height_cm", parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="175"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Sex</label>
                <div className="flex gap-2">
                  {(["male", "female"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update("sex", s)}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                        answers.sex === s
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Experience */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-3">
                {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => update("experience", level)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      answers.experience === level
                        ? "border-blue-500 bg-zinc-800"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                    }`}
                  >
                    <div className="font-semibold">{level.charAt(0).toUpperCase() + level.slice(1)}</div>
                    <div className="text-sm text-zinc-400">
                      {level === "beginner" && "Less than 1 year of consistent training"}
                      {level === "intermediate" && "1\u20133 years of consistent training"}
                      {level === "advanced" && "3+ years of structured training"}
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Any injuries or limitations?</label>
                <input
                  type="text"
                  value={answers.injuries ?? ""}
                  onChange={(e) => update("injuries", e.target.value || null)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional \u2014 e.g. bad knee, shoulder issue"
                />
              </div>
            </div>
          )}

          {/* Step 4: Schedule + equipment */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Days per week</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => update("days_per_week", d)}
                      className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                        answers.days_per_week === d
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Session length (min)</label>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => update("session_minutes", m)}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                        answers.session_minutes === m
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Equipment available</label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((eq) => {
                    const isSelected = answers.equipment?.includes(eq.id) ?? false;
                    return (
                      <button
                        key={eq.id}
                        type="button"
                        onClick={() => toggleEquipment(eq.id)}
                        className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        {isSelected && <span className="mr-1">{"\u2713"}</span>}
                        {eq.label}
                      </button>
                    );
                  })}
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  {answers.equipment?.length ?? 0} selected
                </p>
              </div>
            </div>
          )}

          {/* Step 5: Lifestyle */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Average sleep (hours)</label>
                <input
                  type="number"
                  min={3}
                  max={12}
                  step={0.5}
                  value={answers.sleep_hours ?? ""}
                  onChange={(e) => update("sleep_hours", parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="7.5"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Stress level</label>
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 5] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update("stress_level", s)}
                      className={`w-12 h-10 rounded-lg font-medium text-sm transition-colors ${
                        answers.stress_level === s
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Daily activity level</label>
                <div className="flex gap-2">
                  {(["sedentary", "light", "active"] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => update("job_activity", a)}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                        answers.job_activity === a
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {a.charAt(0).toUpperCase() + a.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Diet style</label>
                <div className="grid grid-cols-3 gap-2">
                  {DIET_OPTIONS.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => update("diet_style", d.id)}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        answers.diet_style === d.id
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 6: Sport (elite only) */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {SPORT_OPTIONS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      update("sport", s.id);
                      setShowOtherSport(false);
                      setError("");
                      setStep(7);
                    }}
                    className={`text-left p-4 rounded-xl border-2 transition-all ${
                      answers.sport === s.id
                        ? "border-blue-500 bg-zinc-800"
                        : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                    }`}
                  >
                    <div className="text-2xl mb-1">{s.emoji}</div>
                    <div className="font-semibold text-sm">{s.label}</div>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setShowOtherSport(true);
                    update("sport", otherSportText || undefined);
                  }}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${
                    showOtherSport
                      ? "border-blue-500 bg-zinc-800"
                      : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                  }`}
                >
                  <div className="text-2xl mb-1">{"\u{1F3C6}"}</div>
                  <div className="font-semibold text-sm">Other</div>
                </button>
              </div>
              {showOtherSport && (
                <div>
                  <input
                    type="text"
                    value={otherSportText}
                    onChange={(e) => {
                      setOtherSportText(e.target.value);
                      update("sport", e.target.value || undefined);
                    }}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter your sport"
                    autoFocus
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 7: Competition (elite only) */}
          {step === 7 && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Are you preparing for a competition?</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCompeting(true);
                    }}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                      competing
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCompeting(false);
                      update("competition_date", null);
                    }}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                      !competing
                        ? "bg-blue-600 text-white"
                        : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              {competing && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Competition date</label>
                  <input
                    type="date"
                    min={minCompDate}
                    value={answers.competition_date ?? ""}
                    onChange={(e) => update("competition_date", e.target.value || null)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-zinc-500 mt-1">
                    Your plan will be periodized to peak on this date
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mt-4">{error}</p>
        )}

        {/* CTA button (not shown on step 1 since goal cards auto-advance) */}
        {step !== 1 && (
          <button
            onClick={next}
            disabled={submitting}
            className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {ctaLabel}
          </button>
        )}

        {/* Show "Other" sport continue button when other is selected */}
        {step === 6 && showOtherSport && otherSportText.trim() && (
          <button
            onClick={() => {
              update("sport", otherSportText.trim());
              setError("");
              setStep(7);
            }}
            className="w-full mt-3 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
