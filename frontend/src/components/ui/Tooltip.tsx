"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: ReactNode;
  /** Placement relative to trigger */
  position?: "top" | "bottom" | "left" | "right";
  /** Delay before showing (ms) */
  delay?: number;
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = "top",
  delay = 200,
  className,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const positionClasses: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-surface-700 border-l-transparent border-r-transparent border-b-transparent",
    bottom: "bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-surface-700 border-l-transparent border-r-transparent border-t-transparent",
    left: "left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-surface-700 border-t-transparent border-b-transparent border-r-transparent",
    right: "right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-surface-700 border-t-transparent border-b-transparent border-l-transparent",
  };

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}

      {visible && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 whitespace-nowrap",
            "rounded-lg bg-gray-900 dark:bg-surface-700 px-3 py-1.5",
            "text-xs font-medium text-white dark:text-gray-200",
            "shadow-lg pointer-events-none",
            "animate-fade-in",
            positionClasses[position],
            className
          )}
        >
          {content}
          {/* Arrow */}
          <span
            className={cn(
              "absolute border-[5px]",
              arrowClasses[position]
            )}
          />
        </div>
      )}
    </div>
  );
}
