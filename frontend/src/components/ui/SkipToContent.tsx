"use client";

import { cn } from "@/lib/utils";

interface SkipToContentProps {
  href?: string;
  label?: string;
  className?: string;
}

export default function SkipToContent({
  href = "#main-content",
  label = "Skip to main content",
  className,
}: SkipToContentProps) {
  return (
    <a
      href={href}
      data-testid="skip-to-content"
      className={cn(
        "sr-only focus:not-sr-only",
        "fixed left-4 top-4 z-[9999]",
        "rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-lg",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        "transition-transform -translate-y-full focus:translate-y-0",
        className
      )}
    >
      {label}
    </a>
  );
}
