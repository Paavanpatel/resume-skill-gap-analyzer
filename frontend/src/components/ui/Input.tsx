"use client";

import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 text-sm",
            "bg-white dark:bg-surface-800",
            "text-gray-900 dark:text-gray-100",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
            error
              ? "border-danger-300 dark:border-danger-700 focus:border-danger-500 focus:ring-danger-500"
              : "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500",
            className
          )}
          {...props}
        />
        {error && <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
export default Input;
