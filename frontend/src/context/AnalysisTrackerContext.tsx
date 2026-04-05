"use client";

/**
 * Global analysis tracking context.
 *
 * Keeps tracking analysis progress in the background so the user can
 * navigate freely while analyses process. The FloatingAnalysisTracker
 * component renders the persistent UI widget.
 *
 * Each tracked analysis goes through: queued -> processing -> completed | failed
 * Completed/failed entries auto-dismiss after a configurable delay.
 *
 * Transport priority:
 *   1. WebSocket (real-time push via Redis Pub/Sub) -- preferred
 *   2. HTTP polling (every 2.5s with exponential backoff) -- fallback
 *
 * The context automatically falls back to polling if WebSocket fails
 * (connection error, auth failure, or max reconnects exceeded).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { getAnalysisStatus, getErrorMessage, getStoredTokens } from "@/lib/api";
import type { AnalysisStatusResponse } from "@/types/analysis";
import type { WsConnectionStatus } from "@/hooks/useAnalysisWebSocket";

// ── Types ───────────────────────────────────────────────────

export type TransportMode = "websocket" | "polling";

export interface TrackedAnalysis {
  /** The job/analysis ID returned by submitAnalysis */
  jobId: string;
  /** Human-readable label (job title or fallback) */
  label: string;
  /** Current status snapshot */
  status: AnalysisStatusResponse | null;
  /** Timestamp when this analysis was added */
  startedAt: number;
  /** Whether the user has seen / dismissed the completion notification */
  dismissed: boolean;
  /** Error message if polling itself fails */
  pollError: string | null;
  /** How this analysis is being tracked */
  transport: TransportMode;
  /** WebSocket connection status (if using WS) */
  wsStatus: WsConnectionStatus;
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
  /** Number of currently active (in-progress) analyses */
  activeCount: number;
  /** Number of completed analyses not yet dismissed */
  completedCount: number;
}

const AnalysisTrackerContext = createContext<AnalysisTrackerContextType | null>(
  null
);

// ── Constants ───────────────────────────────────────────────

const BASE_POLL_MS = 2500;          // 2.5s -- normal polling cadence
const MAX_POLL_MS = 30_000;         // 30s -- ceiling for backoff
const BACKOFF_MULTIPLIER = 2;       // Double interval on each error
const AUTO_DISMISS_MS = 60_000;     // Auto-dismiss completed after 60s
const MAX_WS_RECONNECTS = 3;
const BASE_WS_RECONNECT_MS = 1000;

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

function getWsBaseUrl(): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host =
    process.env.NEXT_PUBLIC_WS_URL ||
    process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "") ||
    "localhost:8000";
  return `${protocol}//${host}`;
}

// ── Provider ────────────────────────────────────────────────

