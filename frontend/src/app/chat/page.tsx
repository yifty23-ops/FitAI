"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getUser, fetchUserMe } from "@/lib/auth";
import { api } from "@/lib/api";
import { canUse, type Tier } from "@/lib/tiers";

interface ChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  modifications: {
    type: string;
    details: Record<string, unknown>;
  } | null;
  created_at: string;
}

interface ChatResponse {
  response: string;
  plan_modified: boolean;
  modifications: {
    type: string;
    details: Record<string, unknown>;
  } | null;
}

interface ActivePlan {
  id: string;
  profile_snapshot: Record<string, unknown>;
  mesocycle_weeks: number;
  current_week: number;
  phase: string;
}

const QUICK_ACTIONS = [
  "Should I train today?",
  "I'm feeling sore",
  "Swap an exercise",
];

export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userTier, setUserTier] = useState<Tier>("free");
  const [plan, setPlan] = useState<ActivePlan | null>(null);
  const [sport, setSport] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

      if (!canUse(tier, "coach_chat")) {
        setLoading(false);
        return;
      }
      try {
        const activePlan = await api<ActivePlan>("/plan/active");
        setPlan(activePlan);

        // Extract sport from profile_snapshot
        const snapshot = activePlan.profile_snapshot || {};
        setSport((snapshot as Record<string, string>).sport || "");

        // Load chat history
        const history = await api<ChatMsg[]>(`/chat/${activePlan.id}`);
        setMessages(history);
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

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const msg = text || input.trim();
    if (!msg || sending || !plan) return;
    setInput("");
    setSending(true);
    setError("");

    // Optimistically add user message
    const tempId = `temp-${Date.now()}`;
    const tempUserMsg: ChatMsg = {
      id: tempId,
      role: "user",
      content: msg,
      modifications: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api<ChatResponse>("/chat", {
        method: "POST",
        body: JSON.stringify({ message: msg, plan_id: plan.id }),
      });

      const assistantMsg: ChatMsg = {
        id: `resp-${Date.now()}`,
        role: "assistant",
        content: res.response,
        modifications: res.modifications || null,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Refresh plan data if modified
      if (res.plan_modified) {
        const updatedPlan = await api<ActivePlan>("/plan/active");
        setPlan(updatedPlan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send");
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setSending(false);
    }
  }

  // Tier gate: non-elite upgrade screen
  if (!loading && !canUse(userTier, "coach_chat")) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-white">AI Coach Chat</h1>
          <p className="text-zinc-400 text-sm">
            Chat directly with your AI coach who knows your plan, your progress,
            and your goals. Available for Elite members only.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-2.5 bg-amber-600 hover:bg-amber-500 rounded-lg font-medium text-sm text-white transition-colors"
          >
            Upgrade to Elite
          </a>
          <button
            onClick={() => router.push("/dashboard")}
            className="block mx-auto text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-700 border-t-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Context header */}
      <div className="shrink-0 px-4 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="text-zinc-400 hover:text-white text-sm transition-colors"
          >
            &larr; Dashboard
          </button>
          {plan && (
            <span className="text-xs text-zinc-500">
              {sport
                ? `Coaching you for ${sport} \u2014 Week ${plan.current_week} of ${plan.mesocycle_weeks}`
                : `Week ${plan.current_week} of ${plan.mesocycle_weeks}`}
            </span>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
                <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
              </div>
              <p className="text-zinc-500 text-sm">Start a conversation with your coach</p>
              <p className="text-zinc-600 text-xs mt-1">
                Ask about your training, request plan changes, or get advice
              </p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-800 text-zinc-100"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.modifications && (
                  <div className="mt-2 p-2.5 bg-zinc-700/50 rounded-lg border border-zinc-600">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium text-amber-400">Plan updated</span>
                      <span className="text-xs text-zinc-400">
                        {msg.modifications.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <button
                      onClick={() => plan && router.push(`/plan/${plan.id}`)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      View changes &rarr;
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-zinc-800 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick actions + Input bar */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {/* Quick action chips — shown when conversation is fresh */}
          {messages.length < 3 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => handleSend(action)}
                  disabled={sending}
                  className="shrink-0 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-full text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors disabled:opacity-50"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
          {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask your coach..."
              disabled={sending}
              className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={sending || !input.trim()}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-colors ${
                sending || !input.trim()
                  ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
