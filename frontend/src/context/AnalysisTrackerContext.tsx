"use client";

/**
 * Global analysis tracking context.
 *
 * Keeps polling analysis status in the background so the user can
 * navigate freely while analyses process. The FloatingAnalysisTracker
 * component renders the persistent UI widget.
 *
 * Each tracked analysis goes through: queued → processing → completed | failed
 * Completed/failed entries auto-dismiss after a configurable delay.
 *
 * Polling uses exponential backoff to avoid hammering the API when responses
 * are slow or when a 429 rate-limit response is received:
 *   - Base interval: 2.5s
 *   - On 429: back off to min(retryAfter, MAX_INTERVAL), then resume normal cadence
 *   - On other errors: double the interval up to MAX_INTERVAL, reset on success
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getAnalysisStatus, getErrorMessage } from "@/lib/api";
import type { AnalysisStatusResponse } from "@/types/analysis";

// ── Types ───────────────────────────────────────────────────

export interface TrackedAnalysis {
  /** The job/analysis ID returned by submitAnalysis */
  jobId: string;
  /** Human-readable label (job title or fallback) */
  label: string;
  /** Current status snapshot from the API */
  status: AnalysisStatusResponse | null;
  /** Timestamp when this analysis was added */
  startedAt: number;
  /** Whether the user has seen / dismissed the completion notification */
  dismissed: boolean;
  /** Error message if polling itself fails */
  pollError: string | null;
}

interface AnalysisTrackerContextType {
  /** All analyses being tracked (active + recently completed) */
  analyses: TrackedAnalysis[];
  /** Start tracking a new analysis */
  track: (jobId: string, label: string) => void;
  /** Dismiss a completed/failed analysis from the widget */
  dismiss: (jobId: string) => void;
  /** Dismiss all completed/failed analyses */
  dismissAll: () => void;
  /** Number of currently active (polling) analyses */
  activeCount: number;
  /** Number of completed analyses not yet dismissed */
  completedCount: number;
}

const AnalysisTrackerContext = createContext<AnalysisTrackerContextType | null>(
  null
);

// ── Constants ───────────────────────────────────────────────

const BASE_POLL_MS = 2500;          // 2.5s — normal polling cadence
const MAX_POLL_MS = 30_000;         // 30s — ceiling for backoff
const BACKOFF_MULTIPLIER = 2;       // Double interval on each error
const AUTO_DISMISS_MS = 60_000;     // Auto-dismiss completed after 60s

// ── Helpers ─────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function isRateLimitError(err: unknown): number | null {
  const status = (err as any)?.response?.status;
  if (status !== 429) return null;
  const header = (err as any)?.response?.headers?.["retry-after"];
  const body = (err as any)?.response?.data?.error?.details?.retry_after_seconds;
  return parseInt(String(header ?? body ?? "60"), 10) || 60;
}

// ── Provider ────────────────────────────────────────────────

