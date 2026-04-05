"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface WizardTransitionProps {
  /** Current step index — triggers animation on change */
  step: number;
  children: React.ReactNode;
  className?: string;
  /** Duration of the transition in ms */
  duration?: number;
}

/**
 * Animates wizard step content transitions with directional awareness.
 * Going forward slides content in from the right; going backward from the left.
 * Uses a brief opacity transition for smooth step changes.
 */
export default function WizardTransition({
  step,
  children,
  className,
  duration = 300,
}: WizardTransitionProps) {
  const prevStepRef = useRef(step);
  const [isVisible, setIsVisible] = useState(true);
  const [direction, setDirection] = useState<"left" | "right">("right");

  useEffect(() => {
    if (prevStepRef.current !== step) {
      const goingForward = step > prevStepRef.current;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirection(goingForward ? "right" : "left");
      prevStepRef.current = step;

      // Briefly hide to retrigger the entrance animation
      setIsVisible(false);
      const timer = setTimeout(() => setIsVisible(true), 30);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const getTransform = () => {
    if (isVisible) return "translateX(0)";
    return direction === "right" ? "translateX(20px)" : "translateX(-20px)";
  };

  return (
    <div
      className={cn("will-change-[opacity,transform]", className)}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: getTransform(),
        transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
      }}
      data-testid="wizard-transition"
    >
      {children}
    </div>
  );
}
