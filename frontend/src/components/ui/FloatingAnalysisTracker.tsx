"use client";

/**
 * Floating progress widget that shows active and recently completed analyses.
 *
 * Renders in the bottom-right corner of the screen, persists across page
 * navigation. Each tracked analysis shows its status, progress bar, and
 * a link to view the results when complete.
 *
 * Design:
 *  - Minimized: small pill showing active count + spinning indicator
 *  - Expanded: card with list of tracked analyses
 *  - Auto-collapses when all analyses are dismissed
 *  - Connection status dot per analysis (green=WS live, yellow=polling/connecting, red=error)
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useAnalysisTracker,
  type TrackedAnalysis,
} from "@/context/AnalysisTrackerContext";
import { cn } from "@/lib/utils";

export default function FloatingAnalysisTracker() {
  const { isAuthenticated } = useAuth();
  const { analyses, dismiss, dismissAll, activeCount, completedCount } =
    useAnalysisTracker();
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  // Only show non-dismissed analyses
  const visible = analyses.filter((a) => !a.dismissed);

  // Nothing to show, or not logged in
  if (!isAuthenticated || visible.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 font-sans">
      {/* Expanded panel */}
      {expanded && (
        <div className="mb-2 overflow-hidden rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-lg dark:shadow-dark-lg animate-scale-in">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-surface-700 px-4 py-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Analysis Progress
            </h3>
            {completedCount > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Clear completed
              </button>
            )}
          </div>

          {/* Analysis list */}
          <div className="max-h-72 overflow-y-auto">
            {visible.map((analysis) => (
              <AnalysisItem
                key={analysis.jobId}
                analysis={analysis}
                onDismiss={() => dismiss(analysis.jobId)}
                onView={() => {
                  router.push(`/analysis/${analysis.jobId}`);
                  setExpanded(false);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Collapsed pill / toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`ml-auto flex items-center gap-2 rounded-full px-4 py-2.5 shadow-lg transition-all hover:shadow-xl ${
          activeCount > 0
            ? "bg-primary-600 text-white hover:bg-primary-700"
            : completedCount > 0
              ? "bg-success-600 text-white hover:bg-success-700"
              : "bg-gray-700 dark:bg-surface-700 text-white hover:bg-gray-800 dark:hover:bg-surface-600"
        }`}
      >
        {activeCount > 0 ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {activeCount} {activeCount === 1 ? "analysis" : "analyses"} running
            </span>
          </>
        ) : completedCount > 0 ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm font-medium">
              {completedCount} ready to view
            </span>
          </>
        ) : (
          <>
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">Analysis tracker</span>
          </>
        )}
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronUp className="h-3.5 w-3.5" />
        )}
      </button>
    </div>
  );
}

// ── Connection status dot ────────────────────────────────────

function ConnectionDot({ analysis }: { analysis: TrackedAnalysis }) {
  const isActive =
    !analysis.status ||
    (analysis.status.status !== "completed" && analysis.status.status !== "failed");

  if (!isActive) return null;

  let dotColor: string;
  let title: string;

  if (analysis.transport === "websocket") {
    switch (analysis.wsStatus) {
      case "connected":
        dotColor = "bg-success-500";
        title = "Live connection";
        break;
      case "connecting":
        dotColor = "bg-warning-400 animate-pulse";
        title = "Connecting...";
        break;
      default:
        dotColor = "bg-danger-400";
        title = "Connection error - using fallback";
        break;
    }
  } else {
    dotColor = "bg-warning-400";
    title = "Using polling";
  }

  return (
    <span
      className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", dotColor)}
      title={title}
    />
  );
}

// ── Individual analysis item ──────────────────────────────────

function AnalysisItem({
  analysis,
  onDismiss,
  onView,
}: {
  analysis: TrackedAnalysis;
  onDismiss: () => void;
  onView: () => void;
}) {
  const s = analysis.status;
  const isActive =
    !s || (s.status !== "completed" && s.status !== "failed");
  const isCompleted = s?.status === "completed";
  const isFailed = s?.status === "failed";

  // Elapsed time
  // eslint-disable-next-line react-hooks/purity
  const elapsed = Math.round((Date.now() - analysis.startedAt) / 1000);
  const elapsedLabel =
    elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  // Progress percentage
  const progress = s?.progress ?? 0;

  return (
    <div className="border-b border-gray-50 dark:border-surface-700/50 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        {/* Status icon + label */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 shrink-0">
            {isActive && (
              <Loader2 className="h-4 w-4 animate-spin text-primary-500" />
            )}
            {isCompleted && (
              <CheckCircle2 className="h-4 w-4 text-success-500" />
            )}
            {isFailed && <XCircle className="h-4 w-4 text-danger-500" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {analysis.label}
              </p>
              <ConnectionDot analysis={analysis} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isActive && (
                <>
                  {s?.current_step || "Starting analysis..."}
                  {progress > 0 && (
                    <span className="ml-1 font-medium text-primary-500">
                      {Math.round(progress)}%
                    </span>
                  )}
                </>
              )}
              {isCompleted && `Completed in ${elapsedLabel}`}
              {isFailed &&
                (s?.error_message
                  ? s.error_message.slice(0, 60)
                  : "Analysis failed")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {isCompleted && (
            <button
              onClick={onView}
              className="rounded-md p-1 text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
              title="View results"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
          {(isCompleted || isFailed) && (
            <button
              onClick={onDismiss}
              className="rounded-md p-1 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Dismiss"
            >
              <XCircle className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (only for active analyses) */}
      {isActive && s && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ width: `${Math.max(progress, 5)}%` }}
          />
        </div>
      )}
    </div>
  );
}
