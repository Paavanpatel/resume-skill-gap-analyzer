"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getHealthReady, type HealthCheck } from "@/lib/api";

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

export interface HealthState {
  status: HealthStatus;
  checks: HealthCheck["checks"] | null;
  lastChecked: Date | null;
  isLoading: boolean;
}

/**
 * useHealthCheck — polls /api/v1/health/ready on a configurable interval.
 *
 * Returns the aggregated health status so components can render a status dot
 * or popover without each managing their own polling logic.
 *
 * - Polls immediately on mount, then every `intervalMs` (default 30 s).
 * - Marks status "unknown" on network failure (not "unhealthy" — the API
 *   itself might be reachable even if this particular request fails).
 * - Cleans up the interval on unmount.
 *
 * @param intervalMs - Poll interval in milliseconds. Pass 0 to disable polling.
 */
export function useHealthCheck(intervalMs = 30_000): HealthState {
  const [state, setState] = useState<HealthState>({
    status: "unknown",
    checks: null,
    lastChecked: null,
    isLoading: true,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const data = await getHealthReady();
      setState({
        status: data.status,
        checks: data.checks,
        lastChecked: new Date(),
        isLoading: false,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        status: "unknown",
        lastChecked: new Date(),
        isLoading: false,
      }));
    }
  }, []);

  useEffect(() => {
    // Immediate first check
    // eslint-disable-next-line react-hooks/set-state-in-effect
    poll();

    if (intervalMs > 0) {
      intervalRef.current = setInterval(poll, intervalMs);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll, intervalMs]);

  return state;
}
