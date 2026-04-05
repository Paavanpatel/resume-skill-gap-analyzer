"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  /** Compact icon-only button or full mode selector */
  variant?: "icon" | "full";
  className?: string;
}

export default function ThemeToggle({
  variant = "icon",
  className,
}: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div
        className={cn(
          "h-9 w-9 rounded-lg bg-gray-100 dark:bg-surface-700",
          className
        )}
      />
    );
  }

  if (variant === "full") {
    const options = [
      { value: "light", icon: Sun, label: "Light" },
      { value: "dark", icon: Moon, label: "Dark" },
      { value: "system", icon: Monitor, label: "System" },
    ];

    return (
      <div
        className={cn(
          "flex items-center gap-1 rounded-xl bg-gray-100 dark:bg-surface-700 p-1",
          className
        )}
      >
        {options.map((opt) => {
          const Icon = opt.icon;
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200",
                isActive
                  ? "bg-white dark:bg-surface-800 text-gray-900 dark:text-gray-100 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              )}
              aria-label={`Switch to ${opt.label} theme`}
            >
              <Icon className="h-3.5 w-3.5" />
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  // Icon variant — cycles through: light → dark → system
  const iconMap: Record<string, typeof Sun> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };
  const CurrentIcon = iconMap[theme || "system"] || Monitor;

  function cycleTheme() {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }

  return (
    <button
      onClick={cycleTheme}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
        "text-gray-500 dark:text-gray-400",
        "hover:bg-gray-100 dark:hover:bg-surface-700",
        "hover:text-gray-700 dark:hover:text-gray-200",
        className
      )}
      aria-label={`Current theme: ${theme}. Click to change.`}
    >
      <CurrentIcon className="h-[18px] w-[18px]" />
    </button>
  );
}
