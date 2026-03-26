"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedListProps<T> {
  items: T[];
  /** Unique key extractor for each item */
  keyExtractor: (item: T) => string;
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Delay between each item's entrance animation */
  staggerDelay?: number;
  /** Animation duration for each item */
  duration?: number;
  /** Gap between items (Tailwind spacing class) */
  gap?: string;
  className?: string;
  /** IDs of items being removed (animated out before actual removal) */
  removingIds?: string[];
}

/**
 * Renders a list of items with staggered entrance animations.
 * Items slide up and fade in sequentially. Items marked for removal
 * slide out to the right before being removed.
 */
export default function AnimatedList<T>({
  items,
  keyExtractor,
  renderItem,
  staggerDelay = 50,
  duration = 400,
  gap = "space-y-2",
  className,
  removingIds = [],
}: AnimatedListProps<T>) {
  const [mountedKeys, setMountedKeys] = useState<Set<string>>(new Set());
  const prevKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const currentKeys = new Set(items.map(keyExtractor));
    // Find newly added items
    const newKeys = [...currentKeys].filter((k) => !prevKeysRef.current.has(k));

    if (newKeys.length > 0) {
      // Stagger the entrance of new items
      newKeys.forEach((key, i) => {
        setTimeout(() => {
          setMountedKeys((prev) => new Set(prev).add(key));
        }, i * staggerDelay);
      });
    }

    // Mark all existing items as mounted
    setMountedKeys((prev) => {
      const next = new Set(prev);
      currentKeys.forEach((k) => {
        if (!newKeys.includes(k)) next.add(k);
      });
      return next;
    });

    prevKeysRef.current = currentKeys;
  }, [items, keyExtractor, staggerDelay]);

  return (
    <div className={cn(gap, className)} data-testid="animated-list">
      {items.map((item, index) => {
        const key = keyExtractor(item);
        const isMounted = mountedKeys.has(key);
        const isRemoving = removingIds.includes(key);

        return (
          <div
            key={key}
            className={cn(
              "will-change-[opacity,transform]",
              isRemoving && "animate-slide-out-right"
            )}
            style={
              !isRemoving
                ? {
                    opacity: isMounted ? 1 : 0,
                    transform: isMounted ? "translateY(0)" : "translateY(16px)",
                    transition: `opacity ${duration}ms ease-out, transform ${duration}ms ease-out`,
                  }
                : undefined
            }
            data-testid={`animated-list-item-${key}`}
          >
            {renderItem(item, index)}
          </div>
        );
      })}
    </div>
  );
}
