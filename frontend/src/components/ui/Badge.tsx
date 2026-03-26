import { cn } from "@/lib/utils";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
  className?: string;
}

const variants = {
  default: "bg-gray-100 dark:bg-surface-700 text-gray-700 dark:text-gray-300",
  success: "bg-success-100 dark:bg-success-900/30 text-success-700 dark:text-success-400",
  warning: "bg-warning-100 dark:bg-warning-900/30 text-warning-800 dark:text-warning-400",
  danger: "bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-400",
  info: "bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400",
};

export default function Badge({ variant = "default", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
