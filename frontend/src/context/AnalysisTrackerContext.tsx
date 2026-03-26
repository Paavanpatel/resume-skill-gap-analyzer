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

const POLL_INTERVAL_MS = 2500;
const AUTO_DISMISS_MS = 60_000; // auto-dismiss completed after 60s

// ── Provider ────────────────────────────────────────────────

export function AnalysisTrackerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [analyses, setAnalyses] = useState<TrackedAnalysis[]>([]);
  const intervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(
    new Map()
  );

  // Start polling for a given analysis
  const startPolling = useCallback((jobId: string) => {
    // Don't double-poll
    if (intervalsRef.current.has(jobId)) return;

    const poll = async () => {
      try {
        const s = await getAnalysisStatus(jobId);

        setAnalyses((prev) =>
          prev.map((a) =>
            a.jobId === jobId ? { ...a, status: s, pollError: null } : a
          )
        );

        // Stop polling when terminal
        if (s.status === "completed" || s.status === "failed") {
          const interval = intervalsRef.current.get(jobId);
          if (interval) {
            clearInterval(interval);
            intervalsRef.current.delete(jobId);
          }
        }
      } catch (err) {
        setAnalyses((prev) =>
          prev.map((a) =>
            a.jobId === jobId
              ? { ...a, pollError: getErrorMessage(err) }
              : a
          )
        );
      }
    };

    // Immediate first poll
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    intervalsRef.current.set(jobId, interval);
  }, []);

  // Track a new analysis
  const track = useCallback(
    (jobId: string, label: string) => {
      setAnalyses((prev) => {
        // Don't add duplicates
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
          // Check if enough time has passed since completion
          // (we don't track completion time separately, so use startedAt + processing)
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

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      intervalsRef.current.forEach((interval) => clearInterval(interval));
      intervalsRef.current.clear();
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
