"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  /** Max width class — defaults to max-w-lg */
  size?: "sm" | "md" | "lg" | "xl";
  /** Whether clicking backdrop closes modal */
  closeOnBackdrop?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Hide the close X button */
  hideCloseButton?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "lg",
  closeOnBackdrop = true,
  closeOnEscape = true,
  hideCloseButton = false,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus first focusable element on open
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const focusable = contentRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }, [isOpen]);

  // Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnBackdrop && e.target === overlayRef.current) {
        onClose();
      }
    },
    [closeOnBackdrop, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      aria-describedby={description ? "modal-description" : undefined}
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4",
        "bg-black/40 dark:bg-black/60 backdrop-blur-sm",
        "animate-backdrop-in"
      )}
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        className={cn(
          "relative w-full rounded-2xl bg-white dark:bg-surface-800 shadow-xl dark:shadow-dark-lg",
          "border border-gray-200 dark:border-surface-700",
          "animate-scale-in",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-0">
            <div>
              {title && (
                <h2
                  id="modal-title"
                  className="text-lg font-semibold text-gray-900 dark:text-gray-100"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-sm text-gray-500 dark:text-gray-400"
                >
                  {description}
                </p>
              )}
            </div>
            {!hideCloseButton && (
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Convenience footer for modal action buttons */
export function ModalFooter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 border-t border-gray-200 dark:border-surface-700 pt-4 mt-2",
        className
      )}
    >
      {children}
    </div>
  );
}
