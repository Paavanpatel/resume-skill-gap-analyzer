"use client";

/**
 * useRateLimit — tracks the active rate-limit state from API responses.
 *
 * Listens for the "api:rate-limit" CustomEvent dispatched by the Axios
 * interceptor in lib/api.ts and maintains:
 * - isLimited: true while the Retry-After countdown is running
 * - secondsRemaining: live countdown (decrements every second)
 * - retryAfter: the original Retry-After value in seconds
 *
 * Usage:
 *   const { isLimited, secondsRemaining } = useRateLimit();
 *
 * The hook is safe to mount multiple times — each instance manages its
 * own countdown timer independently.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface RateLimitState {
  /** True while a Retry-After countdown is active */
  isLimited: boolean;
  /** Seconds remaining until the rate limit resets (0 when not limited) */
  secondsRemaining: number;
  /** The original Retry-After value from the most recent 429 response */
  retryAfter: number;
}

/**
 * Subscribe to rate-limit events from the API interceptor and expose a
 * live countdown that can be used to disable form controls and show
 * user-facing messaging.
 *
 * @param onLimited Optional callback fired when a new rate limit is detected.
 */
export function useRateLimit(
  onLimited?: (retryAfterSeconds: number) => void
): RateLimitState {
  const [state, setState] = useState<RateLimitState>({
    isLimited: false,
    secondsRemaining: 0,
    retryAfter: 0,
  });

  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(
    (seconds: number) => {
      // Clear any existing countdown
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current);
      }

      setState({ isLimited: true, secondsRemaining: seconds, retryAfter: seconds });
      onLimited?.(seconds);

      countdownRef.current = setInterval(() => {
        setState((prev) => {
          const next = prev.secondsRemaining - 1;
          if (next <= 0) {
            clearInterval(countdownRef.current!);
            countdownRef.current = null;
            return { isLimited: false, secondsRemaining: 0, retryAfter: prev.retryAfter };
          }
          return { ...prev, secondsRemaining: next };
        });
      }, 1000);
    },
    [onLimited]
  );

  useEffect(() => {
    function handleRateLimit(event: Event) {
      const { retryAfterSeconds } = (event as CustomEvent<{ retryAfterSeconds: number }>).detail;
      startCountdown(retryAfterSeconds);
    }

    window.addEventListener("api:rate-limit", handleRateLimit);
    return () => {
      window.removeEventListener("api:rate-limit", handleRateLimit);
      if (countdownRef.current !== null) {
        clearInterval(countdownRef.current);
      }
    };
  }, [startCountdown]);

  return state;
}
