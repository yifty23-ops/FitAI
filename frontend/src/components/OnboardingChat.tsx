"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Tier, canUse } from "@/lib/tiers";

// --- Types ---

interface StrengthBenchmark {
  weight: number;
  reps: number;
}

interface ProfileCreate {
  goal: "fat_loss" | "muscle" | "performance" | "wellness";
  goal_sub_category: string;
  body_fat_est: string;
  goal_deadline: string | null;
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: "male" | "female";
  experience: "beginner" | "intermediate" | "advanced";
  training_age_years: number;
  training_recency: string;
  current_max_bench: StrengthBenchmark | null;
  current_max_squat: StrengthBenchmark | null;
  current_max_deadlift: StrengthBenchmark | null;
  injury_ortho_history: string | null;
  current_pain_level: number;
  chair_stand_proxy: boolean | null;
  overhead_reach_proxy: boolean | null;
  training_days_specific: string[];
  days_per_week: number;
  session_minutes: number;
  equipment: string[];
  sleep_hours: number;
  stress_level: number;
  job_activity: string;
  protein_intake_check: string;
  diet_style: string;
  exercise_blacklist: string[];
  injuries: string | null;
  sport?: string;
  competition_date?: string | null;
  sport_phase?: string;
  sport_weekly_hours?: number;
}

// --- Constants ---

const GOALS = [
  { id: "fat_loss" as const, label: "Lose Fat", sub: "Burn fat, get lean" },
  { id: "muscle" as const, label: "Build Muscle", sub: "Size and strength" },
  { id: "performance" as const, label: "Boost Performance", sub: "Faster, stronger, better" },
  { id: "wellness" as const, label: "General Wellness", sub: "Health and longevity" },
];

const GOAL_SUB_CATEGORIES: Record<string, { id: string; label: string }[]> = {
  fat_loss: [
    { id: "cut", label: "Cut (lose fat, preserve muscle)" },
    { id: "recomp", label: "Recomp (lose fat, gain muscle)" },
  ],
  muscle: [
    { id: "hypertrophy", label: "Hypertrophy (maximize size)" },
    { id: "strength", label: "Strength (maximize force)" },
    { id: "powerbuilding", label: "Powerbuilding (size + strength)" },
  ],
  performance: [
    { id: "power", label: "Explosive Power" },
    { id: "endurance", label: "Muscular Endurance" },
    { id: "sport", label: "Sport Performance" },
  ],
  wellness: [
    { id: "longevity", label: "Longevity & Health" },
    { id: "rehab", label: "Rehab & Recovery" },
  ],
};

const BODY_FAT_RANGES = [
  { id: "<10%", label: "<10%", desc: "Very lean" },
  { id: "10-15%", label: "10-15%", desc: "Lean / athletic" },
  { id: "15-20%", label: "15-20%", desc: "Average fitness" },
  { id: "20-25%", label: "20-25%", desc: "Above average" },
  { id: "25%+", label: "25%+", desc: "Higher body fat" },
];

const TRAINING_RECENCY_OPTIONS = [
  { id: "current", label: "Currently training" },
  { id: "1_month", label: "Within last month" },
  { id: "3_months", label: "1-3 months ago" },
  { id: "6_months", label: "3-6 months ago" },
  { id: "1_year", label: "6-12 months ago" },
  { id: "2_years_plus", label: "Over a year ago" },
];

const WEEKDAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

const EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbells", label: "Dumbbells" },
  { id: "kettlebells", label: "Kettlebells" },
  { id: "pull_up_bar", label: "Pull-up Bar" },
  { id: "cables", label: "Cables" },
  { id: "machines", label: "Machines" },
  { id: "bands", label: "Resistance Bands" },
  { id: "squat_rack", label: "Squat Rack" },
  { id: "bench", label: "Adjustable Bench" },
  { id: "bodyweight_only", label: "Bodyweight Only" },
];

