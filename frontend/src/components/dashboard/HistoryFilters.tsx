"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortOption = "newest" | "oldest" | "highest" | "lowest";
export type StatusFilter = "all" | "completed" | "processing" | "queued" | "failed";

interface HistoryFiltersProps {
  onSearchChange: (query: string) => void;
  onSortChange: (sort: SortOption) => void;
  onStatusChange: (status: StatusFilter) => void;
  currentSort: SortOption;
  currentStatus: StatusFilter;
  resultCount: number;
  totalCount: number;
  className?: string;
}

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "highest", label: "Highest Score" },
  { value: "lowest", label: "Lowest Score" },
];

export default function HistoryFilters({
  onSearchChange,
  onSortChange,
  onStatusChange,
  currentSort,
  currentStatus,
  resultCount,
  totalCount,
  className,
}: HistoryFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearchChange(value);
      }, 300);
    },
    [onSearchChange]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const clearSearch = () => {
    setSearchQuery("");
    onSearchChange("");
  };

  const hasActiveFilters = currentStatus !== "all" || searchQuery.length > 0;

  return (
    <div className={cn("space-y-3", className)} data-testid="history-filters">
      {/* Search + Filters row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search job title or company..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            data-testid="history-search"
            className={cn(
              "w-full rounded-lg border border-gray-200 dark:border-surface-700",
              "bg-white dark:bg-surface-800 py-2 pl-9 pr-8",
              "text-sm text-gray-900 dark:text-white",
              "placeholder:text-gray-400 dark:placeholder:text-gray-500",
              "focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
              "transition-colors"
            )}
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-surface-700 dark:hover:text-gray-300"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-400" />
          <select
            value={currentStatus}
            onChange={(e) => onStatusChange(e.target.value as StatusFilter)}
            data-testid="history-status-filter"
            className={cn(
              "rounded-lg border border-gray-200 dark:border-surface-700",
              "bg-white dark:bg-surface-800 px-3 py-2",
              "text-sm text-gray-700 dark:text-gray-300",
              "focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
              "cursor-pointer transition-colors"
            )}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 shrink-0 text-gray-400" />
          <select
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            data-testid="history-sort"
            className={cn(
              "rounded-lg border border-gray-200 dark:border-surface-700",
              "bg-white dark:bg-surface-800 px-3 py-2",
              "text-sm text-gray-700 dark:text-gray-300",
              "focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
              "cursor-pointer transition-colors"
            )}
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count + active filter indicator */}
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span data-testid="history-result-count">
          {resultCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? "analysis" : "analyses"}`
            : `${resultCount} of ${totalCount} analyses`}
        </span>
        {hasActiveFilters && (
          <button
            onClick={() => {
              clearSearch();
              onStatusChange("all");
            }}
            className="text-primary-600 dark:text-primary-400 hover:underline"
            data-testid="clear-filters"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