export function AnalysisTrackerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [analyses, setAnalyses] = useState<TrackedAnalysis[]>([]);

  // Each entry: { timeoutId, currentIntervalMs }
  const pollStateRef = useRef<
    Map<string, { timeoutId: ReturnType<typeof setTimeout>; intervalMs: number }>
  >(new Map());

  // Schedule the next poll for a given jobId with the given delay
  const schedulePoll = useCallback((jobId: string, delayMs: number) => {
    const existing = pollStateRef.current.get(jobId);
    if (existing) clearTimeout(existing.timeoutId);

    const timeoutId = setTimeout(async () => {
      try {
        const s = await getAnalysisStatus(jobId);

        setAnalyses((prev) =>
          prev.map((a) =>
            a.jobId === jobId ? { ...a, status: s, pollError: null } : a
          )
        );

        if (s.status === "completed" || s.status === "failed") {
          // Terminal state — stop polling
          pollStateRef.current.delete(jobId);
          return;
        }

        // Success: reset interval to base cadence and schedule next poll
        const nextInterval = BASE_POLL_MS;
        pollStateRef.current.set(jobId, { timeoutId: 0 as any, intervalMs: nextInterval });
        schedulePoll(jobId, nextInterval);

      } catch (err) {
        setAnalyses((prev) =>
          prev.map((a) =>
            a.jobId === jobId ? { ...a, pollError: getErrorMessage(err) } : a
          )
        );

        const state = pollStateRef.current.get(jobId);
        if (!state) return; // Was stopped externally

        let nextInterval: number;
        const rateLimitRetry = isRateLimitError(err);

        if (rateLimitRetry !== null) {
          // 429: wait the full Retry-After duration (capped at MAX_POLL_MS)
          nextInterval = clamp(rateLimitRetry * 1000, BASE_POLL_MS, MAX_POLL_MS);
        } else {
          // Other error: exponential backoff up to MAX_POLL_MS
          nextInterval = clamp(
            state.intervalMs * BACKOFF_MULTIPLIER,
            BASE_POLL_MS,
            MAX_POLL_MS
          );
        }

        pollStateRef.current.set(jobId, { timeoutId: 0 as any, intervalMs: nextInterval });
        schedulePoll(jobId, nextInterval);
      }
    }, delayMs);

    // Store the real timeoutId (replaces the placeholder 0)
    const existing2 = pollStateRef.current.get(jobId);
    pollStateRef.current.set(jobId, {
      intervalMs: existing2?.intervalMs ?? delayMs,
      timeoutId,
    });
  }, []);

  // Start polling for a given analysis (immediate first poll)
  const startPolling = useCallback(
    (jobId: string) => {
      if (pollStateRef.current.has(jobId)) return; // Don't double-poll
      pollStateRef.current.set(jobId, { timeoutId: 0 as any, intervalMs: BASE_POLL_MS });
      schedulePoll(jobId, 0); // First poll immediately
    },
    [schedulePoll]
  );

  // Track a new analysis
  const track = useCallback(
    (jobId: string, label: string) => {
      setAnalyses((prev) => {
        if (prev.some((a) => a.jobId === jobId)) return prev;
        return [
          ...prev,
          {
            jobId,
            label,
            status: null,
            startedAt: Date.now(),
            dismissed: false,
            pollError: null,
          },
        ];
      });
      startPolling(jobId);
    },
    [startPolling]
  );

  // Dismiss a single analysis
  const dismiss = useCallback((jobId: string) => {
    setAnalyses((prev) =>
      prev.map((a) => (a.jobId === jobId ? { ...a, dismissed: true } : a))
    );
  }, []);

  // Dismiss all completed/failed
  const dismissAll = useCallback(() => {
    setAnalyses((prev) =>
      prev.map((a) => {
        const terminal =
          a.status?.status === "completed" || a.status?.status === "failed";
        return terminal ? { ...a, dismissed: true } : a;
      })
    );
  }, []);

  // Auto-dismiss completed analyses after timeout
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setAnalyses((prev) =>
        prev.map((a) => {
          if (a.dismissed) return a;
          const terminal =
            a.status?.status === "completed" || a.status?.status === "failed";
          if (!terminal) return a;
          if (now - a.startedAt > AUTO_DISMISS_MS) {
            return { ...a, dismissed: true };
          }
          return a;
        })
      );
    }, 10_000);
    return () => clearInterval(timer);
  }, []);

  // Clean up dismissed entries periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setAnalyses((prev) => prev.filter((a) => !a.dismissed));
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  // Cleanup all pending timeouts on unmount
  useEffect(() => {
    return () => {
      pollStateRef.current.forEach(({ timeoutId }) => clearTimeout(timeoutId));
      pollStateRef.current.clear();
    };
  }, []);

  const activeCount = analyses.filter(
    (a) =>
      !a.dismissed &&
      a.status?.status !== "completed" &&
      a.status?.status !== "failed"
  ).length;

  const completedCount = analyses.filter(
    (a) => !a.dismissed && a.status?.status === "completed"
  ).length;

  return (
    <AnalysisTrackerContext.Provider
      value={{ analyses, track, dismiss, dismissAll, activeCount, completedCount }}
    >
      {children}
    </AnalysisTrackerContext.Provider>
  );
}

export function useAnalysisTracker() {
  const ctx = useContext(AnalysisTrackerContext);
  if (!ctx) {
    throw new Error(
      "useAnalysisTracker must be used within AnalysisTrackerProvider"
    );
  }
  return ctx;
}
