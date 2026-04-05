/**
 * Dashboard route-group loading UI.
 *
 * Next.js automatically shows this file while the page segment
 * is being fetched/streamed. It wraps the page in a React Suspense
 * boundary, so the Navbar and layout chrome remain interactive.
 *
 * Mirrors the card/widget layout of the dashboard home page so
 * the skeleton matches what will load in.
 */
export default function DashboardLoading() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8 animate-pulse"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      {/* Usage widget skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800">
        <div className="mb-3 h-4 w-24 rounded bg-gray-200 dark:bg-surface-600" />
        <div className="flex gap-4">
          <div className="h-3 w-32 rounded bg-gray-200 dark:bg-surface-600" />
          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-surface-600" />
        </div>
      </div>

      {/* Heading skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-40 rounded bg-gray-200 dark:bg-surface-600" />
        <div className="h-4 w-72 rounded bg-gray-200 dark:bg-surface-600" />
      </div>

      {/* Progress steps skeleton */}
      <div className="flex gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex flex-1 items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gray-200 dark:bg-surface-600" />
            <div className="h-3 flex-1 rounded bg-gray-100 dark:bg-surface-700" />
          </div>
        ))}
      </div>

      {/* Main content card skeleton */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-surface-700 dark:bg-surface-800 space-y-4">
        <div className="h-5 w-36 rounded bg-gray-200 dark:bg-surface-600" />
        <div className="h-32 w-full rounded-lg bg-gray-100 dark:bg-surface-700 border-2 border-dashed border-gray-200 dark:border-surface-600" />
        <div className="h-4 w-48 rounded bg-gray-200 dark:bg-surface-600" />
      </div>
    </div>
  );
}
