"use client";

import { useMemo } from "react";
import { BarChart, TrendingUp, Trophy, Calendar } from "lucide-react";
import Card from "@/components/ui/Card";
import AnimatedCounter from "@/components/ui/AnimatedCounter";
import { cn } from "@/lib/utils";
import type { AnalysisHistoryItem } from "@/types/analysis";

interface HistoryStatsBarProps {
  items: AnalysisHistoryItem[];
  className?: string;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  color: string;
  delay?: number;
}

function StatCard({ icon, label, value, suffix = "", color, delay = 0 }: StatCardProps) {
  return (
    <Card
      padding="sm"
      hoverable
      className={cn(
        "flex items-center gap-3 animate-fade-in",
        delay > 0 && `[animation-delay:${delay}ms]`
      )}
      style={
        delay > 0 ? { animationDelay: `${delay}ms`, animationFillMode: "backwards" } : undefined
      }
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">
          <AnimatedCounter value={value} suffix={suffix} duration={1000} animateOnView />
        </p>
      </div>
    </Card>
  );
}

export default function HistoryStatsBar({ items, className }: HistoryStatsBarProps) {
  const stats = useMemo(() => {
    const completed = items.filter((i) => i.status === "completed" && i.match_score != null);
    const scores = completed.map((i) => i.match_score as number);

    const total = items.length;
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const bestScore = scores.length > 0 ? Math.round(Math.max(...scores)) : 0;

    // Count analyses this month
    const now = new Date();
    const thisMonth = items.filter((i) => {
      const d = new Date(i.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    return { total, avgScore, bestScore, thisMonth };
  }, [items]);

  return (
    <div
      className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}
      data-testid="history-stats-bar"
    >
      <StatCard
        icon={<BarChart className="h-5 w-5 text-primary-600 dark:text-primary-400" />}
        label="Total Analyses"
        value={stats.total}
        color="bg-primary-100 dark:bg-primary-900/30"
        delay={0}
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5 text-accent-600 dark:text-accent-400" />}
        label="Avg Score"
        value={stats.avgScore}
        suffix="%"
        color="bg-accent-100 dark:bg-accent-900/30"
        delay={100}
      />
      <StatCard
        icon={<Trophy className="h-5 w-5 text-success-600 dark:text-success-400" />}
        label="Best Score"
        value={stats.bestScore}
        suffix="%"
        color="bg-success-100 dark:bg-success-900/30"
        delay={200}
      />
      <StatCard
        icon={<Calendar className="h-5 w-5 text-warning-600 dark:text-warning-400" />}
        label="This Month"
        value={stats.thisMonth}
        color="bg-warning-100 dark:bg-warning-900/30"
        delay={300}
      />
    </div>
  );
}
