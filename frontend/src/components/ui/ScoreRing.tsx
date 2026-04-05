"use client";

import { cn } from "@/lib/utils";

interface ScoreRingProps {
  score: number | null;
  label: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Show glow effect based on score range */
  glow?: boolean;
}

function getColor(score: number): string {
  if (score >= 80) return "#10b981"; // success-500
  if (score >= 60) return "#3b82f6"; // primary-500
  if (score >= 40) return "#f59e0b"; // warning-500
  return "#f43f5e"; // danger-500
}

function getGlowClass(score: number): string {
  if (score >= 80) return "shadow-glow-success";
  if (score >= 60) return "shadow-glow";
  if (score >= 40) return "shadow-glow-warning";
  return "shadow-glow-danger";
}

export default function ScoreRing({
  score,
  label,
  size = 120,
  strokeWidth = 8,
  className,
  glow = false,
}: ScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const displayScore = score ?? 0;
  const offset = circumference - (displayScore / 100) * circumference;
  const color = score != null ? getColor(displayScore) : "#6b7280";

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div
        className={cn("relative rounded-full", glow && score != null && getGlowClass(displayScore))}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-gray-200 dark:text-surface-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-bold tabular-nums"
            style={{ color, fontSize: size < 80 ? "0.875rem" : "1.5rem" }}
          >
            {score != null ? Math.round(score) : "--"}
          </span>
        </div>
      </div>
      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</span>
    </div>
  );
}
