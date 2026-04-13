"use client";

import { canUse, type Tier, TIER_DISPLAY } from "@/lib/tiers";

interface TierGateProps {
  feature: string;
  currentTier: Tier;
  title: string;
  description: string;
  requiredTier: Tier;
}

export default function TierGate({
  feature,
  currentTier,
  title,
  description,
  requiredTier,
}: TierGateProps) {
  if (canUse(currentTier, feature)) return null;

  const tierName = TIER_DISPLAY[requiredTier].name;

  return (
    <div className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl p-5">
      <div className="flex items-start gap-3">
        <svg
          className="w-5 h-5 text-zinc-500 mt-0.5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
        <div>
          <p className="text-zinc-300 font-medium">{title}</p>
          <p className="text-zinc-500 text-sm mt-1">{description}</p>
          <a
            href="/settings"
            className="text-blue-400 hover:text-blue-300 text-sm mt-2 inline-block transition-colors"
          >
            Upgrade to {tierName} &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
