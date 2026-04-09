"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from "lucide-react";
import type { CategoryBreakdown as CategoryBreakdownType } from "@/types/analysis";

interface CategoryBreakdownProps {
  breakdowns: CategoryBreakdownType[];
}

export default function CategoryBreakdown({ breakdowns }: CategoryBreakdownProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const sorted = [...breakdowns].sort((a, b) => {
    const priorityOrder = { critical: 0, important: 1, nice_to_have: 2 };
    return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2);
  });

  return (
    <div>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/20">
          <BarChart3 className="h-4 w-4 text-primary-500" />
        </div>
        Skill Categories
      </h2>

      <div className="space-y-4">
        {sorted.map((cat) => {
          const isExpanded = expandedCategory === cat.category;
          const pct = Math.round(cat.match_percentage);

          return (
            <div
              key={cat.category}
              className="rounded-2xl bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm overflow-hidden transition-all duration-300 hover:shadow-md"
            >
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                className="flex w-full items-center gap-5 px-6 py-5 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {cat.display_name}
                    </span>
                    <PriorityLabel priority={cat.priority} />
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-4">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          pct >= 80
                            ? "bg-gradient-to-r from-success-400 to-success-500"
                            : pct >= 60
                              ? "bg-gradient-to-r from-primary-400 to-primary-500"
                              : pct >= 40
                                ? "bg-gradient-to-r from-warning-400 to-warning-500"
                                : "bg-gradient-to-r from-danger-400 to-danger-500"
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 w-12 text-right">
                      {pct}%
                    </span>
                  </div>

                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {cat.matched_count} of {cat.total_job_skills} skills matched
                  </p>
                </div>

                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                ) : (
                  <ChevronDown className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-50 dark:border-surface-700/50 px-6 py-5 animate-fade-in">
                  <div className="grid gap-6 sm:grid-cols-2">
                    {cat.matched_skills.length > 0 && (
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-success-600 dark:text-success-400">
                          Matched ({cat.matched_skills.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {cat.matched_skills.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-success-50 dark:bg-success-900/15 border border-success-100 dark:border-success-800/30 px-3 py-1.5 text-xs font-medium text-success-700 dark:text-success-300"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {cat.missing_skills.length > 0 && (
                      <div>
                        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-danger-600 dark:text-danger-400">
                          Missing ({cat.missing_skills.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {cat.missing_skills.map((s) => (
                            <span
                              key={s}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-danger-50 dark:bg-danger-900/15 border border-danger-100 dark:border-danger-800/30 px-3 py-1.5 text-xs font-medium text-danger-700 dark:text-danger-300"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PriorityLabel({ priority }: { priority: "critical" | "important" | "nice_to_have" }) {
  const classes =
    priority === "critical"
      ? "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
      : priority === "important"
        ? "bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
        : "bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400";

  const label =
    priority === "nice_to_have"
      ? "Nice to have"
      : priority.charAt(0).toUpperCase() + priority.slice(1);

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}
    >
      {label}
    </span>
  );
}
