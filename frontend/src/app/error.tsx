"use client";

import { useEffect } from "react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <div
      data-testid="global-error"
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-surface-950 px-6 text-center"
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-50 dark:bg-danger-950/30 text-danger-500">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Something went wrong
      </h3>
      <p className="mt-1.5 max-w-sm text-sm text-gray-500 dark:text-gray-400">
        An unexpected error occurred. Please try again or refresh the page.
      </p>
      <button
        onClick={reset}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
      >
        Try Again
      </button>
    </div>
  );
}
