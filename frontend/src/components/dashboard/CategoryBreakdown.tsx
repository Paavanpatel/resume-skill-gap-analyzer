"use client";

import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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
    <Card>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-gray-900">
        <BarChart3 className="h-5 w-5 text-primary-500" />
        Skill Categories
      </h2>

      <div className="space-y-3">
        {sorted.map((cat) => {
          const isExpanded = expandedCategory === cat.category;
          const pct = Math.round(cat.match_percentage);
          const barColor =
            pct >= 80 ? "bg-green-500" :
            pct >= 60 ? "bg-blue-500" :
            pct >= 40 ? "bg-amber-500" :
            "bg-red-500";

          return (
            <div
              key={cat.category}
              className="rounded-lg border border-gray-200 transition-colors hover:border-gray-300"
            >
              <button
                onClick={() => setExpandedCategory(isExpanded ? null : cat.category)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {cat.display_name}
                    </span>
                    <PriorityLabel priority={cat.priority} />
                  </div>

                  <div className="mt-1.5 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full ${barColor} transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 text-right text-sm font-semibold text-gray-700">
                      {pct}%
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-gray-500">
                    {cat.matched_count} of {cat.total_job_skills} skills matched
                  </p>
                </div>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {cat.matched_skills.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-green-700">
                          Matched ({cat.matched_skills.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.matched_skills.map((s) => (
                            <span
                              key={s}
                              className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {cat.missing_skills.length > 0 && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase text-red-700">
                          Missing ({cat.missing_skills.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cat.missing_skills.map((s) => (
                            <span
                              key={s}
                              className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800"
                            >
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
    </Card>
  );
}

function PriorityLabel({ priority }: { priority: "critical" | "important" | "nice_to_have" }) {
  const config = {
    critical: { variant: "danger" as const, label: "Critical" },
    important: { variant: "warning" as const, label: "Important" },
    nice_to_have: { variant: "info" as const, label: "Nice to have" },
  };
  const { variant, label } = config[priority];
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}