const EXERCISE_BLACKLIST_OPTIONS = [
  "Barbell Back Squat", "Conventional Deadlift", "Barbell Bench Press",
  "Overhead Press", "Barbell Row", "Pull-ups", "Lunges",
  "Leg Press", "Romanian Deadlift", "Dips",
  "Front Squat", "Hip Thrust",
];

const OCCUPATIONAL_DEMAND_OPTIONS = [
  { id: "sedentary", label: "Sedentary", desc: "Desk job" },
  { id: "light", label: "Light", desc: "On feet, light tasks" },
  { id: "moderate", label: "Moderate", desc: "Regular physical work" },
  { id: "heavy_labor", label: "Heavy Labor", desc: "Construction, moving" },
];

const PROTEIN_OPTIONS = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
  { id: "unsure", label: "Not sure" },
];

const DURATION_OPTIONS = [30, 45, 60, 75, 90];

const DIET_OPTIONS: { id: string; label: string }[] = [
  { id: "omnivore", label: "Omnivore" },
  { id: "vegetarian", label: "Vegetarian" },
  { id: "vegan", label: "Vegan" },
  { id: "keto", label: "Keto" },
  { id: "halal", label: "Halal" },
  { id: "other", label: "Other" },
];

const SPORT_OPTIONS = [
  { id: "swimming", label: "Swimming" },
  { id: "running", label: "Running / Track" },
  { id: "powerlifting", label: "Powerlifting" },
  { id: "crossfit", label: "CrossFit" },
  { id: "basketball", label: "Basketball" },
  { id: "soccer", label: "Soccer" },
  { id: "tennis", label: "Tennis" },
  { id: "mma", label: "MMA" },
  { id: "cycling", label: "Cycling" },
];

const SPORT_PHASE_OPTIONS = [
  { id: "off_season", label: "Off-Season", desc: "Full development" },
  { id: "pre_season", label: "Pre-Season", desc: "Building toward competition" },
  { id: "in_season", label: "In-Season", desc: "Competing now" },
];

const GREETINGS = [
  "Let\u2019s define your destination",
  "Tell us about your body and experience",
  "Let\u2019s keep you training safely",
  "Where and when do you train?",
  "Recovery and lifestyle",
  "Final touch \u2014 your preferences",
  "What sport do you train for?",
  "Let\u2019s align with your sport schedule",
];

const STORAGE_KEY = "fitai_onboarding_v2";

// --- Helpers ---

