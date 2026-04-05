"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  RefreshCw,
  Server,
  Database,
  Cpu,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ClipboardPaste,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useHealthCheck } from "@/hooks/useHealthCheck";
import {
  adminGetMetricsSummary,
  adminGetLogs,
  type MetricsSummary,
  type LogRecord,
} from "@/lib/api";
import Skeleton from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

// ── Helper components ────────────────────────────────────────

function CheckRow({ label, value }: { label: string; value: string }) {
  const isOk = value === "ok";
  const isDegraded = value === "no_workers";
  const Icon = isOk ? CheckCircle2 : isDegraded ? MinusCircle : XCircle;
  const color = isOk
    ? "text-success-600 dark:text-success-400"
    : isDegraded
      ? "text-warning-600 dark:text-warning-400"
      : "text-danger-600 dark:text-danger-400";

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-surface-700 last:border-0">
      <span className="capitalize text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
        {label === "database" && <Database className="h-3.5 w-3.5 text-gray-400" />}
        {label === "redis" && <Server className="h-3.5 w-3.5 text-gray-400" />}
        {label === "celery" && <Cpu className="h-3.5 w-3.5 text-gray-400" />}
        {label}
      </span>
      <span className={cn("flex items-center gap-1.5 text-sm font-medium", color)}>
        <Icon className="h-4 w-4" />
        {value}
      </span>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Activity;
}) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
          <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
        </div>
      </div>
    </div>
  );
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  DEBUG: "text-gray-400",
  INFO: "text-primary-600 dark:text-primary-400",
  WARNING: "text-warning-600 dark:text-warning-400",
  ERROR: "text-danger-600 dark:text-danger-400",
  CRITICAL: "text-danger-700 dark:text-danger-300 font-bold",
};

