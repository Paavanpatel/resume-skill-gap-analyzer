"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
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
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Matched Skills */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Matched Skills
          </h2>
          <span className="text-sm text-gray-500">{matchedSkills.length} found</span>
        </div>

        {matchedSkills.length === 0 ? (
          <p className="text-sm text-gray-400">No matched skills found.</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleMatched.map((skill, i) => (
                <div
                  key={`${skill.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800">{skill.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{skill.category}</span>
                  </div>
                  <ConfidenceBar value={skill.confidence} />
                </div>
              ))}
            </div>

            {matchedSkills.length > INITIAL_COUNT && (
              <button
                onClick={() => setShowAllMatched((v) => !v)}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {showAllMatched ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show all {matchedSkills.length} <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </>
        )}
      </Card>

      {/* Missing Skills */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <XCircle className="h-5 w-5 text-red-400" />
            Missing Skills
          </h2>
          <span className="text-sm text-gray-500">{missingSkills.length} gaps</span>
        </div>

        {missingSkills.length === 0 ? (
          <p className="text-sm text-gray-400">No skill gaps detected!</p>
        ) : (
          <>
            <div className="space-y-2">
              {visibleMissing.map((skill, i) => (
                <div
                  key={`${skill.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800">{skill.name}</span>
                    <span className="ml-2 text-xs text-gray-500">{skill.category}</span>
                  </div>
                  <PriorityBadge priority={skill.priority} />
                </div>
              ))}
            </div>

            {missingSkills.length > INITIAL_COUNT && (
              <button
                onClick={() => setShowAllMissing((v) => !v)}
                className="mt-3 flex items-center gap-1 text-sm font-medium text-primary-600 hover:text-primary-700"
              >
                {showAllMissing ? (
                  <>Show less <ChevronUp className="h-4 w-4" /></>
                ) : (
                  <>Show all {missingSkills.length} <ChevronDown className="h-4 w-4" /></>
                )}
              </button>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-green-200">
        <div
          className="h-full rounded-full bg-green-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs text-gray-500">{pct}%</span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: "high" | "medium" | "low" }) {
  const variant = priority === "high" ? "danger" : priority === "medium" ? "warning" : "info";
  return <Badge variant={variant} className="text-xs capitalize">{priority}</Badge>;
}
