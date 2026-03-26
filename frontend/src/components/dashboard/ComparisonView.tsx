"use client";

import { useEffect, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  Minus,
  X,
  Target,
  Shield,
  FileText,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ScoreRing from "@/components/ui/ScoreRing";
import Button from "@/components/ui/Button";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import { cn, formatDate } from "@/lib/utils";
import { getAnalysisResult, getErrorMessage } from "@/lib/api";
import type { AnalysisResult, Skill, MissingSkill } from "@/types/analysis";

interface ComparisonViewProps {
  analysisIds: [string, string];
  onClose: () => void;
  className?: string;
}

interface DeltaProps {
  label: string;
  valueA: number | null;
  valueB: number | null;
  suffix?: string;
}

function DeltaDisplay({ label, valueA, valueB, suffix = "%" }: DeltaProps) {
  const a = valueA ?? 0;
  const b = valueB ?? 0;
  const delta = b - a;
  const improved = delta > 0;
  const regressed = delta < 0;

  return (
    <div className="text-center" data-testid={`delta-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-center justify-center gap-1.5">
        {delta !== 0 && (
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              improved && "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400",
              regressed && "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
            )}
          >
            {improved ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(Math.round(delta))}{suffix}
          </span>
        )}
        {delta === 0 && (
          <span className="flex items-center gap-0.5 text-xs text-gray-400">
            <Minus className="h-3 w-3" />
            No change
          </span>
        )}
      </div>
    </div>
  );
}

function ScoreColumn({
  label,
  result,
  position,
}: {
  label: string;
  result: AnalysisResult;
  position: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex-1 space-y-4 text-center",
        position === "left" ? "border-r border-gray-100 dark:border-surface-700 pr-4" : "pl-4"
      )}
    >
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {result.id.slice(0, 8)}...
        </p>
      </div>

      {/* Score rings */}
      <div className="flex flex-col items-center gap-4">
        <div>
          <ScoreRing score={result.match_score} label="Match" size={80} strokeWidth={6} />
          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
            <AnimatedCounter value={result.match_score ?? 0} suffix="%" duration={800} animateOnView={false} />
          </p>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">ATS</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {result.ats_score != null ? `${Math.round(result.ats_score)}%` : "--"}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Format</p>
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              {result.ats_check?.format_score != null ? `${Math.round(result.ats_check.format_score)}%` : "--"}
            </p>
          </div>
        </div>
      </div>

      {/* Skills summary */}
      <div className="space-y-2 text-left">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          <CheckCircle2 className="h-3.5 w-3.5 text-success-500" />
          <span>{result.matched_skills?.length ?? 0} matched skills</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          <XCircle className="h-3.5 w-3.5 text-danger-500" />
          <span>{result.missing_skills?.length ?? 0} missing skills</span>
        </div>
      </div>
    </div>
  );
}

function SkillsDiff({
  resultA,
  resultB,
}: {
  resultA: AnalysisResult;
  resultB: AnalysisResult;
}) {
  const matchedA = new Set((resultA.matched_skills || []).map((s) => s.name.toLowerCase()));
  const matchedB = new Set((resultB.matched_skills || []).map((s) => s.name.toLowerCase()));
  const missingA = new Set((resultA.missing_skills || []).map((s) => s.name.toLowerCase()));
  const missingB = new Set((resultB.missing_skills || []).map((s) => s.name.toLowerCase()));

  // Skills that improved: were missing in A but matched in B
  const improved = [...missingA].filter((s) => matchedB.has(s));
  // Skills that regressed: were matched in A but missing in B
  const regressed = [...matchedA].filter((s) => missingB.has(s));
  // Consistently matched
  const consistent = [...matchedA].filter((s) => matchedB.has(s));

  if (improved.length === 0 && regressed.length === 0 && consistent.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
        No overlapping skills to compare.
      </p>
    );
  }

  return (
    <div className="space-y-3" data-testid="skills-diff">
      {improved.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-success-700 dark:text-success-400 mb-1.5 flex items-center gap-1">
            <ArrowUp className="h-3 w-3" /> Improved ({improved.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {improved.map((skill) => (
              <Badge key={skill} variant="success" className="text-xs capitalize">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {regressed.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-danger-700 dark:text-danger-400 mb-1.5 flex items-center gap-1">
            <ArrowDown className="h-3 w-3" /> Regressed ({regressed.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {regressed.map((skill) => (
              <Badge key={skill} variant="danger" className="text-xs capitalize">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {consistent.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center gap-1">
            <Minus className="h-3 w-3" /> Consistent ({consistent.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {consistent.slice(0, 10).map((skill) => (
              <Badge key={skill} variant="default" className="text-xs capitalize">
                {skill}
              </Badge>
            ))}
            {consistent.length > 10 && (
              <Badge variant="default" className="text-xs">
                +{consistent.length - 10} more
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ComparisonView({ analysisIds, onClose, className }: ComparisonViewProps) {
  const [results, setResults] = useState<[AnalysisResult | null, AnalysisResult | null]>([null, null]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBoth() {
      setLoading(true);
      setError("");
      try {
        const [a, b] = await Promise.all([
          getAnalysisResult(analysisIds[0]),
          getAnalysisResult(analysisIds[1]),
        ]);
        setResults([a, b]);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }
    loadBoth();
  }, [analysisIds]);

  if (loading) {
    return (
      <Card className={cn("animate-pulse py-12 text-center", className)} data-testid="comparison-loading">
        <div className="mx-auto h-8 w-8 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        <p className="mt-3 text-sm text-gray-500">Loading comparison...</p>
      </Card>
    );
  }

  if (error || !results[0] || !results[1]) {
    return (
      <Card className={cn("py-8 text-center", className)}>
        <p className="text-sm text-danger-600">{error || "Failed to load analyses."}</p>
        <Button variant="outline" size="sm" onClick={onClose} className="mt-3">
          Close
        </Button>
      </Card>
    );
  }

  const [resultA, resultB] = results;

  return (
    <div className={cn("space-y-4 animate-fade-in", className)} data-testid="comparison-view">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Target className="h-5 w-5 text-primary-500" />
          Side-by-Side Comparison
        </h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4 mr-1" /> Close
        </Button>
      </div>

      {/* Score comparison */}
      <Card>
        <div className="flex">
          <ScoreColumn label="Analysis A" result={resultA} position="left" />
          <ScoreColumn label="Analysis B" result={resultB} position="right" />
        </div>
      </Card>

      {/* Deltas */}
      <Card padding="sm">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 text-center mb-3 uppercase tracking-wider">
          Score Changes (A → B)
        </p>
        <div className="grid grid-cols-3 gap-3">
          <DeltaDisplay label="Match Score" valueA={resultA.match_score} valueB={resultB.match_score} />
          <DeltaDisplay label="ATS Score" valueA={resultA.ats_score} valueB={resultB.ats_score} />
          <DeltaDisplay
            label="Format Score"
            valueA={resultA.ats_check?.format_score ?? null}
            valueB={resultB.ats_check?.format_score ?? null}
          />
        </div>
      </Card>

      {/* Skills diff */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
          <Shield className="h-4 w-4 text-accent-500" />
          Skill Changes
        </h3>
        <SkillsDiff resultA={resultA} resultB={resultB} />
      </Card>
    </div>
  );
}
