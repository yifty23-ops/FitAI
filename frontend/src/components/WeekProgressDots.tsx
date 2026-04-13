"use client";

interface WeekProgressDotsProps {
  totalDays: number;
  completedDays: number[];
  hasCheckin: boolean;
}

export default function WeekProgressDots({
  totalDays,
  completedDays,
  hasCheckin,
}: WeekProgressDotsProps) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: totalDays }, (_, i) => {
        const dayNum = i + 1;
        const done = completedDays.includes(dayNum);
        return (
          <div
            key={dayNum}
            className={`w-3 h-3 rounded-full ${
              done ? "bg-blue-500" : "border border-zinc-600"
            }`}
            title={`Day ${dayNum}${done ? " (completed)" : ""}`}
          />
        );
      })}
      <div
        className={`w-3 h-3 rounded-full ml-1 ${
          hasCheckin ? "bg-green-500" : "border border-zinc-600"
        }`}
        title={hasCheckin ? "Check-in done" : "Check-in pending"}
      />
    </div>
  );
}
