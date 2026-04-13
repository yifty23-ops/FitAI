export type Tier = "free" | "pro" | "elite";

export const TIER_FEATURES: Record<Tier, Record<string, boolean | number>> = {
  free: {
    web_search: false,
    adaptation: false,
    collective: false,
    coach_chat: false,
    sport_specific: false,
    max_plans_per_month: 1,
    max_mesocycle_weeks: 4,
  },
  pro: {
    web_search: true,
    adaptation: true,
    collective: true,
    coach_chat: false,
    sport_specific: false,
    max_plans_per_month: -1,
    max_mesocycle_weeks: 12,
  },
  elite: {
    web_search: true,
    adaptation: true,
    collective: true,
    coach_chat: true,
    sport_specific: true,
    max_plans_per_month: -1,
    max_mesocycle_weeks: 16,
  },
};

export function canUse(tier: Tier, feature: string): boolean {
  return !!TIER_FEATURES[tier]?.[feature];
}

export interface TierDisplay {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
}

export const TIER_DISPLAY: Record<Tier, TierDisplay> = {
  free: {
    name: "Free",
    price: "$0",
    features: [
      "1 plan per month",
      "4-week training blocks",
      "Certified trainer persona",
      "Based on training principles",
    ],
  },
  pro: {
    name: "Pro",
    price: "$19/mo",
    highlight: true,
    features: [
      "Unlimited plans",
      "8-12 week periodized mesocycles",
      "World-class S&C coach persona",
      "Evidence-based research (PubMed)",
      "Weekly plan adaptation",
      "Collective learning insights",
    ],
  },
  elite: {
    name: "Elite",
    price: "$49/mo",
    features: [
      "Everything in Pro",
      "Up to 16-week mesocycles",
      "Sport-specific Olympic-level coach",
      "Deep sport research",
      "Competition peaking model",
      "On-demand adaptation",
      "Coach chat",
    ],
  },
};
