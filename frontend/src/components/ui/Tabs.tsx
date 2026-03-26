"use client";

import { useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (id: string) => void;
  children: ReactNode;
  className?: string;
  /** Visual style */
  variant?: "underline" | "pill";
  /** Size */
  size?: "sm" | "md";
}

interface TabPanelProps {
  id: string;
  activeTab: string;
  children: ReactNode;
  className?: string;
}

// ── Tabs Component ───────────────────────────────────────────

export default function Tabs({
  tabs,
  activeTab: controlledActive,
  onTabChange,
  children,
  className,
  variant = "underline",
  size = "md",
}: TabsProps) {
  const [internalActive, setInternalActive] = useState(tabs[0]?.id || "");
  const activeTab = controlledActive ?? internalActive;

  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [indicatorStyle, setIndicatorStyle] = useState<React.CSSProperties>({});

  // Update sliding indicator position
  const updateIndicator = useCallback(() => {
    const el = tabRefs.current.get(activeTab);
    if (!el) return;

    if (variant === "underline") {
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
      });
    } else {
      setIndicatorStyle({
        left: el.offsetLeft,
        width: el.offsetWidth,
        height: el.offsetHeight,
      });
    }
  }, [activeTab, variant]);

  useEffect(() => {
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [updateIndicator]);

  const handleTabClick = (id: string) => {
    setInternalActive(id);
    onTabChange?.(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent, currentIndex: number) => {
    let nextIndex = currentIndex;
    if (e.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (e.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else return;

    e.preventDefault();
    const nextTab = tabs[nextIndex];
    handleTabClick(nextTab.id);
    tabRefs.current.get(nextTab.id)?.focus();
  };

  return (
    <div className={className}>
      {/* Tab bar */}
      <div
        role="tablist"
        className={cn(
          "relative flex",
          variant === "underline"
            ? "border-b border-gray-200 dark:border-surface-700"
            : "rounded-xl bg-gray-100 dark:bg-surface-700 p-1"
        )}
      >
        {/* Sliding indicator */}
        <div
          className={cn(
            "absolute transition-all duration-250 ease-spring",
            variant === "underline"
              ? "bottom-0 h-0.5 bg-primary-600 dark:bg-primary-400 rounded-full"
              : "top-1 rounded-lg bg-white dark:bg-surface-800 shadow-sm"
          )}
          style={indicatorStyle}
        />

        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            role="tab"
            ref={(el) => {
              if (el) tabRefs.current.set(tab.id, el);
            }}
            aria-selected={activeTab === tab.id}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => handleTabClick(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={cn(
              "relative z-10 flex items-center gap-1.5 font-medium transition-colors whitespace-nowrap",
              size === "sm" ? "text-xs px-3 py-2" : "text-sm px-4 py-2.5",
              variant === "underline"
                ? cn(
                    "pb-3",
                    activeTab === tab.id
                      ? "text-primary-600 dark:text-primary-400"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  )
                : cn(
                    "rounded-lg",
                    activeTab === tab.id
                      ? "text-gray-900 dark:text-gray-100"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  )
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Panels */}
      <div className="mt-4">{children}</div>
    </div>
  );
}

// ── TabPanel ─────────────────────────────────────────────────

export function TabPanel({ id, activeTab, children, className }: TabPanelProps) {
  if (id !== activeTab) return null;

  return (
    <div
      id={`tabpanel-${id}`}
      role="tabpanel"
      aria-labelledby={`tab-${id}`}
      className={cn("animate-fade-in", className)}
    >
      {children}
    </div>
  );
}
