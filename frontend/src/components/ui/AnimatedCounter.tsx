"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  /** Target value to count to */
  value: number;
  /** Duration of the animation in ms */
  duration?: number;
  /** Number of decimal places */
  decimals?: number;
  /** Suffix like "%" or "pts" */
  suffix?: string;
  /** Prefix like "$" or "#" */
  prefix?: string;
  className?: string;
  /** Only animate when element is visible in viewport */
  animateOnView?: boolean;
}

export default function AnimatedCounter({
  value,
  duration = 1200,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
  animateOnView = true,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(animateOnView ? 0 : value);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (hasAnimated && !animateOnView) return;

    const el = ref.current;
    if (!el) return;

    if (!animateOnView) {
      animate();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          animate();
          setHasAnimated(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
    return () => observer.disconnect();

    function animate() {
      const start = performance.now();
      const from = 0;
      const to = value;

      function tick(now: number) {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for spring-like feel
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (to - from) * eased;

        setDisplayValue(current);

        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          setDisplayValue(to);
        }
      }

      requestAnimationFrame(tick);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, animateOnView]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </span>
  );
}
