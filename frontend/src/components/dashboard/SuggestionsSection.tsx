"use client";

import { useState } from "react";
import { Lightbulb, ChevronDown, ChevronUp, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning-50 dark:bg-warning-900/20">
            <Lightbulb className="h-4 w-4 text-warning-500" />
          </div>
          Improvement Suggestions
        </h2>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-700/50 rounded-full px-2.5 py-1">
          {suggestions.length}
        </span>
      </div>

      {suggestionsLimited && (
        <Link
          href="/pricing"
          className="mb-4 flex items-center gap-3 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/20 dark:to-accent-950/20 border border-primary-100 dark:border-primary-800/30 px-4 py-3 transition-all duration-300 hover:shadow-md"
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
        <p className="text-sm text-gray-400 dark:text-gray-500">No suggestions at this time.</p>
      ) : (
        <div className="space-y-4">
          {sortedSuggestions.map((s, i) => {
            const isExpanded = expandedIndex === i;
            return (
              <div
                key={i}
                className="rounded-2xl bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm overflow-hidden transition-all duration-300 hover:shadow-md"
              >
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : i)}
                  className="flex w-full items-center gap-4 px-6 py-5 text-left"
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${
                      s.priority === "high"
                        ? "bg-danger-50 dark:bg-danger-900/20"
                        : s.priority === "medium"
                          ? "bg-warning-50 dark:bg-warning-900/20"
                          : "bg-gray-50 dark:bg-surface-700/50"
                    }`}
                  >
                    <Lightbulb
                      className={`h-4 w-4 ${
                        s.priority === "high"
                          ? "text-danger-500"
                          : s.priority === "medium"
                            ? "text-warning-500"
                            : "text-gray-400 dark:text-gray-500"
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        {s.section}
                      </span>
                      {s.priority && <PriorityBadge priority={s.priority} />}
                      {s.source === "llm" && (
                        <span className="flex items-center gap-1 text-xs text-accent-500">
                          <Sparkles className="h-3 w-3" />
                          AI
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 line-clamp-1">
                      {s.reason}
                    </span>
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-gray-300 dark:text-gray-600" />
                  )}
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-50 dark:border-surface-700/50 px-6 py-5 space-y-4 animate-fade-in">
                    {s.current && (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                          Current
                        </p>
                        <p className="rounded-xl bg-danger-50/50 dark:bg-danger-900/10 border border-danger-100 dark:border-danger-800/20 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                          {s.current}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                        Suggested
                      </p>
                      <p className="rounded-xl bg-success-50/50 dark:bg-success-900/10 border border-success-100 dark:border-success-800/20 px-4 py-3 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                        {s.suggested}
                      </p>
                    </div>
                    {s.source && (
                      <p className="text-xs text-gray-400 dark:text-gray-500">
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
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const classes =
    priority === "high"
      ? "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
      : priority === "medium"
        ? "bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400"
        : "bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400";

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${classes}`}
    >
      {priority}
    </span>
  );
}
