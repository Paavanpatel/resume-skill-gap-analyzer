"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ShakeOnErrorProps {
  children: React.ReactNode;
  /** When true, triggers the shake animation */
  trigger: boolean;
  /** Duration of shake in ms */
  duration?: number;
  className?: string;
}

/**
 * Wraps content and applies a horizontal shake animation when `trigger` transitions to true.
 * Used for form validation errors to draw attention to invalid fields.
 * Automatically resets after the animation completes.
 */
export default function ShakeOnError({
  children,
  trigger,
  duration = 500,
  className,
}: ShakeOnErrorProps) {
  const [isShaking, setIsShaking] = useState(false);

  useEffect(() => {
    if (trigger) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), duration);
      return () => clearTimeout(timer);
    }
  }, [trigger, duration]);

  return (
    <div
      className={cn(isShaking && "animate-shake", className)}
      data-testid="shake-on-error"
      data-shaking={isShaking}
    >
      {children}
    </div>
  );
}
