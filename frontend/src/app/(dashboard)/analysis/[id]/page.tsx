"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Loader2,
  ArrowLeft,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  FileSearch,
  FileText,
  Briefcase,
  Lightbulb,
  BarChart3,
  Target,
  BookOpen,
  MessageSquare,
  Sparkles,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getAnalysisResult, getAnalysisStatus, retryAnalysis, getErrorMessage } from "@/lib/api";
import type { AnalysisResult, AnalysisStatusResponse } from "@/types/analysis";
import { useAnalysisTracker, type TransportMode } from "@/context/AnalysisTrackerContext";
import type { WsConnectionStatus } from "@/hooks/useAnalysisWebSocket";
import { useToast } from "@/components/ui/Toast";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ScoreRing from "@/components/ui/ScoreRing";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import Tabs, { TabPanel } from "@/components/ui/Tabs";
import SkillsSection from "@/components/dashboard/SkillsSection";
import SuggestionsSection from "@/components/dashboard/SuggestionsSection";
import CategoryBreakdown from "@/components/dashboard/CategoryBreakdown";
import dynamic from "next/dynamic";

const RoadmapSection = dynamic(() => import("@/components/dashboard/RoadmapSection"), {
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-surface-800" />,
});
const AdvisorSection = dynamic(() => import("@/components/dashboard/AdvisorSection"), {
  loading: () => <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-surface-800" />,
});
import ExportButton from "@/components/dashboard/ExportButton";
import FeatureGate from "@/components/ui/FeatureGate";
import { cn } from "@/lib/utils";

// ── Processing stage definitions ────────────────────────────

const STAGES = [
  { key: "parsing", label: "Parsing Resume", icon: FileSearch },
  { key: "extracting", label: "Extracting Skills", icon: FileText },
  { key: "matching", label: "Matching with Job", icon: Briefcase },
  { key: "generating", label: "Generating Insights", icon: Lightbulb },
];

function getActiveStageIndex(step: string | null, progress: number): number {
  if (!step) return 0;
  const lower = step.toLowerCase();
  if (lower.includes("pars")) return 0;
  if (lower.includes("extract")) return 1;
  if (lower.includes("match") || lower.includes("scor")) return 2;
  if (lower.includes("generat") || lower.includes("suggest") || lower.includes("insight")) return 3;
  // Fallback: estimate from progress
  if (progress < 25) return 0;
  if (progress < 50) return 1;
  if (progress < 75) return 2;
  return 3;
}

const TIPS = [
  "Tip: Tailoring your resume to each job description can boost your match score by 20-40%.",
  "Did you know? 75% of resumes are filtered out by ATS before a human sees them.",
  "Tip: Use exact keywords from the job description — ATS systems match on specific terms.",
  "Tip: Quantify achievements with numbers (e.g., 'Increased revenue by 30%') to stand out.",
  "Did you know? The average recruiter spends only 6-7 seconds scanning a resume.",
  "Tip: A skills section near the top of your resume helps both ATS and human reviewers.",
];

// ── Tab definitions for results view ────────────────────────
// Pro-only tabs show a lock icon when the user is on the free tier.

function ProTabLabel({ label, icon }: { label: string; icon: React.ReactNode }) {
  const { user } = useAuth();
  const isPro = user?.tier === "pro" || user?.tier === "enterprise";
  return (
    <span className="flex items-center gap-1">
      {icon}
      {label}
      {!isPro && <Lock className="h-3 w-3 text-gray-400 dark:text-gray-600" />}
    </span>
  );
}

const RESULT_TABS = [
  { id: "overview", label: "Overview", icon: <BarChart3 className="h-4 w-4" /> },
  { id: "skills", label: "Skills", icon: <Target className="h-4 w-4" /> },
  { id: "suggestions", label: "Suggestions", icon: <Lightbulb className="h-4 w-4" /> },
  {
    id: "roadmap",
    label: "Roadmap",
    icon: <ProTabLabel label="Roadmap" icon={<BookOpen className="h-4 w-4" />} />,
  },
  {
    id: "advisor",
    label: "Advisor",
    icon: <ProTabLabel label="Advisor" icon={<MessageSquare className="h-4 w-4" />} />,
  },
];

