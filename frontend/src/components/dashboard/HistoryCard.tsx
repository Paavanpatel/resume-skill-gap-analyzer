"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  MoreVertical,
  Eye,
  RefreshCw,
  Trash2,
  GitCompareArrows,
  Clock,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ScoreRing from "@/components/ui/ScoreRing";
import Dropdown from "@/components/ui/Dropdown";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { AnalysisHistoryItem } from "@/types/analysis";

interface HistoryCardProps {
  item: AnalysisHistoryItem;
  /** Comparison mode */
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onRetry?: (id: string) => void;
  className?: string;
}

function getScoreAccentColor(score: number | null): string {
  if (score == null) return "from-gray-300 to-gray-200 dark:from-surface-600 dark:to-surface-700";
  if (score >= 80) return "from-success-500 to-success-400";
  if (score >= 60) return "from-primary-500 to-primary-400";
  if (score >= 40) return "from-warning-500 to-warning-400";
  return "from-danger-500 to-danger-400";
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { variant: "success" | "warning" | "danger" | "info"; label: string }> = {
    completed: { variant: "success", label: "Completed" },
    processing: { variant: "info", label: "Processing" },
    queued: { variant: "info", label: "Queued" },
    failed: { variant: "danger", label: "Failed" },
  };
  const { variant, label } = config[status] ?? { variant: "info" as const, label: status };
  return (
    <Badge variant={variant} className="text-xs">
      {status === "processing" && (
        <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {label}
    </Badge>
  );
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryCard({
  item,
  selectable = false,
  selected = false,
  onSelect,
  onDelete,
  onRetry,
  className,
}: HistoryCardProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const accentColor = getScoreAccentColor(item.match_score);

  const dropdownItems = [
    { id: "view", label: "View Details", icon: <Eye className="h-4 w-4" /> },
    ...(item.status === "failed"
      ? [{ id: "retry", label: "Retry Analysis", icon: <RefreshCw className="h-4 w-4" /> }]
      : [{ id: "reanalyze", label: "Re-analyze", icon: <RefreshCw className="h-4 w-4" /> }]
    ),
    { id: "divider-1", label: "", divider: true },
    { id: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true },
  ];

  const handleDropdownSelect = (id: string) => {
    switch (id) {
      case "view":
        router.push(`/analysis/${item.id}`);
        break;
      case "retry":
        onRetry?.(item.id);
        break;
      case "reanalyze":
        router.push("/dashboard");
        break;
      case "delete":
        setShowDeleteModal(true);
        break;
    }
  };

  const handleCardClick = () => {
    if (selectable && onSelect) {
      onSelect(item.id);
    } else {
      router.push(`/analysis/${item.id}`);
    }
  };

  return (
    <>
      <div
        className={cn(
          "group relative overflow-hidden rounded-xl border transition-all duration-200",
          "bg-white dark:bg-surface-800",
          selected
            ? "border-primary-500 ring-2 ring-primary-500/20 shadow-md"
            : "border-gray-200 dark:border-surface-700 hover:shadow-md hover:-translate-y-0.5",
          className
        )}
        data-testid={`history-card-${item.id}`}
      >
        {/* Left gradient accent */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-1 bg-gradient-to-b",
            accentColor
          )}
          data-testid="score-accent"
        />

        <div className="flex items-center gap-4 p-4 pl-5">
          {/* Checkbox for comparison mode */}
          {selectable && (
            <label className="flex shrink-0 cursor-pointer items-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onSelect?.(item.id)}
                className={cn(
                  "h-4 w-4 rounded border-gray-300 dark:border-surface-600",
                  "text-primary-600 focus:ring-primary-500",
                  "cursor-pointer"
                )}
                data-testid={`compare-checkbox-${item.id}`}
                aria-label={`Select ${item.job_title || "Untitled"} for comparison`}
              />
            </label>
          )}

          {/* Score ring */}
          <button
            onClick={handleCardClick}
            className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-full"
            aria-label={`View analysis for ${item.job_title || "Untitled Position"}`}
          >
            <ScoreRing score={item.match_score} label="" size={56} strokeWidth={5} />
          </button>

          {/* Content */}
          <button onClick={handleCardClick} className="min-w-0 flex-1 text-left focus:outline-none">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold text-gray-900 dark:text-white">
                {item.job_title || "Untitled Position"}
              </span>
              <StatusBadge status={item.status} />
            </div>
            {item.job_company && (
              <p className="truncate text-sm text-gray-500 dark:text-gray-400">{item.job_company}</p>
            )}
            <div className="mt-1 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="h-3 w-3" />
              <span title={formatFullDate(item.created_at)}>
                {formatRelativeTime(item.created_at)}
              </span>
            </div>
          </button>

          {/* ATS score (desktop) */}
          {item.ats_score != null && (
            <div className="hidden shrink-0 text-center sm:block">
              <p className="text-xs text-gray-500 dark:text-gray-400">ATS</p>
              <p className="text-lg font-bold text-gray-800 dark:text-gray-200">
                {Math.round(item.ats_score)}%
              </p>
            </div>
          )}

          {/* Quick actions */}
          <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {selectable ? (
              <button
                onClick={() => router.push(`/analysis/${item.id}`)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-surface-700 dark:hover:text-gray-300 transition-colors"
                aria-label="View details"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <>
                <Dropdown
                  trigger={
                    <button
                      className="rounded-lg p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-surface-700 dark:hover:text-gray-300 transition-all"
                      aria-label="More actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  }
                  items={dropdownItems}
                  onSelect={handleDropdownSelect}
                  align="right"
                />
                <button
                  onClick={() => router.push(`/analysis/${item.id}`)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-surface-700 dark:hover:text-gray-300 transition-colors"
                  aria-label="View details"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Analysis"
        description="This action cannot be undone."
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Are you sure you want to delete the analysis for{" "}
          <strong className="text-gray-900 dark:text-white">{item.job_title || "Untitled Position"}</strong>?
        </p>
        <ModalFooter>
          <Button variant="outline" onClick={() => setShowDeleteModal(false)} size="sm">
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onDelete?.(item.id);
              setShowDeleteModal(false);
            }}
          >
            Delete
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

export { StatusBadge, formatRelativeTime };
