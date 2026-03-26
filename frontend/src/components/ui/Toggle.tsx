"use client";

import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
}

export default function Toggle({
  checked,
  onChange,
  label,
  description,
  size = "md",
  disabled = false,
  className,
}: ToggleProps) {
  const trackSize = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const thumbSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const thumbTranslate = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <label
      className={cn(
        "flex items-start gap-3 cursor-pointer select-none",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative shrink-0 rounded-full transition-colors duration-200 ease-spring",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
          trackSize,
          checked
            ? "bg-primary-600 dark:bg-primary-500"
            : "bg-gray-300 dark:bg-surface-700"
        )}
      >
        <span
          className={cn(
            "absolute top-1 left-1 rounded-full bg-white shadow-sm transition-transform duration-200 ease-spring",
            thumbSize,
            checked && thumbTranslate
          )}
        />
      </button>

      {(label || description) && (
        <div className="pt-0.5">
          {label && (
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {label}
            </span>
          )}
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
      )}
    </label>
  );
}
