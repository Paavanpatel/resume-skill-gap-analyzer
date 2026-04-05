"use client";

import { cn } from "@/lib/utils";

interface PressScaleProps {
  children: React.ReactNode;
  className?: string;
  /** Scale factor on press (default 0.97) */
  scale?: number;
  /** Whether the press effect is enabled */
  enabled?: boolean;
  /** Element type to render */
  as?: "div" | "button" | "span";
}

/**
 * Wraps content with an active press scale-down effect and hover lift.
 * Provides tactile feedback for interactive elements.
 */
export default function PressScale({
  children,
  className,
  scale = 0.97,
  enabled = true,
  as: Component = "div",
}: PressScaleProps) {
  if (!enabled) {
    return <Component className={className}>{children}</Component>;
  }

  return (
    <Component
      className={cn(
        "transition-transform duration-150 ease-spring",
        "hover:-translate-y-0.5",
        className
      )}
      style={
        {
          // Using CSS custom property so it works with Tailwind's active state
        }
      }
      data-testid="press-scale"
      onMouseDown={(e: React.MouseEvent) => {
        (e.currentTarget as HTMLElement).style.transform = `scale(${scale})`;
      }}
      onMouseUp={(e: React.MouseEvent) => {
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
      onMouseLeave={(e: React.MouseEvent) => {
        (e.currentTarget as HTMLElement).style.transform = "";
      }}
    >
      {children}
    </Component>
  );
}
