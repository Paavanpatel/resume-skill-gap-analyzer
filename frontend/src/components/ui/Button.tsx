"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

const variants = {
  primary:
    "bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 dark:bg-primary-500 dark:hover:bg-primary-600 active:scale-[0.97]",
  secondary:
    "bg-gray-100 dark:bg-surface-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-surface-600 focus:ring-gray-400",
  outline:
    "border border-gray-300 dark:border-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 focus:ring-primary-500",
  ghost:
    "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 hover:text-gray-900 dark:hover:text-gray-200 focus:ring-gray-400",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 focus:ring-danger-500 dark:bg-danger-500 dark:hover:bg-danger-600 active:scale-[0.97]",
};

const sizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  isLoading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
        "transition-all duration-150 ease-spring",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-surface-800",
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
