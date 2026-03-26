"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { generateRoadmap, getRoadmap, getErrorMessage } from "@/lib/api";
import type { RoadmapResponse } from "@/types/analysis";

interface RoadmapSectionProps {
  analysisId: string;
}

export default function RoadmapSection({ analysisId }: RoadmapSectionProps) {
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasChecked, setHasChecked] = useState(false);

  async function handleGenerate() {
    setIsLoading(true);
    setError("");
    try {
      const data = await generateRoadmap(analysisId);
      setRoadmap(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
      setHasChecked(true);
    }
  }

  async function handleLoad() {
    setIsLoading(true);
    setError("");
    try {
      const data = await getRoadmap(analysisId);
      setRoadmap(data);
    } catch {
      // No roadmap exists yet -- that's fine
      setHasChecked(true);
      setIsLoading(false);
      return;
    }
    setHasChecked(true);
    setIsLoading(false);
  }

  // Auto-check for existing roadmap on first render
  if (!hasChecked && !isLoading) {
    handleLoad();
  }

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-8 gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
          <span className="text-sm text-gray-500">
            {roadmap ? "Loading roadmap..." : "Generating your learning path..."}
          </span>
        </div>
      </Card>
    );
  }

  if (!roadmap) {
    return (
      <Card>
        <div className="text-center py-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Learning Roadmap</h2>
          <p className="text-sm text-gray-500 mb-4">
            Generate a personalized learning plan to fill your skill gaps.
          </p>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          <Button onClick={handleGenerate} isLoading={isLoading}>
            Generate Roadmap
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Learning Roadmap
        </h2>
        <Badge variant="info">{roadmap.total_weeks} weeks</Badge>
      </div>

      <div className="space-y-4">
        {roadmap.phases.map((phase, i) => (
          <div key={i} className="relative pl-6 border-l-2 border-primary-200">
            <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-primary-500" />

            <div className="mb-1 flex items-center gap-2">
              <span className="text-sm font-bold text-primary-700">
                Weeks {phase.week_range}
              </span>
              <span className="text-sm font-semibold text-gray-900">{phase.focus}</span>
            </div>

            <ul className="mb-2 space-y-1">
              {phase.objectives.map((obj, j) => (
                <li key={j} className="text-sm text-gray-600 flex gap-2">
                  <span className="text-primary-400 shrink-0">-</span>
                  {obj}
                </li>
              ))}
            </ul>

            {phase.resources.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {phase.resources.map((res, j) => (
                  <span
                    key={j}
                    className="inline-flex rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                  >
                    {res}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