export default function AnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const analysisId = params.id as string;

  // Check if this analysis is already being tracked globally
  const { analyses: trackedAnalyses, track } = useAnalysisTracker();
  const tracked = trackedAnalyses.find((a) => a.jobId === analysisId);

  // Connection info from tracker
  const transportMode: TransportMode = tracked?.transport ?? "polling";
  const wsConnectionStatus: WsConnectionStatus = tracked?.wsStatus ?? "disconnected";

  const { toast } = useToast();

  const [status, setStatus] = useState<AnalysisStatusResponse | null>(tracked?.status || null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [activeTab, setActiveTab] = useState("overview");
  const [scoreRevealed, setScoreRevealed] = useState(false);

  // Rotate tips every 5 seconds while processing
  useEffect(() => {
    if (result || error) return;
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [result, error]);

  // Trigger score reveal animation after results load
  useEffect(() => {
    if (result && !scoreRevealed) {
      const timer = setTimeout(() => setScoreRevealed(true), 100);
      return () => clearTimeout(timer);
    }
  }, [result, scoreRevealed]);

  // Sync status from tracker context (if tracked globally)
  useEffect(() => {
    if (tracked?.status) {
      setStatus(tracked.status);
    }
  }, [tracked?.status]);

  // Poll for status — only if NOT already tracked by the global tracker
  useEffect(() => {
    if (!analysisId) return;

    // If the global tracker is already polling this analysis, don't double-poll
    const isTrackedGlobally = trackedAnalyses.some((a) => a.jobId === analysisId && !a.dismissed);

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const s = await getAnalysisStatus(analysisId);
        if (cancelled) return;
        setStatus(s);

        if (s.status === "completed") {
          const r = await getAnalysisResult(analysisId);
          if (!cancelled) setResult(r);
        } else if (s.status === "failed") {
          setError(s.error_message || "Analysis failed.");
        } else {
          timeoutId = setTimeout(poll, 2500);
        }
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      }
    }

    if (isTrackedGlobally) {
      // Just watch the tracked status for completion
      if (tracked?.status?.status === "completed") {
        getAnalysisResult(analysisId)
          .then((r) => {
            if (!cancelled) setResult(r);
          })
          .catch((err) => {
            if (!cancelled) setError(getErrorMessage(err));
          });
      } else if (tracked?.status?.status === "failed") {
        setError(tracked.status.error_message || "Analysis failed.");
      }
      // Otherwise the tracker is polling — we sync via the useEffect above
    } else {
      // Not tracked globally — start our own polling and register with tracker
      track(analysisId, "Resume Analysis");
      poll();
    }

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisId, tracked?.status?.status]);

  // ── Processing state ────────────────────────────────────────

  if (!result && !error) {
    const progress = status?.progress ?? 0;
    const activeStage = getActiveStageIndex(status?.current_step ?? null, progress);

    return (
      <div className="mx-auto max-w-lg py-16">
        {/* Back link */}
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-8 flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </button>

        <Card className="px-8 py-10">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Analyzing Your Resume
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This usually takes 10-20 seconds. Feel free to navigate away — we&apos;ll track
              progress for you.
            </p>
            {/* Connection status indicator */}
            <ConnectionIndicator transport={transportMode} wsStatus={wsConnectionStatus} />
          </div>

          {/* Stage indicators */}
          <div className="mt-8 space-y-3">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const isCompleted = i < activeStage;
              const isActive = i === activeStage;

              return (
                <div
                  key={stage.key}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-500",
                    isActive
                      ? "bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700/50"
                      : isCompleted
                        ? "bg-success-50 dark:bg-success-900/20 border border-success-100 dark:border-success-700/50"
                        : "bg-gray-50 dark:bg-surface-700/30 border border-transparent"
                  )}
                >
                  <div className="shrink-0">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-success-500" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
                    ) : (
                      <Icon className="h-5 w-5 text-gray-300 dark:text-gray-600" />
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isActive
                        ? "text-primary-700 dark:text-primary-300"
                        : isCompleted
                          ? "text-success-700 dark:text-success-300"
                          : "text-gray-400 dark:text-gray-500"
                    )}
                  >
                    {stage.label}
                  </span>
                  {isCompleted && <span className="ml-auto text-xs text-success-500">Done</span>}
                </div>
              );
            })}
          </div>

          {/* Overall progress bar */}
          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1.5">
              <span>Overall Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-surface-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{ width: `${Math.max(progress, 3)}%` }}
              />
            </div>
          </div>

          {/* Rotating tip */}
          <div className="mt-6 rounded-lg bg-gray-50 dark:bg-surface-700/50 px-4 py-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400 transition-opacity duration-300">
              {TIPS[tipIndex]}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ── Retry handler ────────────────────────────────────────────

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await retryAnalysis(analysisId);
      // Reset to polling state
      setError("");
      setStatus(null);
      toast("Analysis re-queued. Polling for results…", "info");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    } finally {
      setIsRetrying(false);
    }
  }

  // ── Error state ─────────────────────────────────────────────

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <XCircle className="mx-auto h-12 w-12 text-danger-400" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Analysis Failed
        </h2>
        <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{error}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button onClick={handleRetry} isLoading={isRetrying} variant="primary">
            <RefreshCw className="h-4 w-4" />
            Retry Analysis
          </Button>
          <Button onClick={() => router.push("/dashboard")} variant="outline">
            New Analysis
          </Button>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Up to 3 retries allowed per analysis.
        </p>
      </div>
    );
  }

  // ── Results ─────────────────────────────────────────────────

  if (!result) return null;

  const explanation = result.score_explanation;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Analysis Results
            </h1>
            {result.processing_time_ms && (
              <p className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                <Clock className="h-3.5 w-3.5" />
                Completed in {(result.processing_time_ms / 1000).toFixed(1)}s
              </p>
            )}
          </div>
        </div>
        <ExportButtonGated analysisId={analysisId} />
      </div>

      {/* ── Animated Score Cards ── */}
      <div className="grid gap-4 sm:grid-cols-3" data-testid="score-cards">
        {[
          { score: result.match_score, label: "Skill Match", delay: 0 },
          { score: result.ats_score, label: "ATS Score", delay: 150 },
          { score: result.ats_check?.format_score ?? null, label: "Format Score", delay: 300 },
        ].map(({ score, label, delay }) => (
          <div
            key={label}
            className={cn(
              "transition-all duration-700 ease-out",
              scoreRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: `${delay}ms` }}
          >
            <Card
              className={cn(
                "flex flex-col items-center py-8 transition-shadow duration-500",
                scoreRevealed && score != null && score >= 80 && "shadow-glow-success",
                scoreRevealed && score != null && score >= 60 && score < 80 && "shadow-glow",
                scoreRevealed &&
                  score != null &&
                  score >= 40 &&
                  score < 60 &&
                  "shadow-glow-warning",
                scoreRevealed && score != null && score < 40 && "shadow-glow-danger"
              )}
              hoverable
            >
              <ScoreRing score={scoreRevealed ? score : 0} label={label} glow={scoreRevealed} />
              {scoreRevealed && score != null && (
                <div className="mt-2 animate-fade-in">
                  <AnimatedCounter
                    value={score}
                    suffix="%"
                    duration={1400}
                    className="text-sm font-semibold text-gray-600 dark:text-gray-400"
                  />
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>

      {/* ── Verdict Banner ── */}
      {explanation && (
        <div
          className={cn(
            "rounded-2xl border p-6 transition-all duration-700",
            scoreRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
            "border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800"
          )}
          style={{ transitionDelay: "500ms" }}
          data-testid="verdict-section"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 dark:bg-primary-900/30">
              <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Overall Verdict
              </h2>
              <VerdictBadge verdict={explanation.overall_verdict} />
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-success-700 dark:text-success-400">
                <CheckCircle2 className="h-4 w-4" /> Strengths
              </h3>
              <ul className="space-y-2">
                {explanation.strengths.map((s, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-lg bg-success-50 dark:bg-success-900/10 p-2.5 text-sm text-gray-700 dark:text-gray-300",
                      "transition-all duration-500",
                      scoreRevealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                    )}
                    style={{ transitionDelay: `${600 + i * 100}ms` }}
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500 mt-0.5" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-medium text-warning-700 dark:text-warning-400">
                <AlertTriangle className="h-4 w-4" /> Areas to Improve
              </h3>
              <ul className="space-y-2">
                {explanation.weaknesses.map((w, i) => (
                  <li
                    key={i}
                    className={cn(
                      "flex items-start gap-2 rounded-lg bg-warning-50 dark:bg-warning-900/10 p-2.5 text-sm text-gray-700 dark:text-gray-300",
                      "transition-all duration-500",
                      scoreRevealed ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"
                    )}
                    style={{ transitionDelay: `${600 + i * 100}ms` }}
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0 text-warning-500 mt-0.5" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabbed Content Sections ── */}
      <Tabs
        tabs={RESULT_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="underline"
        size="md"
        data-testid="results-tabs"
      >
        {/* Overview Tab */}
        <TabPanel id="overview" activeTab={activeTab}>
          <div className="space-y-6">
            {result.category_breakdowns.length > 0 && (
              <CategoryBreakdown breakdowns={result.category_breakdowns} />
            )}
          </div>
        </TabPanel>

        {/* Skills Tab */}
        <TabPanel id="skills" activeTab={activeTab}>
          <SkillsSection
            matchedSkills={result.matched_skills}
            missingSkills={result.missing_skills}
          />
        </TabPanel>

        {/* Suggestions Tab */}
        <TabPanel id="suggestions" activeTab={activeTab}>
          {result.suggestions.length > 0 ? (
            <SuggestionsSection suggestions={result.suggestions} />
          ) : (
            <EmptyTabState
              icon={<Lightbulb className="h-8 w-8 text-gray-300 dark:text-gray-600" />}
              title="No Suggestions"
              description="Your resume looks great! No specific suggestions were generated."
            />
          )}
        </TabPanel>

        {/* Roadmap Tab */}
        <TabPanel id="roadmap" activeTab={activeTab}>
          <FeatureGate requiredTier="pro" featureName="Learning Roadmap">
            <RoadmapSection analysisId={analysisId} />
          </FeatureGate>
        </TabPanel>

        {/* Advisor Tab */}
        <TabPanel id="advisor" activeTab={activeTab}>
          <FeatureGate requiredTier="pro" featureName="Resume Advisor">
            <AdvisorSection analysisId={analysisId} />
          </FeatureGate>
        </TabPanel>
      </Tabs>
    </div>
  );
}

// ── Helper Components ───────────────────────────────────────

/**
 * Export button that shows a locked state (links to /pricing) for free users.
 * Avoids the full-panel FeatureGate in the compact header area.
 */
function ExportButtonGated({ analysisId }: { analysisId: string }) {
  const { user } = useAuth();
  const isPro = user?.tier === "pro" || user?.tier === "enterprise";

  if (isPro) {
    return <ExportButton analysisId={analysisId} />;
  }

  return (
    <a
      href="/pricing"
      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-surface-700 px-3 py-1.5 text-sm font-medium text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
      title="Upgrade to Pro to export PDF"
    >
      <Lock className="h-4 w-4" />
      Export PDF
    </a>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const v = verdict.toLowerCase();
  let variant: "success" | "info" | "warning" | "danger" = "info";
  if (v.includes("strong") || v.includes("excellent")) variant = "success";
  else if (v.includes("moderate") || v.includes("good")) variant = "info";
  else if (v.includes("weak") || v.includes("needs")) variant = "warning";
  else if (v.includes("poor") || v.includes("low")) variant = "danger";

  return (
    <Badge variant={variant} className="text-sm px-3 py-1">
      {verdict}
    </Badge>
  );
}

function EmptyTabState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-surface-700/50">
        {icon}
      </div>
      <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 max-w-xs">{description}</p>
    </div>
  );
}

/**
 * Connection status indicator (green/yellow/red dot) shown during processing.
 */
function ConnectionIndicator({
  transport,
  wsStatus,
}: {
  transport: TransportMode;
  wsStatus: WsConnectionStatus;
}) {
  let color: string;
  let label: string;

  if (transport === "websocket") {
    switch (wsStatus) {
      case "connected":
        color = "bg-success-500";
        label = "Live";
        break;
      case "connecting":
        color = "bg-warning-400 animate-pulse";
        label = "Connecting";
        break;
      default:
        color = "bg-danger-400";
        label = "Reconnecting";
        break;
    }
  } else {
    color = "bg-warning-400";
    label = "Polling";
  }

  return (
    <div className="mt-2 flex items-center justify-center gap-1.5">
      <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  );
}
