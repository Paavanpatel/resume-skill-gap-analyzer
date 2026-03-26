"use client";

import { useEffect, useRef, useState, Children, cloneElement, isValidElement } from "react";
import { cn } from "@/lib/utils";

interface StaggerChildrenProps {
  children: React.ReactNode;
  className?: string;
  /** Delay between each child's animation in ms */
  staggerDelay?: number;
  /** Base delay before first child animates in ms */
  baseDelay?: number;
  /** Animation duration for each child in ms */
  duration?: number;
  /** Whether to trigger on viewport intersection */
  onScroll?: boolean;
  /** IntersectionObserver threshold */
  threshold?: number;
}

/**
 * Staggers the entrance animation of its children with configurable delays.
 * Each child fades in and slides up in sequence, creating a cascading reveal effect.
 * Optionally triggers on scroll using IntersectionObserver.
 */
export default function StaggerChildren({
  children,
  className,
  staggerDelay = 50,
  baseDelay = 0,
  duration = 400,
  onScroll = false,
  threshold = 0.1,
}: StaggerChildrenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isTriggered, setIsTriggered] = useState(!onScroll);

  useEffect(() => {
    if (!onScroll) return;

    const el = containerRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      setIsTriggered(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsTriggered(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onScroll, threshold]);

  const childArray = Children.toArray(children);

  return (
    <div ref={containerRef} className={cn(className)} data-testid="stagger-children">
      {childArray.map((child, index) => {
        const delay = baseDelay + index * staggerDelay;

        return (
          <div
            key={index}
            className="will-change-[opacity,transform]"
            style={{
              opacity: isTriggered ? 1 : 0,
              transform: isTriggered ? "translateY(0)" : "translateY(12px)",
              transition: `opacity ${duration}ms ease-out ${delay}ms, transform ${duration}ms ease-out ${delay}ms`,
            }}
            data-testid={`stagger-child-${index}`}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
