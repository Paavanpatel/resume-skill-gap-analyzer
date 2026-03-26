"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Copy, Check } from "lucide-react";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
}

export default function CopyButton({
  text,
  label,
  className,
  size = "sm",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for insecure contexts
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg transition-all duration-200",
        "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
        "hover:bg-gray-100 dark:hover:bg-surface-700",
        size === "sm" ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        copied && "text-success-600 dark:text-success-400",
        className
      )}
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      {copied ? (
        <Check className={cn(iconSize, "animate-scale-in")} />
      ) : (
        <Copy className={iconSize} />
      )}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  );
}
