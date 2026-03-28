"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Clock,
  XCircle,
  CheckCircle,
  Loader2,
  Inbox,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  adminGetAnalyses,
  adminRetryAnalysis,
  adminDeleteAnalysis,
  getErrorMessage,
} from "@/lib/api";
import type { AdminAnalysis, AdminAnalysisListResponse } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { cn } from "@/lib/utils";

const STATUSES = ["queued", "processing", "completed", "failed"] as const;

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return { variant: "success" as const, icon: CheckCircle };
    case "failed":
      return { variant: "danger" as const, icon: XCircle };
    case "processing":
      return { variant: "info" as const, icon: Loader2 };
    default:
      return { variant: "default" as const, icon: Clock };
  }
}

export default function AdminAnalysesPage() {
  usePageTitle("Admin — Analyses");
  const { addToast } = useToast();

  const [data, setData] = useState<AdminAnalysisListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<AdminAnalysis | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, page_size: 20 };
      if (statusFilter) params.status = statusFilter;
      const result = await adminGetAnalyses(params as any);
      setData(result);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchAnalyses();
  }, [fetchAnalyses]);

  const handleRetry = async (id: string) => {
    setRetrying(id);
    try {
      await adminRetryAnalysis(id);
      addToast({ type: "success", message: "Analysis re-queued." });
      fetchAnalyses();
    } catch (e) {
      addToast({ type: "error", message: getErrorMessage(e) });
    } finally {
      setRetrying(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await adminDeleteAnalysis(deleteTarget.id);
      addToast({ type: "success", message: "Analysis deleted." });
      setDeleteTarget(null);
      fetchAnalyses();
    } catch (e) {
      addToast({ type: "error", message: getErrorMessage(e) });
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analyses</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          View and manage all analysis jobs across the platform
        </p>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>

        {data && (
          <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">
            {data.total} total analyses
          </span>
        )}
      </Card>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 p-4 text-center">
          <p className="text-sm text-danger-700 dark:text-danger-300">{error}</p>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-surface-700 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Job</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Match</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">ATS</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Provider</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Tokens</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Date</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-surface-700/50">
                  {[...Array(9)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton variant="text" width="60px" height="14px" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.analyses.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <Inbox className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">No analyses found.</p>
                </td>
              </tr>
            ) : (
              data?.analyses.map((a) => {
                const { variant, icon: StatusIcon } = statusBadge(a.status);
                return (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 dark:border-surface-700/50 hover:bg-gray-50/50 dark:hover:bg-surface-800/50 transition-colors"
                  >
                    {/* Status */}
                    <td className="px-4 py-3">
                      <Badge variant={variant} className="text-xs capitalize inline-flex items-center gap-1">
                        <StatusIcon className={cn("h-3 w-3", a.status === "processing" && "animate-spin")} />
                        {a.status}
                      </Badge>
                    </td>

                    {/* Job */}
                    <td className="px-4 py-3">
                      <div className="min-w-0 max-w-[200px]">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {a.job_title || "Untitled"}
                        </p>
                        {a.job_company && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {a.job_company}
                          </p>
                        )}
                        {a.error_message && (
                          <p className="text-xs text-danger-500 truncate mt-0.5" title={a.error_message}>
                            {a.error_message}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* User */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs truncate max-w-[150px]">
                      {a.user_email}
                    </td>

                    {/* Match */}
                    <td className="px-4 py-3 text-right">
                      {a.match_score != null ? (
                        <span className={cn(
                          "font-semibold",
                          a.match_score >= 80 ? "text-success-600 dark:text-success-400" :
                          a.match_score >= 60 ? "text-primary-600 dark:text-primary-400" :
                          a.match_score >= 40 ? "text-warning-600 dark:text-warning-400" :
                          "text-danger-600 dark:text-danger-400"
                        )}>
                          {Math.round(a.match_score)}%
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>

                    {/* ATS */}
                    <td className="px-4 py-3 text-right">
                      {a.ats_score != null ? (
                        <span className="text-gray-700 dark:text-gray-300">
                          {Math.round(a.ats_score)}%
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>

                    {/* Provider */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
                      {a.ai_provider ? (
                        <span title={a.ai_model || undefined}>
                          {a.ai_provider}
                        </span>
                      ) : "—"}
                    </td>

                    {/* Tokens */}
                    <td className="px-4 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                      {a.ai_tokens_used != null ? a.ai_tokens_used.toLocaleString() : "—"}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {a.status === "failed" && (
                          <button
                            onClick={() => handleRetry(a.id)}
                            disabled={retrying === a.id}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors disabled:opacity-40"
                            title="Retry"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", retrying === a.id && "animate-spin")} />
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data?.total || 0)} of {data?.total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-surface-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-700 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 text-sm text-gray-700 dark:text-gray-300">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-surface-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-surface-700 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <Modal
          isOpen
          onClose={() => setDeleteTarget(null)}
          title="Delete Analysis"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            Are you sure you want to permanently delete this analysis?
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
            <strong>{deleteTarget.job_title || "Untitled"}</strong> — {deleteTarget.user_email}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
