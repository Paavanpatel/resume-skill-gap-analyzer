/**
 * Maintenance page — shown by Nginx when the backend is down
 * for a planned maintenance window, or linked from error pages.
 *
 * This is a static page that renders without any API calls so
 * it works even if the backend is completely unreachable.
 *
 * Usage in Nginx: `error_page 503 /maintenance;`
 * Or redirect all traffic: `return 503;` + the error_page directive.
 */
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scheduled Maintenance",
  description: "Resume Skill Gap Analyzer is undergoing scheduled maintenance.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-surface-950">
      <div className="w-full max-w-md text-center">
        {/* Logo mark */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-lg">
          <span className="text-2xl font-extrabold text-white">S</span>
        </div>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-warning-100 dark:bg-warning-900/30">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 text-warning-600 dark:text-warning-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l5.654-4.654m5.65-4.65 2.496-3.03c.317-.385.74-.627 1.208-.767m-1.72 8.496a2.25 2.25 0 0 0 3.182-3.182l-1.96-1.96"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Scheduled Maintenance
        </h1>
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
          We&apos;re making improvements to Resume Skill Gap Analyzer. We&apos;ll
          be back online shortly. Thank you for your patience.
        </p>

        {/* Status indicators */}
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 dark:border-surface-700 dark:bg-surface-800 text-left space-y-3">
          {[
            { label: "API", status: "maintenance" },
            { label: "Database", status: "maintenance" },
            { label: "Static assets", status: "operational" },
          ].map(({ label, status }) => (
            <div key={label} className="flex items-center justify-between text-sm">
              <span className="text-gray-700 dark:text-gray-300">{label}</span>
              <span
                className={
                  status === "operational"
                    ? "text-success-600 dark:text-success-400 font-medium"
                    : "text-warning-600 dark:text-warning-400 font-medium"
                }
              >
                {status === "operational" ? "Operational" : "Under maintenance"}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-xs text-gray-400 dark:text-gray-500">
          Check back in a few minutes.
        </p>
      </div>
    </div>
  );
}
