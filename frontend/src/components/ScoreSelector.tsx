"use client";

interface ScoreSelectorProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  disabled: boolean;
  lowLabel?: string;
  highLabel?: string;
}

export default function ScoreSelector({
  label,
  value,
  onChange,
  max,
  disabled,
  lowLabel,
  highLabel,
}: ScoreSelectorProps) {
  return (
    <div>
      <label className="text-zinc-300 text-sm font-medium block mb-2">
        {label}
      </label>
      <div
        className="flex gap-1.5 flex-wrap"
        role="radiogroup"
        aria-label={label}
      >
        {Array.from({ length: max }, (_, i) => {
          const n = i + 1;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              disabled={disabled}
              onClick={() => onChange(n)}
              className={`min-w-[36px] h-9 flex-1 rounded-lg text-sm font-medium transition-colors ${
                value === n
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              } disabled:opacity-50`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex justify-between mt-1">
          <span className="text-zinc-600 text-xs">{lowLabel}</span>
          <span className="text-zinc-600 text-xs">{highLabel}</span>
        </div>
      )}
    </div>
  );
}
