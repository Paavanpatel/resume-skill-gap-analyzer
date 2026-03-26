import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: "sm" | "md" | "lg";
  /** Hover lift effect */
  hoverable?: boolean;
}

export default function Card({
  padding = "md",
  hoverable = false,
  className,
  children,
  ...props
}: CardProps) {
  const paddings = { sm: "p-4", md: "p-6", lg: "p-8" };
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 shadow-sm dark:shadow-dark-sm",
        paddings[padding],
        hoverable &&
          "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md dark:hover:shadow-dark-md",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
