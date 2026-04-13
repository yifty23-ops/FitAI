"use client";

import { useEffect } from "react";

interface CelebrationProps {
  show: boolean;
  onComplete: () => void;
  message?: string;
}

export default function Celebration({
  show,
  onComplete,
  message = "Done!",
}: CelebrationProps) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onComplete, 2000);
    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-4 animate-[celebrationFadeIn_0.3s_ease-out]">
        {/* Checkmark circle */}
        <div className="w-24 h-24 rounded-full bg-green-600/20 border-2 border-green-500 flex items-center justify-center animate-[celebrationPulse_0.6s_ease-out]">
          <svg
            className="w-12 h-12 text-green-400 animate-[celebrationCheck_0.4s_ease-out_0.2s_both]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>

        {/* Message */}
        <p className="text-white text-xl font-semibold animate-[celebrationFadeIn_0.4s_ease-out_0.3s_both]">
          {message}
        </p>
      </div>

      <style>{`
        @keyframes celebrationPulse {
          0% { transform: scale(0.5); opacity: 0; }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes celebrationCheck {
          0% { opacity: 0; transform: scale(0.3); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes celebrationFadeIn {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
