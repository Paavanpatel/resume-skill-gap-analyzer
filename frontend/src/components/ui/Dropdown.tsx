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
import { createPortal } from "react-dom";
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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);

  // Calculate portal position from trigger's bounding rect
  const updateMenuPosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setMenuStyle(
      align === "right"
        ? {
            top: rect.bottom + window.scrollY + 6,
            left: rect.right + window.scrollX,
            transform: "translateX(-100%)",
          }
        : { top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX }
    );
  }, [align]);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateMenuPosition();
    window.addEventListener("scroll", updateMenuPosition, true);
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [isOpen, updateMenuPosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
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
          setFocusIndex((prev) => (prev - 1 + selectableItems.length) % selectableItems.length);
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

  const enhancedTrigger = isValidElement(trigger)
    ? cloneElement(trigger as React.ReactElement, {
        onClick: () => setIsOpen(!isOpen),
        onKeyDown: handleKeyDown,
        tabIndex: 0,
        "aria-haspopup": "menu",
        "aria-expanded": isOpen,
      })
    : trigger;

  const menu = isOpen ? (
    <div
      ref={menuRef}
      role="menu"
      data-align={align}
      style={{ ...menuStyle, position: "absolute" }}
      className={cn(
        "z-[9999] min-w-[180px] rounded-xl",
        "border border-gray-200 dark:border-surface-700",
        "bg-white dark:bg-surface-800 shadow-lg dark:shadow-dark-lg",
        "py-1 animate-scale-in origin-top"
      )}
    >
      {items.map((item, idx) => {
        if (item.divider) {
          return (
            <div key={`divider-${idx}`} className="my-1 h-px bg-gray-100 dark:bg-surface-700" />
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
            {item.icon && <span className="h-4 w-4 shrink-0">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {enhancedTrigger}
      {typeof window !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
