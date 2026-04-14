"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Tier } from "@/lib/tiers";
import { classifyGoal } from "@/lib/classifyGoal";

// --- Types ---

interface FieldOption {
  value: string;
  label: string;
  description?: string;
}

interface OnboardingField {
  field_name: string;
  label: string;
  type:
    | "single_select"
    | "multi_select"
    | "number"
    | "text"
    | "textarea"
    | "slider"
    | "date"
    | "day_picker"
    | "yes_no"
    | "strength_benchmarks";
  required: boolean;
  options?: FieldOption[];
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  placeholder?: string;
  max_length?: number;
  min_label?: string;
  max_label?: string;
  min_date?: string;
  max_date?: string;
}

interface ConversationEntry {
  message: string;
  fields: OnboardingField[];
  answers: Record<string, unknown>;
}

interface NextQuestionResponse {
  done: boolean;
  message: string;
  fields: OnboardingField[];
  profile_data?: Record<string, unknown>;
}

interface StrengthBenchmark {
  weight: number;
  reps: number;
}

// --- Constants ---

const STORAGE_KEY = "fitai_onboarding_v4";

const WEEKDAYS = [
  { id: "mon", label: "M" },
  { id: "tue", label: "T" },
  { id: "wed", label: "W" },
  { id: "thu", label: "T" },
  { id: "fri", label: "F" },
  { id: "sat", label: "S" },
  { id: "sun", label: "S" },
];

const GOAL_PLACEHOLDERS = [
  "Get stronger for swimming...",
  "Lose 10kg before summer...",
  "Build muscle and look great...",
  "Train for a marathon in October...",
  "Get back in shape after injury...",
];

const SUGGESTION_CHIPS = [
  { label: "Lose fat", text: "I want to lose fat and get lean" },
  { label: "Build muscle", text: "I want to build muscle and get stronger" },
  { label: "Sport performance", text: "I want to improve my performance in my sport" },
  { label: "Feel healthier", text: "I want to feel healthier and more energetic" },
];

const LOADING_MESSAGES = [
  "Tailoring your next question...",
  "Considering your profile...",
  "Thinking about what matters most...",
  "Building your coaching plan...",
];

// Tier-based estimated question counts for progress bar
const TIER_ESTIMATES: Record<string, number> = {
  free: 6,
  pro: 9,
  elite: 11,
};

// --- Component ---

