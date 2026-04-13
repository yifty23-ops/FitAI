"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveToken, isLoggedIn } from "@/lib/auth";
import { Tier, TIER_DISPLAY } from "@/lib/tiers";

interface AuthResponse {
  token: string;
  user_id: string;
  tier: string;
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedTier, setSelectedTier] = useState<Tier>("free");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ total_outcomes: number; sports_count: number } | null>(null);

  useEffect(() => {
    if (isLoggedIn()) {
      router.push("/dashboard");
      return;
    }
    api<{ total_outcomes: number; sports_count: number }>("/collective/stats")
      .then(setStats)
      .catch(() => {});
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const res = await api<AuthResponse>("/auth/signup", {
          method: "POST",
          body: JSON.stringify({ email, password, tier: selectedTier }),
        });
        saveToken(res.token);
      } else {
        const res = await api<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        });
        saveToken(res.token);
      }
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-zinc-950 text-white px-4 py-12">
      <div className="w-full max-w-md mb-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-2">FitAI</h1>
        <p className="text-zinc-400">AI-powered personal training</p>
      </div>

      <div className="w-full max-w-md bg-zinc-900 rounded-2xl p-6 mb-8">
        <div className="flex mb-6 bg-zinc-800 rounded-lg p-1">
          <button
            onClick={() => { setMode("signup"); setError(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-zinc-700 text-white" : "text-zinc-400"
            }`}
          >
            Sign Up
          </button>
          <button
            onClick={() => { setMode("login"); setError(""); }}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "login" ? "bg-zinc-700 text-white" : "text-zinc-400"
            }`}
          >
            Log In
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-zinc-400 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-zinc-400 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
          >
            {loading ? "..." : mode === "signup" ? "Create Account" : "Log In"}
          </button>
        </form>
      </div>

      {mode === "signup" && (
        <div className="w-full max-w-3xl">
          <h2 className="text-center text-lg font-semibold mb-4 text-zinc-300">
            Choose your coaching tier
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["free", "pro", "elite"] as Tier[]).map((tier) => {
              const display = TIER_DISPLAY[tier];
              const selected = selectedTier === tier;
              return (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                    selected
                      ? "border-blue-500 bg-zinc-900"
                      : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                  }`}
                >
                  {display.highlight && (
                    <span className="absolute -top-3 left-4 bg-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-lg font-bold">{display.name}</span>
                    <span className="text-zinc-400 text-sm">{display.price}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {display.features.map((f, i) => (
                      <li key={i} className="text-sm text-zinc-400 flex items-start gap-2">
                        <span className="text-blue-400 mt-0.5 shrink-0">&#10003;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {stats && stats.total_outcomes > 0 && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Built on {stats.total_outcomes.toLocaleString()} real training outcome{stats.total_outcomes !== 1 ? "s" : ""}
          {stats.sports_count > 0 && ` across ${stats.sports_count} sport${stats.sports_count !== 1 ? "s" : ""}`}
        </p>
      )}
    </div>
  );
}
