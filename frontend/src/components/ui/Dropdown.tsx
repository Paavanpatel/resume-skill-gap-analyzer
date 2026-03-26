"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  cloneElement,
  isValidElement,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────

interface DropdownItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  onSelect: (id: string) => void;
  /** Alignment relative to trigger */
  align?: "left" | "right";
  className?: string;
}

// ── Component ────────────────────────────────────────────────

export default function Dropdown({
  trigger,
  items,
  onSelect,
  align = "right",
  className,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setFocusIndex(-1);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const selectableItems = items.filter((item) => !item.divider && !item.disabled);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault();
          setIsOpen(true);
          setFocusIndex(0);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusIndex((prev) => (prev + 1) % selectableItems.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusIndex(
            (prev) => (prev - 1 + selectableItems.length) % selectableItems.length
          );
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (focusIndex >= 0 && focusIndex < selectableItems.length) {
            onSelect(selectableItems[focusIndex].id);
            setIsOpen(false);
            setFocusIndex(-1);
          }
          break;
      }
    },
    [isOpen, focusIndex, selectableItems, onSelect]
  );

  // ── Trigger Enhancement (FIX) ───────────────────────────────
  const enhancedTrigger = isValidElement(trigger)
    ? cloneElement(trigger as React.ReactElement, {
        onClick: () => setIsOpen(!isOpen),
        onKeyDown: handleKeyDown,
        tabIndex: 0,
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
      })
    : trigger;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      {enhancedTrigger}

      {/* Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          role="menu"
          className={cn(
            "absolute z-50 mt-1.5 min-w-[180px] rounded-xl",
            "border border-gray-200 dark:border-surface-700",
            "bg-white dark:bg-surface-800 shadow-lg dark:shadow-dark-lg",
            "py-1 animate-scale-in origin-top",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return (
                <div
                  key={`divider-${idx}`}
                  className="my-1 h-px bg-gray-100 dark:bg-surface-700"
                />
              );
            }

            const selectableIndex = selectableItems.indexOf(item);
            const isFocused = selectableIndex === focusIndex;

            return (
              <button
                key={item.id}
                role="menuitem"
                disabled={item.disabled}
                tabIndex={-1}
                onClick={() => {
                  if (!item.disabled) {
                    onSelect(item.id);
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors",
                  item.disabled && "opacity-40 cursor-not-allowed",
                  item.danger
                    ? "text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700",
                  isFocused &&
                    (item.danger
                      ? "bg-danger-50 dark:bg-danger-900/20"
                      : "bg-gray-50 dark:bg-surface-700")
                )}
              >
                {item.icon && (
                  <span className="h-4 w-4 shrink-0">{item.icon}</span>
                )}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}