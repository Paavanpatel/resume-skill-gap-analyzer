"use client";

/**
 * Hook for real-time analysis progress via WebSocket.
 *
 * Connects to ws://backend/ws/analysis/{id}?token=xxx and receives
 * progress updates pushed from the Celery worker via Redis Pub/Sub.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (up to 3 attempts)
 * - Connection status tracking (connecting/connected/disconnected/error)
 * - Automatic fallback callback when max reconnects exceeded
 * - Cleans up on unmount or when analysis reaches terminal state
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { AnalysisStatusResponse } from "@/types/analysis";

// ── Types ──────────────────────────────────────────────────

export type WsConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export interface UseAnalysisWebSocketOptions {
  /** Analysis ID to subscribe to */
  analysisId: string;
  /** JWT access token for authentication */
  token: string | null;
  /** Whether to actually connect (set false to disable) */
  enabled?: boolean;
  /** Called when WS fails permanently -- component should start polling */
  onFallbackToPolling?: () => void;
  /** Called when a progress update is received */
  onProgress?: (status: AnalysisStatusResponse) => void;
  /** Called when analysis reaches terminal state */
  onComplete?: (status: AnalysisStatusResponse) => void;
}

export interface UseAnalysisWebSocketResult {
  /** Latest status from the WebSocket */
  status: AnalysisStatusResponse | null;
  /** Current WebSocket connection state */
  connectionStatus: WsConnectionStatus;
  /** Whether WebSocket is actively connected */
  isConnected: boolean;
}

// ── Constants ──────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY_MS = 1000;
const WS_BASE_URL =
  typeof window !== "undefined"
    ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
        process.env.NEXT_PUBLIC_WS_URL ||
        process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, "").replace(/\/api\/v1$/, "") ||
        "localhost:8000"
      }`
    : "";

// ── Hook ───────────────────────────────────────────────────

export function useAnalysisWebSocket({
  analysisId,
  token,
  enabled = true,
  onFallbackToPolling,
  onProgress,
  onComplete,
}: UseAnalysisWebSocketOptions): UseAnalysisWebSocketResult {
  const [status, setStatus] = useState<AnalysisStatusResponse | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<WsConnectionStatus>("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(true);

  // Stable callback refs to avoid reconnection on callback changes
  const onFallbackRef = useRef(onFallbackToPolling);
  onFallbackRef.current = onFallbackToPolling;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close(1000);
      }
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current || !token || !analysisId || !enabled) return;

    cleanup();
    setConnectionStatus("connecting");

    const url = `${WS_BASE_URL}/ws/analysis/${analysisId}?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        reconnectCountRef.current = 0;
        setConnectionStatus("connected");
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data);

          // Ignore heartbeat pings
          if (data.type === "ping") return;

          // Handle error messages (Redis unavailable, etc.)
          if (data.status === "error") {
            cleanup();
            setConnectionStatus("error");
            onFallbackRef.current?.();
            return;
          }

          const statusUpdate: AnalysisStatusResponse = {
            job_id: analysisId,
            status: data.status,
            progress: data.progress,
            current_step: data.current_step,
            error_message: data.error_message || null,
          };

          setStatus(statusUpdate);
          onProgressRef.current?.(statusUpdate);

          // Terminal state -- clean up
          if (data.status === "completed" || data.status === "failed") {
            onCompleteRef.current?.(statusUpdate);
            cleanup();
            setConnectionStatus("disconnected");
          }
        } catch {
          // Malformed message -- ignore
        }
      };

      ws.onerror = () => {
        if (!mountedRef.current) return;
        setConnectionStatus("error");
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        wsRef.current = null;

        // Normal closure or terminal state -- don't reconnect
        if (event.code === 1000) {
          setConnectionStatus("disconnected");
          return;
        }

        // Auth failure -- don't reconnect
        if (event.code >= 4001 && event.code <= 4003) {
          setConnectionStatus("error");
          onFallbackRef.current?.();
          return;
        }

        // Abnormal closure -- attempt reconnect
        if (reconnectCountRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectCountRef.current);
          reconnectCountRef.current++;
          setConnectionStatus("connecting");

          reconnectTimeoutRef.current = setTimeout(() => {
            // eslint-disable-next-line react-hooks/immutability
            if (mountedRef.current) connect();
          }, delay);
        } else {
          // Max reconnects exceeded -- fall back to polling
          setConnectionStatus("error");
          onFallbackRef.current?.();
        }
      };
    } catch {
      // WebSocket constructor failure (e.g., invalid URL)
      setConnectionStatus("error");
      onFallbackRef.current?.();
    }
  }, [analysisId, token, enabled, cleanup]);

  // Connect on mount / when deps change
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && token && analysisId) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, enabled, token, analysisId, cleanup]);

  return {
    status,
    connectionStatus,
    isConnected: connectionStatus === "connected",
  };
}
