"use client";

import { useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ClipboardPaste, AlertCircle } from "lucide-react";

interface JobDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
  className?: string;
}

export default function JobDescriptionInput({
  value,
  onChange,
  minLength = 50,
  className,
}: JobDescriptionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [justPasted, setJustPasted] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 160)}px`;
  }, [value]);

  // Show paste hint when field is empty and focused
  function handleFocus() {
    if (!value) setShowPasteHint(true);
  }

  function handleBlur() {
    setShowPasteHint(false);
  }

  function handlePaste() {
    setJustPasted(true);
    setShowPasteHint(false);
    setTimeout(() => setJustPasted(false), 2000);
  }

  const charCount = value.length;
  const isBelowMin = charCount > 0 && charCount < minLength;
  const meetsMin = charCount >= minLength;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label
          htmlFor="job-description"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Job description <span className="text-danger-500">*</span>
        </label>
        {justPasted && (
          <span className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400 animate-fade-in">
            <ClipboardPaste className="h-3 w-3" />
            Pasted!
          </span>
        )}
      </div>

      <div className="relative">
        <textarea
          ref={textareaRef}
          id="job-description"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onPaste={handlePaste}
          placeholder="Paste the full job description here..."
          required
          className={cn(
            "block w-full rounded-xl border px-4 py-3 text-sm resize-none",
            "bg-white dark:bg-surface-800",
            "text-gray-900 dark:text-gray-100",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
            isBelowMin
              ? "border-warning-300 dark:border-warning-700 focus:border-warning-500 focus:ring-warning-500"
              : "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500"
          )}
          style={{ minHeight: "160px" }}
        />

        {/* Paste hint overlay */}
        {showPasteHint && !value && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 rounded-lg bg-gray-100 dark:bg-surface-700 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 animate-fade-in">
              <ClipboardPaste className="h-4 w-4" />
              Tip: Paste the job posting directly
            </div>
          </div>
        )}
      </div>

      {/* Character count + validation */}
      <div className="flex items-center justify-between">
        <div>
          {isBelowMin && (
            <p className="flex items-center gap-1 text-xs text-warning-600 dark:text-warning-400">
              <AlertCircle className="h-3 w-3" />
              {minLength - charCount} more characters needed
            </p>
          )}
        </div>
        <p
          className={cn(
            "text-xs tabular-nums",
            meetsMin
              ? "text-success-600 dark:text-success-400"
              : isBelowMin
                ? "text-warning-600 dark:text-warning-400"
                : "text-gray-400 dark:text-gray-500"
          )}
        >
          {charCount}/{minLength} min
        </p>
      </div>
    </div>
  );
}
