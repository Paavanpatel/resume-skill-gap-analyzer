import { cn } from "@/lib/utils";

interface DividerProps {
  label?: string;
  className?: string;
}

export default function Divider({ label, className }: DividerProps) {
  if (!label) {
    return <hr className={cn("border-t border-gray-200 dark:border-surface-700", className)} />;
  }

  return (
    <div className={cn("relative flex items-center", className)}>
      <div className="flex-1 border-t border-gray-200 dark:border-surface-700" />
      <span className="mx-3 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
        {label}
      </span>
      <div className="flex-1 border-t border-gray-200 dark:border-surface-700" />
    </div>
  );
}
