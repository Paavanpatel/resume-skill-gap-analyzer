"use client";

/**
 * UsageWidget — shows the user's monthly analysis usage as a progress bar.
 * Rendered at the top of the /dashboard page.
 *
 * Free tier: "3 / 5 analyses used"   [████░░]  60%
 * Pro tier:  "12 / 50 analyses used"
 * Enterprise: hidden (unlimited)
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap } from "lucide-react";
import { getUsageSummary, type UsageSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

function barColor(pct: number): string {
  if (pct >= 90) return "bg-danger-500";
  if (pct >= 70) return "bg-warning-500";
  return "bg-primary-500";
}

export default function UsageWidget() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    getUsageSummary()
      .then(setUsage)
      .catch(() => {});
  }, []);

  // Enterprise = unlimited → don't show widget
  if (!usage || usage.tier === "enterprise") return null;

  const { used, limit, pct } = usage.analyses;
  const isNearLimit = pct >= 80;
  const isAtLimit = used >= limit;

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex items-center gap-4",
        isAtLimit
          ? "border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/20"
          : isNearLimit
            ? "border-warning-200 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20"
            : "border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800"
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          isAtLimit
            ? "bg-danger-100 dark:bg-danger-900/40"
            : isNearLimit
              ? "bg-warning-100 dark:bg-warning-900/40"
              : "bg-primary-50 dark:bg-primary-900/30"
        )}
      >
        <Zap
          className={cn(
            "h-4 w-4",
            isAtLimit
              ? "text-danger-600 dark:text-danger-400"
              : isNearLimit
                ? "text-warning-600 dark:text-warning-400"
                : "text-primary-600 dark:text-primary-400"
          )}
        />
      </div>

      {/* Label + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {isAtLimit ? "Monthly limit reached" : `${used} / ${limit} analyses used`}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">{usage.period}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
          <div
            className={cn("h-full rounded-full transition-all duration-700", barColor(pct))}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      {/* Upgrade CTA */}
      {(isNearLimit || isAtLimit) && usage.tier === "free" && (
        <Link
          href="/pricing"
          className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}
