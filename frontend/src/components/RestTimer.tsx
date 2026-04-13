"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface RestTimerProps {
  defaultSeconds?: number;
  active: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

export default function RestTimer({
  defaultSeconds = 90,
  active,
  onComplete,
  onDismiss,
}: RestTimerProps) {
  const [seconds, setSeconds] = useState(defaultSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasStartedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Auto-start when active becomes true
  useEffect(() => {
    if (active && !hasStartedRef.current) {
      hasStartedRef.current = true;
      setSeconds(defaultSeconds);
      setRunning(true);
    }
    if (!active) {
      hasStartedRef.current = false;
      setRunning(false);
      clearTimer();
    }
  }, [active, defaultSeconds, clearTimer]);

  // Countdown logic
  useEffect(() => {
    if (!running) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearTimer();
          setRunning(false);
          if ("vibrate" in navigator) {
            navigator.vibrate(200);
          }
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [running, clearTimer, onComplete]);

  if (!active) return null;

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-700 px-4 py-3 safe-area-pb">
      <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
        {/* Adjust buttons */}
        <button
          type="button"
          onClick={() => setSeconds((prev) => Math.max(0, prev - 30))}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          -30s
        </button>

        {/* Timer display */}
        <div className="flex flex-col items-center flex-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">
            Rest
          </span>
          <span
            className={`text-4xl font-mono font-bold tabular-nums ${
              running ? "text-blue-400" : seconds === 0 ? "text-green-400" : "text-zinc-300"
            }`}
          >
            {display}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSeconds((prev) => prev + 30)}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
        >
          +30s
        </button>

        {/* Skip/Dismiss */}
        <button
          type="button"
          onClick={() => {
            clearTimer();
            setRunning(false);
            onDismiss();
          }}
          className="px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
