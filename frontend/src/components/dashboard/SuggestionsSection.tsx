"use client";

import { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type { ResumeSuggestion } from "@/types/analysis";

interface SuggestionsSectionProps {
  suggestions: ResumeSuggestion[];
  suggestionsLimited?: boolean;
}

export default function SuggestionsSection({
  suggestions,
  suggestionsLimited,
}: SuggestionsSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const sortedSuggestions = [...suggestions].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority ?? "low"] ?? 2) - (order[b.priority ?? "low"] ?? 2);
  });

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Improvement Suggestions
        </h2>
        <span className="text-sm text-gray-500">{suggestions.length} suggestions</span>
      </div>

      {suggestionsLimited && (
        <Link
          href="/pricing"
          className="mb-4 flex items-center gap-3 rounded-lg border border-primary-200 dark:border-primary-700/50 bg-primary-50 dark:bg-primary-900/10 px-4 py-3 transition-colors hover:bg-primary-100 dark:hover:bg-primary-900/20"
        >
          <Sparkles className="h-5 w-5 shrink-0 text-primary-600 dark:text-primary-400" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            <span className="font-semibold text-primary-700 dark:text-primary-300">
              Upgrade to Pro
            </span>{" "}
            for AI-powered suggestions tailored to your resume
          </span>
          <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-primary-500" />
        </Link>
      )}

      {sortedSuggestions.length === 0 ? (
        <p className="text-sm text-gray-400">No suggestions at this time.</p>
      ) : (
        <div className="space-y-3">
          {sortedSuggestions.map((s, i) => {
            const isExpanded = expandedIndex === i;
            return (
              <div
                key={i}
                className="rounded-lg border border-gray-200 transition-colors hover:border-gray-300"
              >
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <SectionBadge section={s.section} />
                    {s.priority && (
                      <Badge
                        variant={
                          s.priority === "high"
                            ? "danger"
                            : s.priority === "medium"
                              ? "warning"
                              : "info"
                        }
                        className="text-xs capitalize shrink-0"
                      >
                        {s.priority}
                      </Badge>
                    )}
                    <span className="truncate text-sm font-medium text-gray-800">{s.reason}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                    {s.current && (
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                          Current
                        </p>
                        <p className="rounded bg-red-50 px-3 py-2 text-sm text-gray-700">
                          {s.current}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Suggested
                      </p>
                      <p className="rounded bg-green-50 px-3 py-2 text-sm text-gray-700">
                        {s.suggested}
                      </p>
                    </div>
                    {s.source && (
                      <p className="text-xs text-gray-400">
                        Source: {s.source === "llm" ? "AI-generated" : "Rule-based"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function SectionBadge({ section }: { section: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
      {section}
    </span>
  );
}
