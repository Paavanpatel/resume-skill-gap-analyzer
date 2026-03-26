import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  /** Predefined shape variants */
  variant?: "text" | "circle" | "rect" | "card";
  /** Width — only used for rect/text */
  width?: string;
  /** Height — only used for rect/text */
  height?: string;
  /** Number of text lines to render */
  lines?: number;
}

export default function Skeleton({
  className,
  variant = "rect",
  width,
  height,
  lines = 1,
}: SkeletonProps) {
  if (variant === "text" && lines > 1) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "skeleton rounded",
              "h-4",
              // Last line shorter for natural look
              i === lines - 1 ? "w-3/4" : "w-full"
            )}
            style={{ width: i === lines - 1 ? undefined : width }}
          />
        ))}
      </div>
    );
  }

  if (variant === "circle") {
    return (
      <div
        className={cn("skeleton rounded-full", className)}
        style={{
          width: width || "40px",
          height: height || width || "40px",
        }}
      />
    );
  }

  if (variant === "card") {
    return (
      <div
        className={cn(
          "skeleton rounded-xl",
          "h-32 w-full",
          className
        )}
      />
    );
  }

  // Default: rect
  return (
    <div
      className={cn("skeleton rounded-lg", className)}
      style={{ width, height: height || "20px" }}
    />
  );
}

/** Pre-built skeleton for score cards */
export function ScoreCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-6 flex flex-col items-center gap-3">
      <Skeleton variant="circle" width="80px" height="80px" />
      <Skeleton variant="text" width="60px" height="14px" />
    </div>
  );
}

/** Pre-built skeleton for list items */
export function ListItemSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton variant="circle" width="32px" />
          <div className="flex-1 space-y-1.5">
            <Skeleton variant="text" width="60%" height="14px" />
            <Skeleton variant="text" width="40%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
}
