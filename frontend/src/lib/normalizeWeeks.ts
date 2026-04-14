import type { PeriodWeek } from "@/components/PeriodizationBar";

/**
 * Normalize AI-generated plan data into a consistent PeriodWeek[] array.
 * Handles multiple JSON shapes the AI may produce.
 */
export function normalizeWeeks(planData: Record<string, unknown>): PeriodWeek[] {
  // Try: { weeks: [...] }
  if (Array.isArray(planData.weeks)) return planData.weeks as PeriodWeek[];

  // Try: { plan: { weeks: [...] } }
  if (
    planData.plan &&
    typeof planData.plan === "object" &&
    Array.isArray((planData.plan as Record<string, unknown>).weeks)
  ) {
    return (planData.plan as Record<string, unknown>).weeks as PeriodWeek[];
  }

  // Try: top-level array
  if (Array.isArray(planData)) return planData as PeriodWeek[];

  // Try: { plan: [...] } (array directly under plan key)
  if (Array.isArray(planData.plan)) return planData.plan as PeriodWeek[];

  return [];
}