export default function OnboardingChat({ tier }: { tier: Tier }) {
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Phase: welcome screen vs AI questions
  const [phase, setPhase] = useState<"welcome" | "questions">("welcome");
  const [goalText, setGoalText] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Question flow state
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [currentStep, setCurrentStep] = useState<{ message: string; fields: OnboardingField[] } | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, unknown>>({});
  const [allAnswers, setAllAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animationKey, setAnimationKey] = useState(0);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);

  // Auto-advance ref to prevent double-fire
  const autoAdvanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Rotating placeholder ---
  useEffect(() => {
    if (phase !== "welcome") return;
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % GOAL_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phase]);

  // --- Loading message rotation ---
  useEffect(() => {
    if (!loading) return;
    setLoadingMsgIndex(0);
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [loading]);

  // --- Restore from sessionStorage ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.timestamp && Date.now() - parsed.timestamp > 24 * 60 * 60 * 1000) {
          sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
        if (parsed.phase) setPhase(parsed.phase);
        if (parsed.goalText) setGoalText(parsed.goalText);
        if (parsed.conversationHistory) setConversationHistory(parsed.conversationHistory);
        if (parsed.currentStep) setCurrentStep(parsed.currentStep);
        if (parsed.allAnswers) setAllAnswers(parsed.allAnswers);
        if (parsed.currentAnswers) setCurrentAnswers(parsed.currentAnswers);
        return;
      }
    } catch { /* ignore */ }
  }, []);

  // --- Persist to sessionStorage ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (phase === "welcome" && !goalText && conversationHistory.length === 0) return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          phase,
          goalText,
          conversationHistory,
          currentStep,
          currentAnswers,
          allAnswers,
          timestamp: Date.now(),
        })
      );
    } catch { /* ignore */ }
  }, [phase, goalText, conversationHistory, currentStep, currentAnswers, allAnswers]);

  // --- Cleanup auto-advance on unmount ---
  useEffect(() => {
    return () => {
      if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    };
  }, []);

  // --- Can continue? ---
  const canContinue = useCallback((): boolean => {
    if (!currentStep) return false;
    for (const field of currentStep.fields) {
      if (!field.required) continue;
      const val = currentAnswers[field.field_name];
      if (val === undefined || val === null || val === "") return false;
      if (Array.isArray(val) && val.length === 0) return false;
    }
    return true;
  }, [currentStep, currentAnswers]);

  // --- Fetch next question ---
  async function fetchNextQuestion(answers: Record<string, unknown>) {
    setLoading(true);
    setError(null);
    try {
      const result = await api<NextQuestionResponse>("/onboarding/next-question", {
        method: "POST",
        body: JSON.stringify({
          answers_so_far: answers,
          tier,
        }),
      });

      if (result.done) {
        await submitProfile(result.profile_data || answers);
      } else {
        setCurrentStep({ message: result.message, fields: result.fields });
        setCurrentAnswers({});
        setAnimationKey((k) => k + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // --- Submit profile ---
  async function submitProfile(profileData: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const payload = { ...profileData };

      if (Array.isArray(payload.training_days_specific) && (payload.training_days_specific as string[]).length > 0) {
        payload.days_per_week = (payload.training_days_specific as string[]).length;
      }
      if (payload.session_minutes) {
        payload.session_minutes = Number(payload.session_minutes);
      }
      if (payload.injury_ortho_history && !payload.injuries) {
        payload.injuries = payload.injury_ortho_history;
      }
      for (const key of ["current_max_bench", "current_max_squat", "current_max_deadlift"] as const) {
        const bm = payload[key] as StrengthBenchmark | null | undefined;
        if (bm && !bm.weight) {
          payload[key] = null;
        }
      }

      await api("/profile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      sessionStorage.removeItem(STORAGE_KEY);
      router.push("/plan/loading");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
      setSubmitting(false);
    }
  }

  // --- Handle "Let's go" from welcome screen ---
  function handleGoalSubmit() {
    if (!goalText.trim()) return;
    const goalEnum = classifyGoal(goalText);
    const initial = { goal: goalEnum, goal_description: goalText.trim() };
    setAllAnswers(initial);
    setPhase("questions");
    fetchNextQuestion(initial);
  }

  // --- Handle continue ---
  function handleContinue() {
    if (!canContinue() || !currentStep) return;
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }
    setError(null);

    const merged = { ...allAnswers, ...currentAnswers };
    setAllAnswers(merged);

    setConversationHistory((prev) => [
      ...prev,
      {
        message: currentStep.message,
        fields: currentStep.fields,
        answers: { ...currentAnswers },
      },
    ]);

    setCurrentStep(null);
    fetchNextQuestion(merged);
  }

  // --- Handle back ---
  function handleBack() {
    if (autoAdvanceTimer.current) {
      clearTimeout(autoAdvanceTimer.current);
      autoAdvanceTimer.current = null;
    }

    if (conversationHistory.length === 0) {
      // Go back to welcome screen
      setPhase("welcome");
      setCurrentStep(null);
      setLoading(false);
      return;
    }

    setError(null);
    const prev = [...conversationHistory];
    const lastEntry = prev.pop()!;

    const rolledBack = { ...allAnswers };
    for (const field of lastEntry.fields) {
      delete rolledBack[field.field_name];
    }

    setConversationHistory(prev);
    setAllAnswers(rolledBack);
    setCurrentStep({ message: lastEntry.message, fields: lastEntry.fields });
    setCurrentAnswers(lastEntry.answers);
    setAnimationKey((k) => k + 1);
  }

  // --- Update answer ---
  function updateAnswer(fieldName: string, value: unknown) {
    setCurrentAnswers((prev) => ({ ...prev, [fieldName]: value }));
  }

  // --- Auto-advance for single-field single_select / yes_no ---
  function maybeAutoAdvance(fieldName: string, value: unknown) {
    if (!currentStep) return;
    if (currentStep.fields.length !== 1) return;
    const field = currentStep.fields[0];
    if (field.field_name !== fieldName) return;
    if (field.type !== "single_select" && field.type !== "yes_no") return;

    // Set the answer and schedule auto-advance
    const newAnswers = { ...currentAnswers, [fieldName]: value };
    setCurrentAnswers(newAnswers);

    if (autoAdvanceTimer.current) clearTimeout(autoAdvanceTimer.current);
    autoAdvanceTimer.current = setTimeout(() => {
      const merged = { ...allAnswers, ...newAnswers };
      setAllAnswers(merged);
      setConversationHistory((prev) => [
        ...prev,
        {
          message: currentStep!.message,
          fields: currentStep!.fields,
          answers: { ...newAnswers },
        },
      ]);
      setCurrentStep(null);
      fetchNextQuestion(merged);
    }, 350);
  }

  // --- Toggle multi-select ---
  function toggleMultiSelect(fieldName: string, value: string) {
    const current = (currentAnswers[fieldName] as string[]) || [];
    if (fieldName === "equipment") {
      if (value === "bodyweight_only") {
        updateAnswer(fieldName, current.includes("bodyweight_only") ? [] : ["bodyweight_only"]);
        return;
      }
      const without = current.filter((v) => v !== "bodyweight_only" && v !== value);
      if (current.includes(value)) {
        updateAnswer(fieldName, without);
      } else {
        updateAnswer(fieldName, [...without, value]);
      }
      return;
    }
    if (current.includes(value)) {
      updateAnswer(fieldName, current.filter((v) => v !== value));
    } else {
      updateAnswer(fieldName, [...current, value]);
    }
  }

  // --- Toggle day ---
  function toggleDay(fieldName: string, day: string) {
    const current = (currentAnswers[fieldName] as string[]) || [];
    if (current.includes(day)) {
      updateAnswer(fieldName, current.filter((d) => d !== day));
    } else {
      updateAnswer(fieldName, [...current, day]);
    }
  }

  // ============================================================
  // FIELD RENDERERS
  // ============================================================

  const showLabels = currentStep ? currentStep.fields.length > 1 : false;

  function renderField(field: OnboardingField) {
    switch (field.type) {
      case "single_select":
        return renderSingleSelect(field);
      case "multi_select":
        return renderMultiSelect(field);
      case "number":
        return renderNumber(field);
      case "text":
        return renderText(field);
      case "textarea":
        return renderTextarea(field);
      case "slider":
        return renderSlider(field);
      case "date":
        return renderDate(field);
      case "day_picker":
        return renderDayPicker(field);
      case "yes_no":
        return renderYesNo(field);
      case "strength_benchmarks":
        return renderStrengthBenchmarks(field);
      default:
        return renderText(field);
    }
  }

  // --- single_select ---
  function renderSingleSelect(field: OnboardingField) {
    const selected = currentAnswers[field.field_name] as string | undefined;
    const options = field.options || [];
    const hasDescriptions = options.some((o) => o.description);

    if (hasDescriptions) {
      return (
        <div>
          {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
          <div className="grid grid-cols-1 gap-3">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  updateAnswer(field.field_name, opt.value);
                  maybeAutoAdvance(field.field_name, opt.value);
                }}
                className={`text-left p-4 rounded-2xl border-2 transition-all duration-200 flex items-start gap-3 active:scale-[0.98] ${
                  selected === opt.value
                    ? "border-blue-500/60 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]"
                    : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-600"
                }`}
              >
                <div
                  className={`w-1 self-stretch rounded-full shrink-0 transition-colors ${
                    selected === opt.value ? "bg-blue-500" : "bg-zinc-700"
                  }`}
                />
                <div>
                  <p className={`font-semibold transition-colors ${selected === opt.value ? "text-white" : "text-zinc-200"}`}>
                    {opt.label}
                  </p>
                  {opt.description && (
                    <p className="text-sm text-zinc-500 mt-0.5">{opt.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="flex flex-wrap gap-2">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                updateAnswer(field.field_name, opt.value);
                maybeAutoAdvance(field.field_name, opt.value);
              }}
              className={`py-3 px-5 rounded-xl text-base font-medium transition-all duration-200 active:scale-95 ${
                selected === opt.value
                  ? "bg-blue-500/20 border border-blue-500/60 text-blue-300"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // --- multi_select ---
  function renderMultiSelect(field: OnboardingField) {
    const selected = (currentAnswers[field.field_name] as string[]) || [];
    const options = field.options || [];

    // Separate bodyweight_only if this is equipment
    const isEquipment = field.field_name === "equipment";
    const mainOptions = isEquipment ? options.filter((o) => o.value !== "bodyweight_only") : options;
    const bwOption = isEquipment ? options.find((o) => o.value === "bodyweight_only") : null;

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-2">{field.label}</p>}
        {selected.length > 0 && (
          <p className="text-sm text-blue-400 font-medium mb-3">{selected.length} selected</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {mainOptions.map((opt) => {
            const isSelected = selected.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => toggleMultiSelect(field.field_name, opt.value)}
                className={`relative p-3 rounded-xl border transition-all duration-200 text-left active:scale-[0.97] ${
                  isSelected
                    ? "border-blue-500/60 bg-blue-500/10"
                    : "border-zinc-800 bg-zinc-900/80 hover:border-zinc-600"
                }`}
              >
                <span className={`text-sm font-medium ${isSelected ? "text-white" : "text-zinc-300"}`}>
                  {opt.label}
                </span>
                {isSelected && (
                  <span className="absolute top-2 right-2">
                    <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {bwOption && (
          <button
            type="button"
            onClick={() => toggleMultiSelect(field.field_name, "bodyweight_only")}
            className={`w-full mt-3 p-3 rounded-xl border transition-all duration-200 text-center active:scale-[0.98] ${
              selected.includes("bodyweight_only")
                ? "border-blue-500/60 bg-blue-500/10 text-blue-300"
                : "border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-600"
            }`}
          >
            <span className="text-sm font-medium">Bodyweight only — no equipment</span>
          </button>
        )}
      </div>
    );
  }

  // --- number (stepper) ---
  function renderNumber(field: OnboardingField) {
    const value = currentAnswers[field.field_name] as number | undefined;
    const step = field.step || 1;
    const min = field.min ?? 0;
    const max = field.max ?? 999;

    const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

    function startHold(direction: 1 | -1) {
      const tick = () => {
        setCurrentAnswers((prev) => {
          const cur = (prev[field.field_name] as number) ?? min;
          const next = Math.min(max, Math.max(min, cur + step * direction));
          return { ...prev, [field.field_name]: next };
        });
      };
      tick();
      holdInterval.current = setInterval(tick, 150);
    }

    function stopHold() {
      if (holdInterval.current) {
        clearInterval(holdInterval.current);
        holdInterval.current = null;
      }
    }

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-6">
            <button
              type="button"
              onPointerDown={() => startHold(-1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 text-xl text-zinc-300 hover:bg-zinc-700 active:scale-90 transition-all flex items-center justify-center select-none"
            >
              −
            </button>
            <input
              type="number"
              value={value ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                updateAnswer(field.field_name, v === "" ? undefined : Number(v));
              }}
              min={min}
              max={max}
              step={step}
              placeholder="—"
              className="w-24 text-4xl font-bold text-white text-center bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              type="button"
              onPointerDown={() => startHold(1)}
              onPointerUp={stopHold}
              onPointerLeave={stopHold}
              className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 text-xl text-zinc-300 hover:bg-zinc-700 active:scale-90 transition-all flex items-center justify-center select-none"
            >
              +
            </button>
          </div>
          {field.unit && <span className="text-sm text-zinc-500">{field.unit}</span>}
        </div>
      </div>
    );
  }

  // --- text ---
  function renderText(field: OnboardingField) {
    const value = (currentAnswers[field.field_name] as string) || "";

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <input
          type="text"
          value={value}
          onChange={(e) => updateAnswer(field.field_name, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canContinue()) handleContinue();
          }}
          placeholder={field.placeholder}
          maxLength={field.max_length || 200}
          autoFocus
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-lg text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
        />
      </div>
    );
  }

  // --- textarea ---
  function renderTextarea(field: OnboardingField) {
    const value = (currentAnswers[field.field_name] as string) || "";
    const maxLen = field.max_length || 500;
    const pct = Math.min(100, (value.length / maxLen) * 100);

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <textarea
          value={value}
          onChange={(e) => updateAnswer(field.field_name, e.target.value)}
          placeholder={field.placeholder}
          maxLength={maxLen}
          rows={3}
          autoFocus
          className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-lg text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none"
        />
        <div className="mt-1.5 h-0.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              pct > 95 ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-blue-500/50"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    );
  }

  // --- slider ---
  function renderSlider(field: OnboardingField) {
    const min = field.min ?? 0;
    const max = field.max ?? 10;
    const value = (currentAnswers[field.field_name] as number) ?? min;
    const pct = ((value - min) / (max - min)) * 100;

    // Color-code for stress-type sliders
    const isStress = field.field_name === "stress_level" || field.field_name === "current_pain_level";
    let trackColor = "from-blue-500 to-cyan-400";
    if (isStress) {
      if (value <= 3) trackColor = "from-emerald-500 to-emerald-400";
      else if (value <= 6) trackColor = "from-amber-500 to-amber-400";
      else trackColor = "from-red-500 to-red-400";
    }

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="px-1">
          {/* Value bubble */}
          <div className="relative mb-4 h-10">
            <div
              className="absolute -translate-x-1/2 transition-all duration-150"
              style={{ left: `${pct}%` }}
            >
              <div className={`bg-gradient-to-r ${trackColor} text-white text-lg font-bold px-3 py-1 rounded-xl shadow-lg`}>
                {value}
              </div>
              <div
                className={`w-2 h-2 bg-gradient-to-r ${trackColor} rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1`}
              />
            </div>
          </div>

          {/* Track */}
          <div className="relative h-2 rounded-full bg-zinc-800">
            <div
              className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${trackColor} transition-all duration-150`}
              style={{ width: `${pct}%` }}
            />
            <input
              type="range"
              value={value}
              onChange={(e) => updateAnswer(field.field_name, Number(e.target.value))}
              min={min}
              max={max}
              step={field.step || 1}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
          </div>

          {/* Labels */}
          <div className="flex justify-between mt-2">
            <span className="text-xs text-zinc-500">{field.min_label || min}</span>
            <span className="text-xs text-zinc-500">{field.max_label || max}</span>
          </div>
        </div>
      </div>
    );
  }

  // --- date ---
  function renderDate(field: OnboardingField) {
    const value = (currentAnswers[field.field_name] as string) || "";

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="relative">
          <input
            type="date"
            value={value}
            onChange={(e) => updateAnswer(field.field_name, e.target.value)}
            min={field.min_date}
            max={field.max_date}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-lg text-white focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
          />
        </div>
      </div>
    );
  }

  // --- day_picker ---
  function renderDayPicker(field: OnboardingField) {
    const selected = (currentAnswers[field.field_name] as string[]) || [];

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="flex justify-between gap-1.5">
          {WEEKDAYS.map((day) => {
            const isSelected = selected.includes(day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleDay(field.field_name, day.id)}
                className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 active:scale-90 ${
                  isSelected
                    ? "bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.3)]"
                    : "bg-zinc-900 border border-zinc-800 text-zinc-500 hover:border-zinc-600"
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <p className="text-sm text-blue-400 text-center mt-3 font-medium">
            {selected.length} day{selected.length !== 1 ? "s" : ""} per week
          </p>
        )}
      </div>
    );
  }

  // --- yes_no ---
  function renderYesNo(field: OnboardingField) {
    const value = currentAnswers[field.field_name] as boolean | undefined;

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              updateAnswer(field.field_name, true);
              maybeAutoAdvance(field.field_name, true);
            }}
            className={`py-6 rounded-2xl text-center text-lg font-semibold transition-all duration-200 active:scale-[0.97] ${
              value === true
                ? "bg-emerald-500/15 border-2 border-emerald-500/50 text-emerald-400"
                : "bg-zinc-900 border-2 border-zinc-800 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => {
              updateAnswer(field.field_name, false);
              maybeAutoAdvance(field.field_name, false);
            }}
            className={`py-6 rounded-2xl text-center text-lg font-semibold transition-all duration-200 active:scale-[0.97] ${
              value === false
                ? "bg-zinc-800 border-2 border-zinc-600 text-zinc-300"
                : "bg-zinc-900 border-2 border-zinc-800 text-zinc-300 hover:border-zinc-600"
            }`}
          >
            No
          </button>
        </div>
      </div>
    );
  }

  // --- strength_benchmarks ---
  function renderStrengthBenchmarks(field: OnboardingField) {
    const value = (currentAnswers[field.field_name] as Record<string, StrengthBenchmark>) || {
      bench: { weight: 0, reps: 0 },
      squat: { weight: 0, reps: 0 },
      deadlift: { weight: 0, reps: 0 },
    };

    function updateLift(lift: string, prop: "weight" | "reps", v: number) {
      const updated = {
        ...value,
        [lift]: { ...value[lift], [prop]: v },
      };
      updateAnswer("current_max_bench", updated.bench);
      updateAnswer("current_max_squat", updated.squat);
      updateAnswer("current_max_deadlift", updated.deadlift);
    }

    const lifts = [
      { key: "bench", label: "Bench Press" },
      { key: "squat", label: "Squat" },
      { key: "deadlift", label: "Deadlift" },
    ];

    return (
      <div>
        {showLabels && <p className="text-sm font-medium text-zinc-400 mb-3">{field.label}</p>}
        <div className="space-y-3">
          {lifts.map(({ key, label }) => (
            <div key={key} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <p className="text-base font-semibold text-white mb-3">{label}</p>
              <div className="flex gap-3">
                <div className="flex-1">
                  <p className="text-xs text-zinc-500 mb-1">Weight (kg)</p>
                  <input
                    type="number"
                    value={value[key]?.weight || ""}
                    onChange={(e) => updateLift(key, "weight", Number(e.target.value))}
                    placeholder="—"
                    min={0}
                    max={1000}
                    className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-500 mb-1">Reps</p>
                  <input
                    type="number"
                    value={value[key]?.reps || ""}
                    onChange={(e) => updateLift(key, "reps", Number(e.target.value))}
                    placeholder="—"
                    min={1}
                    max={100}
                    className="w-full bg-zinc-800 rounded-xl px-4 py-3 text-center text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>
              <p className="text-xs text-zinc-600 mt-2">Skip if unsure</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER
  // ============================================================

  const stepNumber = conversationHistory.length + 1;
  const estimate = TIER_ESTIMATES[tier] || 8;
  const progressPct = Math.min(95, (conversationHistory.length / estimate) * 100);

  // --- Welcome screen ---
  if (phase === "welcome") {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-zinc-950 text-white relative overflow-hidden">
        {/* Subtle glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08),transparent_50%)] pointer-events-none" />

        <div className="flex-1 flex flex-col items-center justify-center px-4 relative z-10">
          <div className="w-full max-w-lg">
            {/* Brand */}
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2 text-center">
              FitAI
            </h1>
            <p className="text-zinc-500 text-sm text-center mb-10">Your AI-powered coach</p>

            {/* Main question */}
            <h2 className="text-2xl sm:text-3xl font-bold text-white text-center leading-snug mb-2">
              What are you training for?
            </h2>
            <p className="text-zinc-400 text-center mb-8">
              Describe your goal in your own words
            </p>

            {/* Goal textarea */}
            <textarea
              ref={textareaRef}
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && goalText.trim()) {
                  e.preventDefault();
                  handleGoalSubmit();
                }
              }}
              placeholder={GOAL_PLACEHOLDERS[placeholderIndex]}
              rows={2}
              maxLength={300}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-lg text-white placeholder:text-zinc-600 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all resize-none"
            />

            {/* Suggestion chips */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setGoalText(chip.text)}
                  className="text-sm px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors active:scale-95"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Submit button */}
            <button
              onClick={handleGoalSubmit}
              disabled={!goalText.trim()}
              className={`w-full mt-8 py-4 rounded-2xl font-semibold text-lg transition-all duration-300 ${
                goalText.trim()
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              Let&apos;s go
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Question flow ---
  return (
    <div className="min-h-[100dvh] flex flex-col bg-zinc-950 text-white relative overflow-hidden">
      {/* Subtle glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.06),transparent_50%)] pointer-events-none" />

      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {/* Back button */}
          <button
            onClick={handleBack}
            disabled={loading || submitting}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white disabled:opacity-30 shrink-0"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Progress bar */}
          <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* Step counter */}
          <span className="text-xs text-zinc-500 shrink-0 w-12 text-right">
            Step {stepNumber}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex flex-col px-4 relative z-10">
        <div className="max-w-lg mx-auto w-full flex-1 flex flex-col justify-center py-6">
          {loading ? (
            // Loading state
            <div className="flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
              <div className="w-14 h-14 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mb-6" />
              <p className="text-zinc-400 text-sm transition-opacity duration-300">
                {LOADING_MESSAGES[loadingMsgIndex]}
              </p>
            </div>
          ) : submitting ? (
            // Submitting state
            <div className="flex flex-col items-center justify-center animate-[fadeIn_0.3s_ease-out]">
              <div className="w-14 h-14 rounded-full border-2 border-blue-500/30 border-t-blue-500 animate-spin mb-6" />
              <p className="text-zinc-300 font-medium">Building your coaching profile...</p>
              <p className="text-zinc-500 text-sm mt-1">This takes just a moment</p>
            </div>
          ) : currentStep ? (
            // Current question
            <div key={animationKey} className="animate-[fadeSlideUp_0.4s_ease-out]" ref={contentRef}>
              {/* AI message */}
              <h2 className="text-2xl font-bold text-white leading-snug mb-8">
                {currentStep.message}
              </h2>

              {/* Fields */}
              <div className="space-y-6">
                {currentStep.fields.map((field, i) => (
                  <div
                    key={field.field_name}
                    style={{ animationDelay: `${i * 100}ms` }}
                    className="animate-[fadeSlideUp_0.4s_ease-out] [animation-fill-mode:both]"
                  >
                    {renderField(field)}
                  </div>
                ))}
              </div>

              {/* Error */}
              {error && (
                <p className="text-red-400 text-sm mt-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                  {error}
                </p>
              )}
            </div>
          ) : null}

          {/* Soft safety valve — escape hatch after 20 questions */}
          {conversationHistory.length >= 20 && !loading && !submitting && currentStep && (
            <button
              onClick={() => {
                const merged = { ...allAnswers, ...currentAnswers };
                submitProfile(merged);
              }}
              className="mt-6 text-sm text-zinc-500 hover:text-zinc-300 underline underline-offset-4 transition-colors text-center"
            >
              Finish setup with current answers
            </button>
          )}
        </div>
      </main>

      {/* Sticky footer */}
      {!loading && !submitting && currentStep && (
        <footer className="sticky bottom-0 z-10 bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-800/50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleContinue}
              disabled={!canContinue()}
              className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all duration-300 ${
                canContinue()
                  ? "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                  : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
              }`}
            >
              Continue
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