export function AnalysisTrackerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [analyses, setAnalyses] = useState<TrackedAnalysis[]>([]);

  // Per-analysis tracking state
  const trackingRef = useRef<
    Map<
      string,
      {
        // Polling state
        pollTimeoutId?: ReturnType<typeof setTimeout>;
        pollIntervalMs: number;
        // WebSocket state
        ws?: WebSocket;
        wsReconnectCount: number;
        wsReconnectTimeoutId?: ReturnType<typeof setTimeout>;
        // Transport
        transport: TransportMode;
      }
    >
  >(new Map());

  // ── Update a single tracked analysis ──
  const updateAnalysis = useCallback(
    (jobId: string, updates: Partial<TrackedAnalysis>) => {
      setAnalyses((prev) =>
        prev.map((a) => (a.jobId === jobId ? { ...a, ...updates } : a))
      );
    },
    []
  );

  // ── Stop tracking (cleanup timers + WS) ──
  const stopTracking = useCallback((jobId: string) => {
    const state = trackingRef.current.get(jobId);
    if (!state) return;

    if (state.pollTimeoutId) clearTimeout(state.pollTimeoutId);
    if (state.wsReconnectTimeoutId) clearTimeout(state.wsReconnectTimeoutId);
    if (state.ws) {
      state.ws.onopen = null;
      state.ws.onmessage = null;
      state.ws.onerror = null;
      state.ws.onclose = null;
      if (
        state.ws.readyState === WebSocket.OPEN ||
        state.ws.readyState === WebSocket.CONNECTING
      ) {
        state.ws.close(1000);
      }
    }
    trackingRef.current.delete(jobId);
  }, []);

  // ── HTTP polling for a single analysis ──
  const schedulePoll = useCallback(
    (jobId: string, delayMs: number) => {
      const state = trackingRef.current.get(jobId);
      if (!state) return;

      if (state.pollTimeoutId) clearTimeout(state.pollTimeoutId);

      state.pollTimeoutId = setTimeout(async () => {
        const currentState = trackingRef.current.get(jobId);
        if (!currentState) return;

        try {
          const s = await getAnalysisStatus(jobId);

          updateAnalysis(jobId, { status: s, pollError: null });

          if (s.status === "completed" || s.status === "failed") {
            stopTracking(jobId);
            return;
          }

          // Success: reset to base cadence
          currentState.pollIntervalMs = BASE_POLL_MS;
          // eslint-disable-next-line react-hooks/immutability
          schedulePoll(jobId, BASE_POLL_MS);
        } catch (err) {
          updateAnalysis(jobId, { pollError: getErrorMessage(err) });

          const rateLimitRetry = isRateLimitError(err);
          let nextInterval: number;

          if (rateLimitRetry !== null) {
            nextInterval = clamp(rateLimitRetry * 1000, BASE_POLL_MS, MAX_POLL_MS);
          } else {
            nextInterval = clamp(
              currentState.pollIntervalMs * BACKOFF_MULTIPLIER,
              BASE_POLL_MS,
              MAX_POLL_MS
            );
          }

          currentState.pollIntervalMs = nextInterval;
          schedulePoll(jobId, nextInterval);
        }
      }, delayMs);
    },
    [updateAnalysis, stopTracking]
  );

  // ── Start polling for an analysis ──
  const startPolling = useCallback(
    (jobId: string) => {
      const state = trackingRef.current.get(jobId);
      if (!state) return;

      state.transport = "polling";
      updateAnalysis(jobId, { transport: "polling", wsStatus: "disconnected" });
      schedulePoll(jobId, 0); // Immediate first poll
    },
    [schedulePoll, updateAnalysis]
  );

  // ── Connect WebSocket for an analysis ──
  const connectWs = useCallback(
    (jobId: string) => {
      const state = trackingRef.current.get(jobId);
      if (!state) return;

      const tokens = getStoredTokens();
      if (!tokens?.access) {
        // No token -- fall back to polling
        startPolling(jobId);
        return;
      }

      // Clean up existing WS
      if (state.ws) {
        state.ws.onopen = null;
        state.ws.onmessage = null;
        state.ws.onerror = null;
        state.ws.onclose = null;
        if (
          state.ws.readyState === WebSocket.OPEN ||
          state.ws.readyState === WebSocket.CONNECTING
        ) {
          state.ws.close(1000);
        }
      }

      updateAnalysis(jobId, { wsStatus: "connecting" });

      const url = `${getWsBaseUrl()}/ws/analysis/${jobId}?token=${encodeURIComponent(tokens.access)}`;

      try {
        const ws = new WebSocket(url);
        state.ws = ws;
        state.transport = "websocket";

        ws.onopen = () => {
          state.wsReconnectCount = 0;
          updateAnalysis(jobId, {
            transport: "websocket",
            wsStatus: "connected",
            pollError: null,
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            // Ignore heartbeat pings
            if (data.type === "ping") return;

            // Server error (Redis unavailable) -- fall back to polling
            if (data.status === "error") {
              stopTracking(jobId);
              // Re-create tracking state for polling
              trackingRef.current.set(jobId, {
                pollIntervalMs: BASE_POLL_MS,
                wsReconnectCount: 0,
                transport: "polling",
              });
              startPolling(jobId);
              return;
            }

            const statusUpdate: AnalysisStatusResponse = {
              job_id: jobId,
              status: data.status,
              progress: data.progress,
              current_step: data.current_step,
              error_message: data.error_message || null,
            };

            updateAnalysis(jobId, { status: statusUpdate, pollError: null });

            // Terminal state
            if (data.status === "completed" || data.status === "failed") {
              stopTracking(jobId);
            }
          } catch {
            // Malformed message
          }
        };

        ws.onerror = () => {
          updateAnalysis(jobId, { wsStatus: "error" });
        };

        ws.onclose = (event) => {
          state.ws = undefined;

          // Normal closure or terminal state
          if (event.code === 1000) {
            updateAnalysis(jobId, { wsStatus: "disconnected" });
            return;
          }

          // Auth failure -- fall back to polling immediately
          if (event.code >= 4001 && event.code <= 4003) {
            updateAnalysis(jobId, { wsStatus: "error" });
            startPolling(jobId);
            return;
          }

          // Abnormal closure -- try reconnecting
          if (state.wsReconnectCount < MAX_WS_RECONNECTS) {
            const delay =
              BASE_WS_RECONNECT_MS * Math.pow(2, state.wsReconnectCount);
            state.wsReconnectCount++;
            updateAnalysis(jobId, { wsStatus: "connecting" });

            state.wsReconnectTimeoutId = setTimeout(() => {
              if (trackingRef.current.has(jobId)) {
                // eslint-disable-next-line react-hooks/immutability
                connectWs(jobId);
              }
            }, delay);
          } else {
            // Max reconnects -- fall back to polling
            updateAnalysis(jobId, { wsStatus: "error" });
            startPolling(jobId);
          }
        };
      } catch {
        // WebSocket constructor failure
        startPolling(jobId);
      }
    },
    [updateAnalysis, startPolling, stopTracking]
  );

  // ── Track a new analysis ──
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
            transport: "websocket" as TransportMode,
            wsStatus: "connecting" as WsConnectionStatus,
          },
        ];
      });

      if (trackingRef.current.has(jobId)) return; // Already tracking

      trackingRef.current.set(jobId, {
        pollIntervalMs: BASE_POLL_MS,
        wsReconnectCount: 0,
        transport: "websocket",
      });

      // Try WebSocket first, falls back to polling on failure
      connectWs(jobId);
    },
    [connectWs]
  );

  // ── Dismiss a single analysis ──
  const dismiss = useCallback((jobId: string) => {
    setAnalyses((prev) =>
      prev.map((a) => (a.jobId === jobId ? { ...a, dismissed: true } : a))
    );
  }, []);

  // ── Dismiss all completed/failed ──
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

  // Cleanup all tracking on unmount
  useEffect(() => {
    const tracking = trackingRef.current;
    return () => {
      tracking.forEach((_, jobId) => stopTracking(jobId));
      tracking.clear();
    };
  }, [stopTracking]);

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
