"use client";

/**
 * RateLimitBanner — page-level banner displayed when the user is rate-limited.
 *
 * Subscribes to the "api:rate-limit" CustomEvent via the useRateLimit hook and
 * renders a dismissible warning banner with a live countdown.
 *
 * Usage:
 *   // Mount once near the top of a page or layout:
 *   <RateLimitBanner />
 *
 * The banner auto-dismisses when the countdown expires.
 */

import { useRateLimit } from "@/hooks/useRateLimit";
import { cn } from "@/lib/utils";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

interface RateLimitBannerProps {
  className?: string;
}

export default function RateLimitBanner({ className }: RateLimitBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const { isLimited, secondsRemaining } = useRateLimit(() => {
    // Re-show the banner whenever a new rate limit event arrives
    setDismissed(false);
  });

  if (!isLimited || dismissed) return null;

  const mins = Math.floor(secondsRemaining / 60);
  const secs = secondsRemaining % 60;
  const timeLabel =
    mins > 0 ? `${mins}m ${secs.toString().padStart(2, "0")}s` : `${secondsRemaining}s`;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
        "bg-warning-50 dark:bg-warning-900/30",
        "border-warning-200 dark:border-warning-700",
        "text-warning-800 dark:text-warning-200",
        "animate-slide-up",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning-500 dark:text-warning-400" />
      <p className="flex-1">
        Too many requests. <span className="font-semibold">Try again in {timeLabel}.</span>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss rate limit warning"
        className="shrink-0 rounded-lg p-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10 text-warning-600 dark:text-warning-400"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