function CardButton({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-all ${
        selected
          ? "border-blue-500 bg-zinc-800"
          : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
      } ${className}`}
    >
      {children}
    </button>
  );
}

function PillButton({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
        selected
          ? "bg-blue-600 text-white"
          : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:border-zinc-500"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// --- Component ---

export default function OnboardingChat({ tier }: { tier: Tier }) {
  const router = useRouter();
  const totalSteps = tier === "elite" ? 8 : 6;

  const [step, setStep] = useState(() => {
    if (typeof window === "undefined") return 1;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved).step ?? 1;
    } catch { /* ignore */ }
    return 1;
  });

  const defaultAnswers: Partial<ProfileCreate> = {
    equipment: [],
    exercise_blacklist: [],
    training_days_specific: [],
    current_pain_level: 0,
    chair_stand_proxy: null,
    overhead_reach_proxy: null,
    current_max_bench: null,
    current_max_squat: null,
    current_max_deadlift: null,
  };

  const [answers, setAnswers] = useState<Partial<ProfileCreate>>(() => {
    if (typeof window === "undefined") return defaultAnswers;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) return { ...defaultAnswers, ...JSON.parse(saved).answers };
    } catch { /* ignore */ }
    return defaultAnswers;
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showOtherSport, setShowOtherSport] = useState(false);
  const [otherSportText, setOtherSportText] = useState("");
  const [showBenchmarks, setShowBenchmarks] = useState(false);

  // Persist progress
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
      case 1:
        return !!answers.goal && !!answers.goal_sub_category && !!answers.body_fat_est;
      case 2:
        return (
          !!answers.age &&
          !!answers.weight_kg &&
          !!answers.height_cm &&
          !!answers.sex &&
          answers.training_age_years !== undefined &&
          !!answers.training_recency
        );
      case 3:
        return answers.current_pain_level !== undefined;
      case 4:
        return (
          (answers.training_days_specific?.length ?? 0) > 0 &&
          !!answers.session_minutes &&
          (answers.equipment?.length ?? 0) > 0
        );
      case 5:
        return (
          !!answers.sleep_hours &&
          !!answers.stress_level &&
          !!answers.job_activity &&
          !!answers.diet_style
        );
      case 6:
        return true; // exercise_blacklist is optional
      case 7:
        return !!answers.sport;
      case 8:
        return !!answers.sport_phase;
      default:
        return false;
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

  function toggleDay(id: string) {
    const current = answers.training_days_specific ?? [];
    if (current.includes(id)) {
      update("training_days_specific", current.filter((d) => d !== id));
    } else {
      update("training_days_specific", [...current, id]);
    }
  }

  function toggleBlacklist(exercise: string) {
    const current = answers.exercise_blacklist ?? [];
    if (current.includes(exercise)) {
      update("exercise_blacklist", current.filter((e) => e !== exercise));
    } else {
      update("exercise_blacklist", [...current, exercise]);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      // Derive days_per_week from training_days_specific
      const payload = {
        ...answers,
        days_per_week: answers.training_days_specific?.length ?? answers.days_per_week ?? 3,
        injuries: answers.injury_ortho_history || answers.injuries || null,
        current_max_bench: answers.current_max_bench?.weight ? answers.current_max_bench : null,
        current_max_squat: answers.current_max_squat?.weight ? answers.current_max_squat : null,
        current_max_deadlift: answers.current_max_deadlift?.weight ? answers.current_max_deadlift : null,
      };
      await api("/profile", {
        method: "POST",
        body: JSON.stringify(payload),
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

  const showStrengthBenchmarks =
    canUse(tier, "web_search") && answers.experience !== "beginner";

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
          {/* ===== STEP 1: YOUR DESTINATION ===== */}
          {step === 1 && (
            <>
              {/* Goal selection */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">What is your primary goal?</label>
                <div className="grid grid-cols-2 gap-3">
                  {GOALS.map((g) => (
                    <CardButton
                      key={g.id}
                      selected={answers.goal === g.id}
                      onClick={() => {
                        update("goal", g.id);
                        // Reset sub-category when goal changes
                        if (answers.goal !== g.id) update("goal_sub_category", undefined as unknown as string);
                      }}
                    >
                      <div className="font-semibold mb-1">{g.label}</div>
                      <div className="text-sm text-zinc-400">{g.sub}</div>
                    </CardButton>
                  ))}
                </div>
              </div>

              {/* Sub-category (conditional on goal) */}
              {answers.goal && GOAL_SUB_CATEGORIES[answers.goal] && (
                <div>
                  <label className="block text-sm text-zinc-400 mb-2">What is your focus?</label>
                  <div className="space-y-2">
                    {GOAL_SUB_CATEGORIES[answers.goal].map((sub) => (
                      <CardButton
                        key={sub.id}
                        selected={answers.goal_sub_category === sub.id}
                        onClick={() => update("goal_sub_category", sub.id)}
                        className="w-full"
                      >
                        <div className="font-semibold text-sm">{sub.label}</div>
                      </CardButton>
                    ))}
                  </div>
                </div>
              )}

              {/* Body fat estimate */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Estimated body fat</label>
                <div className="flex gap-2 flex-wrap">
                  {BODY_FAT_RANGES.map((bf) => (
                    <PillButton
                      key={bf.id}
                      selected={answers.body_fat_est === bf.id}
                      onClick={() => update("body_fat_est", bf.id)}
                    >
                      <div>{bf.label}</div>
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Goal deadline (optional) */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Target date <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="date"
                  value={answers.goal_deadline ?? ""}
                  onChange={(e) => update("goal_deadline", e.target.value || null)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          {/* ===== STEP 2: BODY & EXPERIENCE ===== */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Sex</label>
                  <div className="flex gap-2">
                    {(["male", "female"] as const).map((s) => (
                      <PillButton
                        key={s}
                        selected={answers.sex === s}
                        onClick={() => update("sex", s)}
                        className="flex-1"
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </PillButton>
                    ))}
                  </div>
                </div>
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

              {/* Experience level */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Experience level</label>
                <div className="space-y-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                    <CardButton
                      key={level}
                      selected={answers.experience === level}
                      onClick={() => update("experience", level)}
                      className="w-full"
                    >
                      <div className="font-semibold">{level.charAt(0).toUpperCase() + level.slice(1)}</div>
                      <div className="text-sm text-zinc-400">
                        {level === "beginner" && "Less than 1 year consistent"}
                        {level === "intermediate" && "1\u20133 years consistent"}
                        {level === "advanced" && "3+ years structured training"}
                      </div>
                    </CardButton>
                  ))}
                </div>
              </div>

              {/* Training age */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Years of structured training</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={answers.training_age_years ?? ""}
                  onChange={(e) => update("training_age_years", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                />
              </div>

              {/* Training recency */}
              <div>
                <label className="block text-sm text-zinc-400 mb-2">When did you last train regularly?</label>
                <div className="grid grid-cols-2 gap-2">
                  {TRAINING_RECENCY_OPTIONS.map((opt) => (
                    <PillButton
                      key={opt.id}
                      selected={answers.training_recency === opt.id}
                      onClick={() => update("training_recency", opt.id)}
                    >
                      {opt.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              {/* Strength benchmarks (Pro+ only, non-beginner) */}
              {showStrengthBenchmarks && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowBenchmarks(!showBenchmarks)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {showBenchmarks ? "Hide" : "Add"} strength benchmarks (optional)
                  </button>
                  {showBenchmarks && (
                    <div className="mt-3 space-y-3">
                      {(["bench", "squat", "deadlift"] as const).map((lift) => {
                        const key = `current_max_${lift}` as keyof ProfileCreate;
                        const val = answers[key] as StrengthBenchmark | null | undefined;
                        return (
                          <div key={lift} className="flex items-center gap-2">
                            <span className="text-sm text-zinc-400 w-16 capitalize">{lift}</span>
                            <input
                              type="number"
                              min={0}
                              max={500}
                              placeholder="kg"
                              value={val?.weight ?? ""}
                              onChange={(e) =>
                                update(key as keyof ProfileCreate, {
                                  weight: parseFloat(e.target.value) || 0,
                                  reps: val?.reps ?? 1,
                                } as never)
                              }
                              className="w-20 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-zinc-500 text-xs">x</span>
                            <input
                              type="number"
                              min={1}
                              max={50}
                              placeholder="reps"
                              value={val?.reps ?? ""}
                              onChange={(e) =>
                                update(key as keyof ProfileCreate, {
                                  weight: val?.weight ?? 0,
                                  reps: parseInt(e.target.value) || 1,
                                } as never)
                              }
                              className="w-16 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-zinc-500 text-xs">reps</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ===== STEP 3: SAFETY SCREEN ===== */}
          {step === 3 && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Past surgeries or major joint injuries
                </label>
                <textarea
                  value={answers.injury_ortho_history ?? ""}
                  onChange={(e) => update("injury_ortho_history", e.target.value || null)}
                  rows={3}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="e.g. ACL repair 2022, chronic shoulder impingement... or 'none'"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Current daily pain level in any joint
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={answers.current_pain_level ?? 0}
                  onChange={(e) => update("current_pain_level", parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
                  <span>0 - None</span>
                  <span className="font-medium text-white">{answers.current_pain_level ?? 0}</span>
                  <span>10 - Severe</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Can you rise from a chair without using your hands?
                </label>
                <p className="text-xs text-zinc-500 mb-2">Tests knee/hip stability for squat readiness</p>
                <div className="flex gap-2">
                  {[true, false].map((val) => (
                    <PillButton
                      key={String(val)}
                      selected={answers.chair_stand_proxy === val}
                      onClick={() => update("chair_stand_proxy", val)}
                      className="flex-1"
                    >
                      {val ? "Yes" : "No"}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Can you touch a wall with your thumbs while your back is flat against it?
                </label>
                <p className="text-xs text-zinc-500 mb-2">Tests shoulder mobility for overhead pressing</p>
                <div className="flex gap-2">
                  {[true, false].map((val) => (
                    <PillButton
                      key={String(val)}
                      selected={answers.overhead_reach_proxy === val}
                      onClick={() => update("overhead_reach_proxy", val)}
                      className="flex-1"
                    >
                      {val ? "Yes" : "No"}
                    </PillButton>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===== STEP 4: TRAINING SETUP ===== */}
          {step === 4 && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Which days can you train?</label>
                <div className="flex gap-2">
                  {WEEKDAYS.map((d) => (
                    <PillButton
                      key={d.id}
                      selected={answers.training_days_specific?.includes(d.id) ?? false}
                      onClick={() => toggleDay(d.id)}
                      className="flex-1 text-center"
                    >
                      {d.label}
                    </PillButton>
                  ))}
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  {answers.training_days_specific?.length ?? 0} days selected
                </p>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Session length (min)</label>
                <div className="flex gap-2">
                  {DURATION_OPTIONS.map((m) => (
                    <PillButton
                      key={m}
                      selected={answers.session_minutes === m}
                      onClick={() => update("session_minutes", m)}
                      className="flex-1"
                    >
                      {m}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Equipment available</label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((eq) => {
                    const isSelected = answers.equipment?.includes(eq.id) ?? false;
                    return (
                      <PillButton
                        key={eq.id}
                        selected={isSelected}
                        onClick={() => toggleEquipment(eq.id)}
                      >
                        {isSelected && <span className="mr-1">{"\u2713"}</span>}
                        {eq.label}
                      </PillButton>
                    );
                  })}
                </div>
                <p className="text-zinc-500 text-xs mt-1">
                  {answers.equipment?.length ?? 0} selected
                </p>
              </div>
            </>
          )}

          {/* ===== STEP 5: RECOVERY & LIFESTYLE ===== */}
          {step === 5 && (
            <>
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
                <label className="block text-sm text-zinc-400 mb-2">Daily stress level</label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={answers.stress_level ?? 5}
                  onChange={(e) => update("stress_level", parseInt(e.target.value))}
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-zinc-500 mt-1 px-1">
                  <span>1 - Low</span>
                  <span className="font-medium text-white">{answers.stress_level ?? 5}</span>
                  <span>10 - High</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Occupational demand</label>
                <div className="grid grid-cols-2 gap-2">
                  {OCCUPATIONAL_DEMAND_OPTIONS.map((o) => (
                    <CardButton
                      key={o.id}
                      selected={answers.job_activity === o.id}
                      onClick={() => update("job_activity", o.id)}
                    >
                      <div className="font-semibold text-sm">{o.label}</div>
                      <div className="text-xs text-zinc-400">{o.desc}</div>
                    </CardButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Do you eat at least 1.6g protein per kg bodyweight daily?
                </label>
                <div className="flex gap-2">
                  {PROTEIN_OPTIONS.map((p) => (
                    <PillButton
                      key={p.id}
                      selected={answers.protein_intake_check === p.id}
                      onClick={() => update("protein_intake_check", p.id)}
                      className="flex-1"
                    >
                      {p.label}
                    </PillButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">Diet style</label>
                <div className="grid grid-cols-3 gap-2">
                  {DIET_OPTIONS.map((d) => (
                    <PillButton
                      key={d.id}
                      selected={answers.diet_style === d.id}
                      onClick={() => update("diet_style", d.id)}
                    >
                      {d.label}
                    </PillButton>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===== STEP 6: PREFERENCES ===== */}
          {step === 6 && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Exercises you want to avoid <span className="text-zinc-600">(optional)</span>
                </label>
                <p className="text-xs text-zinc-500 mb-3">
                  We&apos;ll swap these for equivalent alternatives
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {EXERCISE_BLACKLIST_OPTIONS.map((ex) => {
                    const isSelected = answers.exercise_blacklist?.includes(ex) ?? false;
                    return (
                      <PillButton
                        key={ex}
                        selected={isSelected}
                        onClick={() => toggleBlacklist(ex)}
                      >
                        {isSelected && <span className="mr-1">{"\u2713"}</span>}
                        {ex}
                      </PillButton>
                    );
                  })}
                </div>
                {(answers.exercise_blacklist?.length ?? 0) > 0 && (
                  <p className="text-zinc-500 text-xs mt-2">
                    {answers.exercise_blacklist?.length} exercises blacklisted
                  </p>
                )}
              </div>
            </>
          )}

          {/* ===== STEP 7: SPORT SELECTION (Elite only) ===== */}
          {step === 7 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {SPORT_OPTIONS.map((s) => (
                  <CardButton
                    key={s.id}
                    selected={answers.sport === s.id}
                    onClick={() => {
                      update("sport", s.id);
                      setShowOtherSport(false);
                      setError("");
                      setStep(8);
                    }}
                  >
                    <div className="font-semibold text-sm">{s.label}</div>
                  </CardButton>
                ))}
                <CardButton
                  selected={showOtherSport}
                  onClick={() => {
                    setShowOtherSport(true);
                    update("sport", otherSportText || undefined);
                  }}
                >
                  <div className="font-semibold text-sm">Other</div>
                </CardButton>
              </div>
              {showOtherSport && (
                <div className="space-y-2">
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
                  {otherSportText.trim() && (
                    <button
                      onClick={() => {
                        update("sport", otherSportText.trim());
                        setError("");
                        setStep(8);
                      }}
                      className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
                    >
                      Continue
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== STEP 8: ATHLETE SYNC (Elite only) ===== */}
          {step === 8 && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Current season phase</label>
                <div className="space-y-2">
                  {SPORT_PHASE_OPTIONS.map((sp) => (
                    <CardButton
                      key={sp.id}
                      selected={answers.sport_phase === sp.id}
                      onClick={() => update("sport_phase", sp.id)}
                      className="w-full"
                    >
                      <div className="font-semibold text-sm">{sp.label}</div>
                      <div className="text-xs text-zinc-400">{sp.desc}</div>
                    </CardButton>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Hours of sport practice per week
                </label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={answers.sport_weekly_hours ?? ""}
                  onChange={(e) => update("sport_weekly_hours", parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="10"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Preparing for a competition? <span className="text-zinc-600">(optional)</span>
                </label>
                <input
                  type="date"
                  min={minCompDate}
                  value={answers.competition_date ?? ""}
                  onChange={(e) => update("competition_date", e.target.value || null)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {answers.competition_date && (
                  <p className="text-xs text-zinc-500 mt-1">
                    Your plan will be periodized to peak on this date
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Error */}
        {error && <p className="text-red-400 text-sm mt-4">{error}</p>}

        {/* CTA button (not shown on step 7 for non-other sports since they auto-advance) */}
        {!(step === 7 && !showOtherSport) && (
          <button
            onClick={next}
            disabled={submitting}
            className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
