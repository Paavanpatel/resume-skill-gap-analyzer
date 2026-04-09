"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import type { Skill, MissingSkill } from "@/types/analysis";

interface SkillsSectionProps {
  matchedSkills: Skill[];
  missingSkills: MissingSkill[];
}

export default function SkillsSection({ matchedSkills, missingSkills }: SkillsSectionProps) {
  const [showAllMatched, setShowAllMatched] = useState(false);
  const [showAllMissing, setShowAllMissing] = useState(false);

  const INITIAL_COUNT = 8;

  const visibleMatched = showAllMatched ? matchedSkills : matchedSkills.slice(0, INITIAL_COUNT);
  const visibleMissing = showAllMissing ? missingSkills : missingSkills.slice(0, INITIAL_COUNT);

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* Matched Skills */}
      <div className="rounded-2xl bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50 dark:bg-success-900/20">
              <CheckCircle2 className="h-4 w-4 text-success-500" />
            </div>
            Matched Skills
          </h2>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-700/50 rounded-full px-2.5 py-1">
            {matchedSkills.length}
          </span>
        </div>

        {matchedSkills.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No matched skills found.</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleMatched.map((skill, i) => {
                const pct = Math.round(skill.confidence * 100);
                return (
                  <div
                    key={`${skill.name}-${i}`}
                    className="flex items-center gap-3 rounded-xl bg-gray-50 dark:bg-surface-700/30 px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-surface-700/50"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {skill.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                        {skill.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-surface-600">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-success-400 to-success-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tabular-nums w-7 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {matchedSkills.length > INITIAL_COUNT && (
              <button
                onClick={() => setShowAllMatched((v) => !v)}
                className="mt-4 flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                {showAllMatched ? (
                  <>
                    Show less <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show all {matchedSkills.length} <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>

      {/* Missing Skills */}
      <div className="rounded-2xl bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm border border-gray-100 dark:border-surface-700 shadow-soft dark:shadow-dark-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-50 dark:bg-danger-900/20">
              <AlertTriangle className="h-4 w-4 text-danger-500" />
            </div>
            Skill Gaps
          </h2>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-surface-700/50 rounded-full px-2.5 py-1">
            {missingSkills.length}
          </span>
        </div>

        {missingSkills.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No skill gaps detected!</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleMissing.map((skill, i) => (
                <div
                  key={`${skill.name}-${i}`}
                  className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-surface-700/30 px-4 py-3 transition-colors hover:bg-gray-100 dark:hover:bg-surface-700/50"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {skill.name}
                    </span>
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {skill.category}
                    </span>
                  </div>
                  <PriorityBadge priority={skill.priority} />
                </div>
              ))}
            </div>

            {missingSkills.length > INITIAL_COUNT && (
              <button
                onClick={() => setShowAllMissing((v) => !v)}
                className="mt-4 flex items-center gap-1 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                {showAllMissing ? (
                  <>
                    Show less <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Show all {missingSkills.length} <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </button>
            )}

            {/* Quick insight */}
            {missingSkills.filter((s) => s.priority === "high").length > 0 && (
              <div className="mt-5 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 dark:from-primary-950/20 dark:to-accent-950/20 border border-primary-100 dark:border-primary-800/30 p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Zap className="h-4 w-4 text-primary-500" />
                  <span className="text-xs font-semibold text-primary-700 dark:text-primary-300">
                    Quick Insight
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Focus on the {missingSkills.filter((s) => s.priority === "high").length}{" "}
                  high-priority skill{" "}
                  {missingSkills.filter((s) => s.priority === "high").length === 1 ? "gap" : "gaps"}{" "}
                  first to maximize your match score improvement.
                </p>
              </div>
            )}
          </>
        )}
      </div>
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
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${classes}`}
    >
      {priority}
    </span>
  );
}
