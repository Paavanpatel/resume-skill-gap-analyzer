"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  History,
  FileSearch,
  GitCompareArrows,
  X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Skeleton, { ListItemSkeleton } from "@/components/ui/Skeleton";
import ScrollReveal from "@/components/ui/ScrollReveal";
import AnimatedList from "@/components/ui/AnimatedList";
import HistoryStatsBar from "@/components/dashboard/HistoryStatsBar";
import HistoryFilters, {
  type SortOption,
  type StatusFilter,
} from "@/components/dashboard/HistoryFilters";
import HistoryCard from "@/components/dashboard/HistoryCard";
import HistoryPagination from "@/components/dashboard/HistoryPagination";
import dynamic from "next/dynamic";

const ScoreTrendChart = dynamic(
  () => import("@/components/dashboard/ScoreTrendChart"),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-gray-100 dark:bg-surface-800" /> }
);
const ComparisonView = dynamic(
  () => import("@/components/dashboard/ComparisonView"),
  { ssr: false, loading: () => <div className="h-96 animate-pulse rounded-xl bg-gray-100 dark:bg-surface-800" /> }
);
import { getAnalysisHistory, deleteAnalysis, retryAnalysis, getErrorMessage } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useAnalysisTracker } from "@/context/AnalysisTrackerContext";
import type { AnalysisHistoryItem } from "@/types/analysis";

export default function HistoryPage() {
  usePageTitle("Analysis History");
  const router = useRouter();
  const { toast } = useToast();
  const { track } = useAnalysisTracker();

  // Data state
  const [items, setItems] = useState<AnalysisHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter/sort state
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);

  // Load data
  useEffect(() => {
    async function load() {
      try {
        const data = await getAnalysisHistory();
        setItems(data);
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  // Filter + sort logic
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }

    // Search filter (job title + company)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          (i.job_title && i.job_title.toLowerCase().includes(q)) ||
          (i.job_company && i.job_company.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sortOption) {
      case "newest":
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "highest":
        result.sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
        break;
      case "lowest":
        result.sort((a, b) => (a.match_score ?? 101) - (b.match_score ?? 101));
        break;
    }

    return result;
  }, [items, statusFilter, searchQuery, sortOption]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortOption, statusFilter, itemsPerPage]);

  // Comparison handlers
  const toggleCompareMode = useCallback(() => {
    setCompareMode((prev) => !prev);
    setSelectedIds([]);
    setShowComparison(false);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 2) {
        // Replace the oldest selection
        return [prev[1], id];
      }
      return [...prev, id];
    });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    // Optimistic update: remove from UI immediately
    setItems((prev) => prev.filter((i) => i.id !== id));
    setSelectedIds((prev) => prev.filter((x) => x !== id));
    try {
      await deleteAnalysis(id);
      toast("Analysis deleted.", "success");
    } catch (err) {
      // Rollback on failure by re-fetching
      toast(getErrorMessage(err), "error");
      const data = await getAnalysisHistory().catch(() => null);
      if (data) setItems(data);
    }
  }, [toast]);

  const handleRetry = useCallback(async (id: string) => {
    try {
      const result = await retryAnalysis(id);
      // Mark as queued in UI immediately
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "queued" } : i))
      );
      track(result.job_id, "Resume Analysis");
      toast("Analysis re-queued. We'll notify you when it's ready.", "info");
    } catch (err) {
      toast(getErrorMessage(err), "error");
    }
  }, [toast, track]);

  // Loading state with skeletons
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width="200px" height="28px" />
          <Skeleton variant="rect" width="120px" height="36px" />
        </div>
        {/* Stats bar skeleton */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
              <div className="flex items-center gap-3">
                <Skeleton variant="rect" width="40px" height="40px" />
                <div className="space-y-1.5">
                  <Skeleton variant="text" width="60px" height="12px" />
                  <Skeleton variant="text" width="40px" height="20px" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <ListItemSkeleton count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center">
        <p className="text-sm text-danger-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <History className="h-6 w-6" />
          Analysis History
        </h1>
        <div className="flex items-center gap-2">
          {items.length > 1 && (
            <Button
              variant={compareMode ? "primary" : "outline"}
              size="sm"
              onClick={toggleCompareMode}
              data-testid="compare-toggle"
            >
              {compareMode ? (
                <>
                  <X className="h-4 w-4" /> Exit Compare
                </>
              ) : (
                <>
                  <GitCompareArrows className="h-4 w-4" /> Compare
                </>
              )}
            </Button>
          )}
          <Button onClick={() => router.push("/dashboard")} size="sm">
            New Analysis
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <Card className="py-12 text-center">
          <FileSearch className="mx-auto h-12 w-12 text-gray-300 dark:text-surface-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-300">
            No analyses yet
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Upload a resume and paste a job description to get started.
          </p>
          <Button onClick={() => router.push("/dashboard")} className="mt-6">
            Start Your First Analysis
          </Button>
        </Card>
      ) : (
        <>
          {/* Stats bar */}
          <ScrollReveal direction="up" duration={400}>
            <HistoryStatsBar items={items} />
          </ScrollReveal>

          {/* Score trend chart */}
          <ScrollReveal direction="up" delay={100} duration={400}>
            <ScoreTrendChart items={items} />
          </ScrollReveal>

          {/* Comparison floating bar */}
          {compareMode && (
            <div
              className="sticky top-16 z-10 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 px-4 py-3 flex items-center justify-between animate-fade-in"
              data-testid="compare-bar"
            >
              <p className="text-sm text-primary-700 dark:text-primary-300">
                {selectedIds.length === 0 && "Select 2 analyses to compare"}
                {selectedIds.length === 1 && "Select 1 more analysis to compare"}
                {selectedIds.length === 2 && "Ready to compare!"}
              </p>
              <Button
                size="sm"
                disabled={selectedIds.length !== 2}
                onClick={() => setShowComparison(true)}
                data-testid="compare-button"
              >
                <GitCompareArrows className="h-4 w-4" /> Compare
              </Button>
            </div>
          )}

          {/* Comparison view */}
          {showComparison && selectedIds.length === 2 && (
            <ComparisonView
              analysisIds={selectedIds as [string, string]}
              onClose={() => {
                setShowComparison(false);
                setSelectedIds([]);
              }}
            />
          )}

          {/* Filters */}
          <HistoryFilters
            onSearchChange={setSearchQuery}
            onSortChange={setSortOption}
            onStatusChange={setStatusFilter}
            currentSort={sortOption}
            currentStatus={statusFilter}
            resultCount={filteredItems.length}
            totalCount={items.length}
          />

          {/* History cards */}
          {filteredItems.length === 0 ? (
            <Card className="py-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No analyses match your filters.
              </p>
            </Card>
          ) : (
            <AnimatedList
              items={paginatedItems}
              keyExtractor={(item) => item.id}
              staggerDelay={60}
              duration={350}
              renderItem={(item) => (
                <HistoryCard
                  item={item}
                  selectable={compareMode}
                  selected={selectedIds.includes(item.id)}
                  onSelect={handleSelect}
                  onDelete={handleDelete}
                  onRetry={handleRetry}
                />
              )}
            />
          )}

          {/* Pagination */}
          <HistoryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalItems={filteredItems.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        </>
      )}
    </div>
  );
}
