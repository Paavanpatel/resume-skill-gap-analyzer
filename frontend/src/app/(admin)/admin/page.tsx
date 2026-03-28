"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Users,
  FileText,
  CheckCircle,
  XCircle,
  TrendingUp,
  Target,
  ShieldCheck,
  Activity,
  HardDrive,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { adminGetAnalytics, adminGetStorageStats, getErrorMessage } from "@/lib/api";
import type { AnalyticsOverview, StorageStats } from "@/lib/api";
import { usePageTitle } from "@/hooks/usePageTitle";

// Lazy-load recharts to keep bundle small
const ResponsiveContainer = dynamic(
  () => import("recharts").then((m) => m.ResponsiveContainer),
  { ssr: false }
);
const LineChart = dynamic(() => import("recharts").then((m) => m.LineChart), {
  ssr: false,
});
const Line = dynamic(() => import("recharts").then((m) => m.Line), {
  ssr: false,
});
const BarChart = dynamic(() => import("recharts").then((m) => m.BarChart), {
  ssr: false,
});
const Bar = dynamic(() => import("recharts").then((m) => m.Bar), {
  ssr: false,
});
const PieChart = dynamic(() => import("recharts").then((m) => m.PieChart), {
  ssr: false,
});
const Pie = dynamic(() => import("recharts").then((m) => m.Pie), {
  ssr: false,
});
const Cell = dynamic(() => import("recharts").then((m) => m.Cell), {
  ssr: false,
});
const XAxis = dynamic(() => import("recharts").then((m) => m.XAxis), {
  ssr: false,
});
const YAxis = dynamic(() => import("recharts").then((m) => m.YAxis), {
  ssr: false,
});
const CartesianGrid = dynamic(
  () => import("recharts").then((m) => m.CartesianGrid),
  { ssr: false }
);
const Tooltip = dynamic(
  () => import("recharts").then((m) => m.Tooltip),
  { ssr: false }
);
const Legend = dynamic(() => import("recharts").then((m) => m.Legend), {
  ssr: false,
});

const TIER_COLORS: Record<string, string> = {
  free: "#6b7280",
  pro: "#3b82f6",
  enterprise: "#f59e0b",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  failed: "#f43f5e",
  queued: "#6b7280",
  processing: "#3b82f6",
};

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

function KpiCard({ label, value, icon: Icon, color, sub }: KpiCardProps) {
  return (
    <Card className="flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-xl font-bold text-gray-900 dark:text-white">{value}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-gray-500 truncate">{sub}</p>}
      </div>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function AdminAnalyticsPage() {
  usePageTitle("Admin — Analytics");
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      adminGetAnalytics(days),
      adminGetStorageStats(),
    ])
      .then(([analytics, storage]) => {
        setData(analytics);
        setStorageStats(storage);
      })
      .catch((e) => setError(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [days]);

  const tierData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.users_by_tier).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: TIER_COLORS[name] || "#6b7280",
    }));
  }, [data]);

  const statusData = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.analyses_by_status).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: STATUS_COLORS[name] || "#6b7280",
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton variant="text" width="200px" height="28px" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} variant="rectangular" height="88px" className="rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/20 p-6 text-center">
        <XCircle className="mx-auto mb-2 h-8 w-8 text-danger-500" />
        <p className="text-sm font-medium text-danger-700 dark:text-danger-300">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Platform overview for the last {days} days
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-32 rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Users"
          value={data.total_users}
          icon={Users}
          color="bg-primary-500"
          sub={`${data.active_users} active, ${data.verified_users} verified`}
        />
        <KpiCard
          label="Total Analyses"
          value={data.total_analyses}
          icon={FileText}
          color="bg-accent-500"
          sub={`${data.completed_analyses} completed`}
        />
        <KpiCard
          label="Avg Match Score"
          value={data.avg_match_score != null ? `${data.avg_match_score}%` : "--"}
          icon={Target}
          color="bg-success-500"
        />
        <KpiCard
          label="Avg ATS Score"
          value={data.avg_ats_score != null ? `${data.avg_ats_score}%` : "--"}
          icon={ShieldCheck}
          color="bg-warning-500"
        />
        <KpiCard
          label="Completed"
          value={data.completed_analyses}
          icon={CheckCircle}
          color="bg-success-500"
        />
        <KpiCard
          label="Failed"
          value={data.failed_analyses}
          icon={XCircle}
          color="bg-danger-500"
          sub={data.total_analyses > 0
            ? `${((data.failed_analyses / data.total_analyses) * 100).toFixed(1)}% failure rate`
            : undefined}
        />
        <KpiCard
          label="Active Users"
          value={data.active_users}
          icon={Activity}
          color="bg-primary-500"
        />
        <KpiCard
          label="Verified Users"
          value={data.verified_users}
          icon={ShieldCheck}
          color="bg-success-500"
          sub={data.total_users > 0
            ? `${((data.verified_users / data.total_users) * 100).toFixed(0)}% verified`
            : undefined}
        />
      </div>

      {/* Storage Stats */}
      {storageStats && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-700">
              <HardDrive className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                File Storage
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Backend: <span className="font-medium text-gray-600 dark:text-gray-300">{storageStats.backend.toUpperCase()}</span>
                {storageStats.bucket && (
                  <> &mdash; bucket: <span className="font-mono text-gray-600 dark:text-gray-300">{storageStats.bucket}</span></>
                )}
              </p>
            </div>
          </div>
          <div className="flex gap-8">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total files</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {storageStats.total_files.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Storage used</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(storageStats.total_bytes)}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Analyses Per Day */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Analyses Per Day
            </h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.analyses_per_day} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-gray-100 dark:text-surface-700"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-gray-400 dark:text-gray-500"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-gray-400 dark:text-gray-500"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name="Analyses" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Registrations Per Day */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-accent-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Registrations Per Day
            </h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.registrations_per_day} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="currentColor"
                  className="text-gray-100 dark:text-surface-700"
                />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-gray-400 dark:text-gray-500"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "currentColor" }}
                  className="text-gray-400 dark:text-gray-500"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Registrations"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Users by Tier */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Users by Tier
            </h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {tierData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Analyses by Status */}
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Analyses by Status
            </h3>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
