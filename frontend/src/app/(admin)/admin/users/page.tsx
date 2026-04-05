"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  UserX,
  UserCheck,
  XCircle,
  Check,
  X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { adminGetUsers, adminUpdateUser, adminDeactivateUser, getErrorMessage } from "@/lib/api";
import type { AdminUser, AdminUserListResponse } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const TIERS = ["free", "pro", "enterprise"] as const;
const ROLES = ["user", "admin", "super_admin"] as const;

function tierBadgeVariant(tier: string) {
  if (tier === "enterprise") return "warning" as const;
  if (tier === "pro") return "info" as const;
  return "default" as const;
}

function roleBadgeVariant(role: string) {
  if (role === "super_admin") return "danger" as const;
  if (role === "admin") return "warning" as const;
  return "default" as const;
}

export default function AdminUsersPage() {
  usePageTitle("Admin — Users");
  const { user: currentUser } = useAuth();
  const { toast } = useToast();

  const [data, setData] = useState<AdminUserListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [activeFilter, setActiveFilter] = useState<string>("");

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTier, setEditTier] = useState("");
  const [editRole, setEditRole] = useState("");
  const [saving, setSaving] = useState(false);

  // Deactivate modal
  const [deactivateUser, setDeactivateUser] = useState<AdminUser | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = { page, page_size: 20 };
      if (search) params.search = search;
      if (tierFilter) params.tier = tierFilter;
      if (roleFilter) params.role = roleFilter;
      if (activeFilter) params.is_active = activeFilter === "active";
      const result = await adminGetUsers(params as any);
      setData(result);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [page, search, tierFilter, roleFilter, activeFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const startEditing = (user: AdminUser) => {
    setEditingId(user.id);
    setEditTier(user.tier);
    setEditRole(user.role);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEditing = async (userId: string) => {
    setSaving(true);
    try {
      const updates: Record<string, string> = {};
      const user = data?.users.find((u) => u.id === userId);
      if (user && editTier !== user.tier) updates.tier = editTier;
      if (user && editRole !== user.role) updates.role = editRole;
      if (Object.keys(updates).length === 0) {
        setEditingId(null);
        return;
      }
      await adminUpdateUser(userId, updates);
      toast("User updated.", "success");
      setEditingId(null);
      fetchUsers();
    } catch (e) {
      toast(getErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateUser) return;
    try {
      await adminDeactivateUser(deactivateUser.id);
      toast(`${deactivateUser.email} deactivated.`, "success");
      setDeactivateUser(null);
      fetchUsers();
    } catch (e) {
      toast(getErrorMessage(e), "error");
    }
  };

  const totalPages = data ? Math.ceil(data.total / data.page_size) : 0;
  const isSuperAdmin = currentUser?.role === "super_admin";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage user accounts, tiers, and roles
        </p>
      </div>

      {/* Filters bar */}
      <Card className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by email or name..."
            className="w-full rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 py-1.5 pl-9 pr-3 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Tier filter */}
        <select
          value={tierFilter}
          onChange={(e) => {
            setTierFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All tiers</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>

        {/* Active filter */}
        <select
          value={activeFilter}
          onChange={(e) => {
            setActiveFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
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
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tier</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                Analyses
              </th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Joined</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-100 dark:border-surface-700/50">
                  {[...Array(7)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <Skeleton variant="text" width="80px" height="14px" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                  No users found.
                </td>
              </tr>
            ) : (
              data?.users.map((u) => {
                const isEditing = editingId === u.id;
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr
                    key={u.id}
                    className={cn(
                      "border-b border-gray-100 dark:border-surface-700/50 transition-colors",
                      isEditing && "bg-primary-50/50 dark:bg-primary-900/10",
                      !u.is_active && "opacity-60"
                    )}
                  >
                    {/* User */}
                    <td className="px-4 py-3">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {u.full_name || "—"}
                          {isSelf && <span className="ml-1 text-xs text-gray-400">(you)</span>}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {u.email}
                        </p>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {u.is_active ? (
                          <Badge variant="success" className="text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="danger" className="text-xs">
                            Inactive
                          </Badge>
                        )}
                        {u.is_verified && (
                          <Badge variant="info" className="text-xs">
                            Verified
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value)}
                          className="rounded border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {TIERS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={tierBadgeVariant(u.tier)} className="text-xs capitalize">
                          {u.tier}
                        </Badge>
                      )}
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3">
                      {isEditing && isSuperAdmin ? (
                        <select
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                          disabled={isSelf}
                          className="rounded border border-gray-200 dark:border-surface-600 bg-white dark:bg-surface-700 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge variant={roleBadgeVariant(u.role)} className="text-xs capitalize">
                          {u.role.replace("_", " ")}
                        </Badge>
                      )}
                    </td>

                    {/* Analyses */}
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {u.analyses_count}
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(u.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEditing(u.id)}
                              disabled={saving}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
                              title="Save"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
                              title="Cancel"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEditing(u)}
                              className="rounded-md px-2 py-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            >
                              Edit
                            </button>
                            {!isSelf && u.is_active && (
                              <button
                                onClick={() => setDeactivateUser(u)}
                                className="flex h-7 w-7 items-center justify-center rounded-md text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                                title="Deactivate"
                              >
                                <UserX className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
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
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, data?.total || 0)} of {data?.total}
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

      {/* Deactivate Confirmation Modal */}
      {deactivateUser && (
        <Modal isOpen onClose={() => setDeactivateUser(null)} title="Deactivate User">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Are you sure you want to deactivate <strong>{deactivateUser.email}</strong>? They will
            be unable to log in until reactivated.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setDeactivateUser(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleDeactivate}>
              Deactivate
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
