"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── Types ────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: string) => void;
}

// ── Context ──────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

// ── Variant config ───────────────────────────────────────────

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; bg: string; border: string; text: string }
> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-success-50 dark:bg-success-900/30",
    border: "border-success-200 dark:border-success-700",
    text: "text-success-700 dark:text-success-300",
  },
  error: {
    icon: XCircle,
    bg: "bg-danger-50 dark:bg-danger-900/30",
    border: "border-danger-200 dark:border-danger-700",
    text: "text-danger-700 dark:text-danger-300",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning-50 dark:bg-warning-900/30",
    border: "border-warning-200 dark:border-warning-700",
    text: "text-warning-700 dark:text-warning-300",
  },
  info: {
    icon: Info,
    bg: "bg-primary-50 dark:bg-primary-900/30",
    border: "border-primary-200 dark:border-primary-700",
    text: "text-primary-700 dark:text-primary-300",
  },
};

// ── Provider ─────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);

      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}

      {/* Toast container */}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((t) => {
          const cfg = variantConfig[t.variant];
          const Icon = cfg.icon;

          return (
            <div
              key={t.id}
              role="alert"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg",
                "animate-toast-in",
                cfg.bg,
                cfg.border
              )}
            >
              <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", cfg.text)} />
              <p className={cn("flex-1 text-sm font-medium", cfg.text)}>
                {t.message}
              </p>
              <button
                onClick={() => dismiss(t.id)}
                className={cn(
                  "shrink-0 rounded-lg p-0.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10",
                  cfg.text
                )}
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
