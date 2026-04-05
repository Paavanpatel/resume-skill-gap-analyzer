"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
  /** Animation variant */
  variant?: "fade" | "slide-up" | "slide-right";
  /** Duration in ms */
  duration?: number;
}

/**
 * Wraps page content with a mount animation that replays on route change.
 * Uses pure CSS transitions — no framer-motion dependency needed.
 */
export default function PageTransition({
  children,
  className,
  variant = "fade",
  duration = 300,
}: PageTransitionProps) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(false);
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    // On route change, briefly hide then show to retrigger animation
    if (prevPathRef.current !== pathname) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(false);
      prevPathRef.current = pathname;
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      // Initial mount
      const timer = setTimeout(() => setIsVisible(true), 20);
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  const variantStyles = {
    fade: {
      from: "opacity-0",
      to: "opacity-100",
    },
    "slide-up": {
      from: "opacity-0 translate-y-4",
      to: "opacity-100 translate-y-0",
    },
    "slide-right": {
      from: "opacity-0 -translate-x-4",
      to: "opacity-100 translate-x-0",
    },
  };

  const { from, to } = variantStyles[variant];

  return (
    <div
      className={cn("transition-all ease-out", isVisible ? to : from, className)}
      style={{ transitionDuration: `${duration}ms` }}
      data-testid="page-transition"
    >
      {children}
    </div>
  );
}
