"use client";

import { useState } from "react";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { generateAdvisorRewrites, getErrorMessage } from "@/lib/api";
import type { AdvisorResponse, SectionRewrite } from "@/types/analysis";

interface AdvisorSectionProps {
  analysisId: string;
}

export default function AdvisorSection({ analysisId }: AdvisorSectionProps) {
  const [result, setResult] = useState<AdvisorResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  async function handleGenerate() {
    setIsLoading(true);
    setError("");
    try {
      const data = await generateAdvisorRewrites(analysisId);
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  if (!result) {
    return (
      <Card>
        <div className="text-center py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Resume Advisor</h2>
          <p className="text-sm text-gray-500 mb-4">
            Get AI-powered section rewrites tailored to this job.
          </p>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <Button onClick={handleGenerate} isLoading={isLoading}>
            {isLoading ? "Generating rewrites..." : "Generate Rewrites"}
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Resume Advisor</h2>
        <p className="text-sm text-gray-500">{result.overall_summary}</p>
      </div>

      <div className="space-y-3">
        {result.rewrites.map((rewrite, i) => {
          const isExpanded = expandedIndex === i;
          const confidence = Math.round(rewrite.confidence * 100);

          return (
            <div
              key={i}
              className="rounded-lg border border-gray-200 transition-colors hover:border-gray-300"
            >
              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    {rewrite.section}
                  </span>
                  <Badge
                    variant={confidence >= 70 ? "success" : confidence >= 50 ? "warning" : "info"}
                    className="text-xs"
                  >
                    {confidence}% confidence
                  </Badge>
                  <span className="text-sm text-gray-600">
                    {rewrite.changes_made.length} changes
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-3 space-y-3">
                  {rewrite.original && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Original</p>
                      <p className="rounded bg-red-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                        {rewrite.original}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Rewritten</p>
                    <p className="rounded bg-green-50 px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {rewrite.rewritten}
                    </p>
                  </div>

                  {rewrite.changes_made.length > 0 && (
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                        Changes Made
                      </p>
                      <ul className="space-y-1">
                        {rewrite.changes_made.map((change, j) => (
                          <li key={j} className="flex gap-2 text-sm text-gray-600">
                            <span className="text-primary-400 shrink-0">-</span>
                            {change}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
