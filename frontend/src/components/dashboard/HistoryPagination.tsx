"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryPaginationProps {
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (count: number) => void;
  className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export default function HistoryPagination({
  currentPage,
  totalPages,
  itemsPerPage,
  totalItems,
  onPageChange,
  onItemsPerPageChange,
  className,
}: HistoryPaginationProps) {
  if (totalItems <= 10) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  // Generate page numbers to show
  const getPageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "ellipsis")[] = [1];

    if (currentPage > 3) pages.push("ellipsis");

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push("ellipsis");

    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  return (
    <div
      className={cn("flex flex-col items-center justify-between gap-3 sm:flex-row", className)}
      data-testid="history-pagination"
    >
      {/* Left: showing X-Y of Z */}
      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span>
          Showing {startItem}–{endItem} of {totalItems}
        </span>
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className={cn(
            "rounded-md border border-gray-200 dark:border-surface-700",
            "bg-white dark:bg-surface-800 px-2 py-1",
            "text-xs text-gray-600 dark:text-gray-400",
            "focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500",
            "cursor-pointer"
          )}
          data-testid="items-per-page"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={cn(
            "rounded-lg p-1.5 text-sm transition-colors",
            currentPage <= 1
              ? "text-gray-300 dark:text-surface-600 cursor-not-allowed"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700"
          )}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {getPageNumbers().map((page, idx) =>
          page === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-xs text-gray-400 dark:text-gray-500">
              ...
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={cn(
                "min-w-[28px] rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                page === currentPage
                  ? "bg-primary-500 text-white"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700"
              )}
              data-testid={`page-${page}`}
            >
              {page}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={cn(
            "rounded-lg p-1.5 text-sm transition-colors",
            currentPage >= totalPages
              ? "text-gray-300 dark:text-surface-600 cursor-not-allowed"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700"
          )}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
