"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { HealthStatus } from "@/hooks/useHealthCheck";

interface StatusIndicatorProps {
  status: HealthStatus;
  checks?: Record<string, string> | null;
  lastChecked?: Date | null;
  /** Size of the dot in pixels (default 10) */
  size?: number;
  className?: string;
}

const statusConfig: Record<
  HealthStatus,
  { dot: string; pulse: string; label: string; text: string }
> = {
  healthy: {
    dot: "bg-success-500",
    pulse: "bg-success-400",
    label: "Healthy",
    text: "text-success-700 dark:text-success-400",
  },
  degraded: {
    dot: "bg-warning-500",
    pulse: "bg-warning-400",
    label: "Degraded",
    text: "text-warning-700 dark:text-warning-400",
  },
  unhealthy: {
    dot: "bg-danger-500",
    pulse: "bg-danger-400",
    label: "Unhealthy",
    text: "text-danger-700 dark:text-danger-400",
  },
  unknown: {
    dot: "bg-gray-400",
    pulse: "bg-gray-300",
    label: "Unknown",
    text: "text-gray-500 dark:text-gray-400",
  },
};

function checkIcon(value: string): string {
  if (value === "ok") return "✓";
  if (value === "no_workers") return "—";
  return "✗";
}

function checkColor(value: string): string {
  if (value === "ok") return "text-success-600 dark:text-success-400";
  if (value === "no_workers") return "text-warning-600 dark:text-warning-400";
  return "text-danger-600 dark:text-danger-400";
}

/**
 * StatusIndicator — a pulsing colored dot that opens a popover showing
 * per-dependency health details when clicked/hovered.
 *
 * Used in the Navbar to give users a quick glance at backend health.
 */
export default function StatusIndicator({
  status,
  checks,
  lastChecked,
  size = 10,
  className,
}: StatusIndicatorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = statusConfig[status];

  const toggle = () => setOpen((o) => !o);

  // Close popover when clicking outside the component
  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [open]);

  return (
    <div
      ref={ref}
      className={cn("relative inline-flex", className)}
    >
      {/* Dot button */}
      <button
        onClick={toggle}
        aria-label={`System status: ${cfg.label}. Click for details.`}
        aria-expanded={open}
        className="relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-full"
        style={{ width: size + 8, height: size + 8 }}
      >
        {/* Pulse ring — only animate for healthy/degraded */}
        {status !== "unknown" && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping",
              cfg.pulse
            )}
          />
        )}
        {/* Solid dot */}
        <span
          className={cn("relative inline-flex rounded-full", cfg.dot)}
          style={{ width: size, height: size }}
        />
      </button>

      {/* Popover */}
      {open && (
        <div
          role="dialog"
          aria-label="Health check details"
          className={cn(
            "absolute right-0 top-full mt-2 z-50 w-64",
            "rounded-xl border border-gray-200 dark:border-surface-600",
            "bg-white dark:bg-surface-800 shadow-lg dark:shadow-dark-md",
            "p-4 text-sm"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              System Health
            </span>
            <span className={cn("font-medium capitalize text-xs", cfg.text)}>
              {cfg.label}
            </span>
          </div>

          {/* Dependency checks */}
          {checks ? (
            <ul className="space-y-1.5">
              {Object.entries(checks).map(([dep, value]) => (
                <li key={dep} className="flex items-center justify-between">
                  <span className="capitalize text-gray-600 dark:text-gray-400">
                    {dep}
                  </span>
                  <span className={cn("flex items-center gap-1.5 font-mono text-xs", checkColor(value))}>
                    <span className="font-bold">{checkIcon(value)}</span>
                    <span className="truncate max-w-[120px]">{value}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-xs">
              No check data available.
            </p>
          )}

          {/* Last checked */}
          {lastChecked && (
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-surface-700 pt-2">
              Last checked{" "}
              {lastChecked.toLocaleTimeString(undefined, {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
