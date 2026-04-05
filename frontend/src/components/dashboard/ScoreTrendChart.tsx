"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TrendingUp } from "lucide-react";
import Card from "@/components/ui/Card";
import { cn, formatDate } from "@/lib/utils";
import type { AnalysisHistoryItem } from "@/types/analysis";

interface ScoreTrendChartProps {
  items: AnalysisHistoryItem[];
  className?: string;
}

interface ChartDataPoint {
  date: string;
  fullDate: string;
  matchScore: number | null;
  atsScore: number | null;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">
        {payload[0]?.payload?.fullDate}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-500 dark:text-gray-400">{entry.name}:</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {entry.value != null ? `${Math.round(entry.value)}%` : "--"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function ScoreTrendChart({ items, className }: ScoreTrendChartProps) {
  const chartData = useMemo(() => {
    // Only completed analyses with scores, sorted oldest → newest
    const completed = items
      .filter((i) => i.status === "completed" && i.match_score != null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    return completed.map(
      (item): ChartDataPoint => ({
        date: new Date(item.created_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        fullDate: formatDate(item.created_at),
        matchScore: item.match_score,
        atsScore: item.ats_score,
      })
    );
  }, [items]);

  // Don't render if fewer than 2 data points
  if (chartData.length < 2) {
    return null;
  }

  return (
    <Card className={cn("animate-fade-in", className)} data-testid="score-trend-chart">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Score Trends</h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">
          ({chartData.length} analyses)
        </span>
      </div>

      <div className="h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              className="text-gray-100 dark:text-surface-700"
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-gray-400 dark:text-gray-500"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: "currentColor" }}
              className="text-gray-400 dark:text-gray-500"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <RechartsTooltip content={<CustomTooltip />} />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
            />
            <Line
              type="monotone"
              dataKey="matchScore"
              name="Match Score"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="atsScore"
              name="ATS Score"
              stroke="#8b5cf6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 2, stroke: "#fff" }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
