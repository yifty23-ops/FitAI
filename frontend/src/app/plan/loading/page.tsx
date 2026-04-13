"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";
import { api, LONG_TIMEOUT_MS } from "@/lib/api";
import type { Tier } from "@/lib/tiers";

interface GenerateResponse {
  plan_id: string;
  plan: Record<string, unknown>;
  nutrition: Record<string, unknown>;
  persona_used: string;
  tier: string;
  mesocycle_weeks: number;
}

interface ProfileResponse {
  sport?: string;
  competition_date?: string;
}

const MESSAGES: Record<Tier, string[]> = {
  free: [
    "Analyzing your profile...",
    "Designing your program...",
    "Finalizing your plan...",
  ],
  pro: [
    "Researching evidence-based protocols...",
    "Analyzing latest sports science...",
    "Building your periodized program...",
    "Optimizing volume and intensity...",
  ],
  elite: [
    "Researching elite sport protocols...",
    "Analyzing Olympic-level programming...",
    "Designing competition peaking model...",
    "Calibrating sport-specific transfers...",
    "Finalizing your elite program...",
  ],
};

function buildEliteMessages(sport: string | undefined): string[] {
  const s = sport ?? "sport";
  return [
    `Researching elite ${s} protocols...`,
    "Analyzing Olympic-level programming...",
    `Designing ${s} competition peaking model...`,
    `Calibrating ${s}-specific transfers...`,
    "Finalizing your elite program...",
  ];
}

export default function PlanLoadingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"generating" | "error" | "success">(
    "generating"
  );
  const [error, setError] = useState("");
  const [messageIdx, setMessageIdx] = useState(0);
  const [messages, setMessages] = useState<string[]>(MESSAGES.free);
  const [tier, setTier] = useState<Tier>("free");
  const [attempt, setAttempt] = useState(0);
  const started = useRef(false);

  // Cycle through messages
  useEffect(() => {
    if (status !== "generating") return;
    const interval = setInterval(() => {
      setMessageIdx((prev) => (prev + 1) % messages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [status, messages.length]);

  // Auth gate + trigger generation
  useEffect(() => {
    if (attempt === 0 && started.current) return;
    started.current = true;

    const user = getUser();
    if (!user) {
      router.push("/");
      return;
    }

    const userTier = user.tier as Tier;
    setTier(userTier);

    if (userTier !== "elite") {
      setMessages(MESSAGES[userTier]);
    }

    async function generate() {
      // For elite: fetch profile to get sport name for messages
      if (userTier === "elite") {
        try {
          const profile = await api<ProfileResponse>("/profile");
          setMessages(buildEliteMessages(profile.sport));
        } catch {
          setMessages(MESSAGES.elite);
        }
      }

      try {
        const result = await api<GenerateResponse>("/plan/generate", {
          method: "POST",
          timeoutMs: LONG_TIMEOUT_MS,
        });
        setStatus("success");
        router.push(`/plan/${result.plan_id}`);
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Plan generation failed."
        );
      }
    }

    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, attempt]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center">
        {status === "generating" && (
          <>
            {/* Pulsing spinner */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-zinc-700" />
                <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              </div>
            </div>

            <p className="text-white font-medium mb-2 transition-opacity duration-500">
              {messages[messageIdx]}
            </p>
            <p className="text-zinc-500 text-sm">
              {tier === "elite"
                ? "Building your elite program with deep sport-specific research..."
                : tier === "pro"
                  ? "Searching the latest research to build your plan..."
                  : "This usually takes about 30 seconds."}
            </p>

            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mt-6">
              {messages.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i <= messageIdx ? "bg-blue-500" : "bg-zinc-700"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              </div>
            </div>

            <p className="text-red-400 font-medium mb-2">{error}</p>

            {error.includes("limit") ? (
              <a
                href="/"
                className="text-blue-400 hover:text-blue-300 text-sm transition-colors"
              >
                Upgrade your plan &rarr;
              </a>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                <button
                  onClick={() => {
                    setStatus("generating");
                    setError("");
                    setMessageIdx(0);
                    setAttempt((a) => a + 1);
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-white transition-colors"
                >
                  Try Again
                </button>
                <a
                  href="/onboarding"
                  className="text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
                >
                  Back to Profile
                </a>
              </div>
            )}
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>
            </div>
            <p className="text-white font-medium">Your plan is ready!</p>
          </>
        )}
      </div>
    </div>
  );
}
