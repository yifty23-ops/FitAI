"use client";

import type { Tier } from "@/lib/tiers";

interface MacroTargets {
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  calories?: number;
}

export interface NutritionData {
  daily_calories?: number;
  training_day?: MacroTargets;
  rest_day?: MacroTargets;
  notes?: string;
}

interface NutritionPanelProps {
  nutrition: NutritionData;
  tier: Tier;
}

function MacroRow({
  label,
  grams,
  color,
  maxGrams,
}: {
  label: string;
  grams: number;
  color: string;
  maxGrams: number;
}) {
  const pct = maxGrams > 0 ? Math.round((grams / maxGrams) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-zinc-400">{label}</span>
        <span className="text-white font-medium">{grams}g</span>
      </div>
      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function DayColumn({
  title,
  macros,
}: {
  title: string;
  macros: MacroTargets | undefined;
}) {
  if (!macros) return null;

  const protein = macros.protein_g ?? 0;
  const carbs = macros.carbs_g ?? 0;
  const fat = macros.fat_g ?? 0;
  const calories = macros.calories ?? 0;
  const maxGrams = Math.max(protein, carbs, fat, 1);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-zinc-400 text-xs uppercase tracking-wide mb-2">
        {title}
      </p>
      <p className="text-2xl font-bold text-white mb-3">
        {calories}
        <span className="text-sm font-normal text-zinc-500 ml-1">kcal</span>
      </p>
      <div className="space-y-2.5">
        <MacroRow
          label="Protein"
          grams={protein}
          color="bg-blue-500"
          maxGrams={maxGrams}
        />
        <MacroRow
          label="Carbs"
          grams={carbs}
          color="bg-amber-500"
          maxGrams={maxGrams}
        />
        <MacroRow
          label="Fat"
          grams={fat}
          color="bg-rose-500"
          maxGrams={maxGrams}
        />
      </div>
    </div>
  );
}

export default function NutritionPanel({ nutrition }: NutritionPanelProps) {
  const hasData = nutrition.training_day || nutrition.rest_day;
  if (!hasData) {
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4">
        <p className="text-zinc-500 text-sm">
          Nutrition targets will appear when your plan includes macro guidance.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5">
      <h3 className="text-white font-semibold mb-4">Nutrition Targets</h3>

      <div className="flex gap-6">
        <DayColumn title="Training Day" macros={nutrition.training_day} />
        <div className="w-px bg-zinc-700" />
        <DayColumn title="Rest Day" macros={nutrition.rest_day} />
      </div>

      {nutrition.notes && (
        <p className="text-zinc-500 text-sm mt-4 pt-4 border-t border-zinc-800">
          {nutrition.notes}
        </p>
      )}
    </div>
  );
}