function LogRow({ record }: { record: LogRecord }) {
  const [expanded, setExpanded] = useState(false);
  const ts = new Date(record.ts * 1000).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div
      className={cn(
        "font-mono text-xs border-b border-gray-100 dark:border-surface-700 last:border-0",
        record.exc && "cursor-pointer"
      )}
    >
      <div
        className="flex items-start gap-2 py-1.5 px-2 hover:bg-gray-50 dark:hover:bg-surface-700/50 rounded"
        onClick={() => record.exc && setExpanded((e) => !e)}
      >
        <span className="shrink-0 text-gray-400 w-20">{ts}</span>
        <span className={cn("shrink-0 w-16", LOG_LEVEL_COLORS[record.level] ?? "text-gray-500")}>
          {record.level}
        </span>
        <span className="shrink-0 text-gray-400 truncate max-w-[160px]" title={record.logger}>
          {record.logger.replace(/^app\./, "")}
        </span>
        <span className="flex-1 text-gray-700 dark:text-gray-300 break-words min-w-0">
          {record.message}
        </span>
        {record.request_id && (
          <span className="shrink-0 text-gray-400 text-[10px]">
            {record.request_id.slice(0, 8)}
          </span>
        )}
        {record.exc && (
          <span className="shrink-0 text-gray-400">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </div>
      {expanded && record.exc && (
        <pre className="mx-2 mb-2 rounded bg-gray-100 dark:bg-surface-900 p-2 text-[10px] text-danger-700 dark:text-danger-400 overflow-x-auto whitespace-pre-wrap">
          {record.exc}
        </pre>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function SystemPage() {
  const { toast } = useToast();
  const { status, checks, lastChecked, isLoading: healthLoading } = useHealthCheck(15_000);

  const [metrics, setMetrics] = useState<MetricsSummary | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);

  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logLevel, setLogLevel] = useState("INFO");
  const [logPrefix, setLogPrefix] = useState("app");

  const logsEndRef = useRef<HTMLDivElement>(null);

  const loadMetrics = useCallback(async () => {
    try {
      const data = await adminGetMetricsSummary();
      setMetrics(data);
    } catch {
      // Non-critical — keep stale data
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await adminGetLogs({
        limit: 200,
        level: logLevel,
        logger_prefix: logPrefix || undefined,
      });
      setLogs(data.records.reverse()); // newest first
    } catch {
      toast("Failed to load logs", "error");
    } finally {
      setLogsLoading(false);
    }
  }, [logLevel, logPrefix, toast]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const statusDotClass =
    status === "healthy"
      ? "bg-success-500"
      : status === "degraded"
        ? "bg-warning-500"
        : status === "unhealthy"
          ? "bg-danger-500"
          : "bg-gray-400";

  const totalRequests = metrics?.http?.total_requests ?? 0;
  const totalAnalyses = metrics?.analyses?.total ?? 0;
  const totalLlmCalls = metrics?.llm?.total_calls ?? 0;
  const avgDuration = metrics?.http?.avg_duration_ms?.toFixed(1) ?? "—";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Health</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Observability dashboard — health probes, metrics, and recent logs.
          </p>
        </div>
        <button
          onClick={() => {
            loadMetrics();
            loadLogs();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-surface-600 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* ── Health checks ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Dependency Health
        </h2>
        <div className="rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
          {/* Overall banner */}
          <div className="flex items-center gap-3 mb-4">
            <span className={cn("relative inline-flex h-3 w-3 rounded-full", statusDotClass)}>
              {status !== "unknown" && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
                    statusDotClass
                  )}
                />
              )}
            </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">
              {status}
            </span>
            {lastChecked && (
              <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
                Polled every 15 s · last at{" "}
                {lastChecked.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            )}
          </div>

          {healthLoading && !checks ? (
            <div className="space-y-2">
              {["database", "redis", "celery"].map((k) => (
                <Skeleton key={k} variant="text" width="100%" height="36px" />
              ))}
            </div>
          ) : checks ? (
            <div>
              {Object.entries(checks).map(([dep, val]) => (
                <CheckRow key={dep} label={dep} value={val} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-500" />
              Unable to reach health endpoint.
            </p>
          )}
        </div>
      </section>

      {/* ── Metrics cards ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Runtime Metrics
        </h2>
        {metricsLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="card" height="88px" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MetricCard
              label="HTTP Requests"
              value={totalRequests.toLocaleString()}
              sub="since last restart"
              icon={Activity}
            />
            <MetricCard
              label="Avg Latency"
              value={`${avgDuration} ms`}
              sub="across all routes"
              icon={Layers}
            />
            <MetricCard
              label="Analyses Run"
              value={totalAnalyses.toLocaleString()}
              sub={
                metrics?.analyses?.by_status
                  ? `${metrics.analyses.by_status["completed"] ?? 0} completed`
                  : undefined
              }
              icon={ClipboardPaste}
            />
            <MetricCard
              label="LLM Calls"
              value={totalLlmCalls.toLocaleString()}
              sub={
                metrics?.llm?.by_provider
                  ? Object.entries(metrics.llm.by_provider)
                      .map(([p, n]) => `${p}: ${n}`)
                      .join(" · ")
                  : undefined
              }
              icon={Cpu}
            />
          </div>
        )}

        {/* Status breakdown */}
        {metrics?.http?.by_status_class && (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              HTTP Responses by Class
            </p>
            <div className="flex flex-wrap gap-4">
              {Object.entries(metrics.http.by_status_class).map(([cls, n]) => (
                <div key={cls} className="text-sm">
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      cls.startsWith("2")
                        ? "text-success-600 dark:text-success-400"
                        : cls.startsWith("4")
                          ? "text-warning-600 dark:text-warning-400"
                          : cls.startsWith("5")
                            ? "text-danger-600 dark:text-danger-400"
                            : "text-gray-600 dark:text-gray-400"
                    )}
                  >
                    {cls}
                  </span>{" "}
                  <span className="text-gray-600 dark:text-gray-400">{n.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Log viewer ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Recent Logs
          </h2>
          <div className="flex items-center gap-2">
            {/* Level filter */}
            <select
              value={logLevel}
              onChange={(e) => setLogLevel(e.target.value)}
              className="rounded-lg border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map((l) => (
                <option key={l} value={l}>
                  {l}+
                </option>
              ))}
            </select>

            {/* Logger prefix filter */}
            <input
              type="text"
              value={logPrefix}
              onChange={(e) => setLogPrefix(e.target.value)}
              placeholder="logger prefix"
              className="rounded-lg border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 placeholder-gray-400 w-28 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />

            <button
              onClick={loadLogs}
              className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-surface-600 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Reload
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
          {logsLoading ? (
            <div className="p-4 space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} variant="text" width="100%" height="20px" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <ClipboardPaste className="h-8 w-8" />
              <p className="text-sm">No log entries match the current filters.</p>
            </div>
          ) : (
            <div className="max-h-[420px] overflow-y-auto p-2">
              {logs.map((r, i) => (
                <LogRow key={i} record={r} />
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
          <div className="border-t border-gray-100 dark:border-surface-700 px-3 py-2 text-[11px] text-gray-400">
            In-memory buffer · max 500 records · cleared on restart
          </div>
        </div>
      </section>
    </div>
  );
}
