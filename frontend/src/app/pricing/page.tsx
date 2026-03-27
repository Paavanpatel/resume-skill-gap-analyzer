"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Sparkles,
  Zap,
  Building2,
  ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createCheckoutSession, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

// ── Plan definitions ─────────────────────────────────────────

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    period: "forever",
    icon: <Zap className="h-6 w-6" />,
    description: "Perfect for trying out SkillGap.",
    featured: false,
    color:
      "border-gray-200 dark:border-surface-700",
    badgeColor:
      "bg-gray-100 dark:bg-surface-700 text-gray-700 dark:text-gray-300",
    ctaLabel: "Get Started",
    ctaVariant: "outline" as const,
    features: [
      "5 analyses per month",
      "Skill match & ATS score",
      "Category breakdown",
      "Improvement suggestions",
      "Resume history",
    ],
    locked: [
      "AI Learning Roadmap",
      "Resume Advisor rewrites",
      "PDF export",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$12",
    period: "per month",
    icon: <Sparkles className="h-6 w-6" />,
    description: "For active job seekers who want every edge.",
    featured: true,
    color:
      "border-primary-500 dark:border-primary-500 ring-2 ring-primary-500/30",
    badgeColor:
      "bg-primary-600 text-white",
    ctaLabel: "Upgrade to Pro",
    ctaVariant: "primary" as const,
    features: [
      "50 analyses per month",
      "Skill match & ATS score",
      "Category breakdown",
      "Improvement suggestions",
      "Resume history",
      "AI Learning Roadmap",
      "Resume Advisor rewrites",
      "PDF export",
      "Priority queue",
    ],
    locked: [],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "$49",
    period: "per month",
    icon: <Building2 className="h-6 w-6" />,
    description: "Teams and power users with unlimited needs.",
    featured: false,
    color:
      "border-warning-400 dark:border-warning-500",
    badgeColor:
      "bg-warning-500 text-white",
    ctaLabel: "Upgrade to Enterprise",
    ctaVariant: "outline" as const,
    features: [
      "Unlimited analyses",
      "All Pro features",
      "Team management (coming soon)",
      "API access (coming soon)",
      "Priority support",
      "Custom integrations",
    ],
    locked: [],
  },
] as const;

// ── Page ─────────────────────────────────────────────────────

export default function PricingPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function handleUpgrade(tierId: string) {
    if (!isAuthenticated) {
      router.push("/login?redirect=/pricing");
      return;
    }
    if (tierId === "free") {
      router.push("/dashboard");
      return;
    }

    setError("");
    setLoading(tierId);
    try {
      const { url } = await createCheckoutSession(
        tierId as "pro" | "enterprise"
      );
      window.location.href = url;
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-900">
      {/* Nav strip */}
      <div className="border-b border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-lg font-bold tracking-tighter">
            <span className="text-gradient">SkillGap</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Simple, transparent pricing
          </h1>
          <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
            Start free. Upgrade when you need more.
          </p>
          {user && (
            <p className="mt-2 text-sm text-gray-400 dark:text-gray-500">
              You are currently on the{" "}
              <span className="font-medium capitalize text-primary-600 dark:text-primary-400">
                {user.tier}
              </span>{" "}
              plan.
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-danger-200 dark:border-danger-700 bg-danger-50 dark:bg-danger-900/30 p-4 text-sm text-danger-700 dark:text-danger-300 text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrent = user?.tier === plan.id;
            const isLoading = loading === plan.id;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-white dark:bg-surface-800 p-8 shadow-sm transition-shadow hover:shadow-md",
                  plan.color,
                  plan.featured && "scale-[1.02]"
                )}
              >
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white shadow">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Icon + badge */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl",
                      plan.badgeColor
                    )}
                  >
                    {plan.icon}
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-success-100 dark:bg-success-900/40 px-2.5 py-0.5 text-xs font-medium text-success-700 dark:text-success-300">
                      Current
                    </span>
                  )}
                </div>

                {/* Name + price */}
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {plan.name}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  {plan.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">
                    {plan.price}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    /{plan.period}
                  </span>
                </div>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || isLoading}
                  className={cn(
                    "mt-6 w-full rounded-lg py-2.5 text-sm font-semibold transition-all",
                    isCurrent
                      ? "cursor-default bg-gray-100 dark:bg-surface-700 text-gray-400 dark:text-gray-500"
                      : plan.featured
                        ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
                        : "border border-gray-300 dark:border-surface-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700",
                    isLoading && "opacity-60 cursor-wait"
                  )}
                >
                  {isLoading
                    ? "Redirecting…"
                    : isCurrent
                      ? "Current plan"
                      : plan.ctaLabel}
                </button>

                {/* Features */}
                <ul className="mt-8 space-y-3 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500 mt-0.5" />
                      {f}
                    </li>
                  ))}
                  {plan.locked.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-gray-400 dark:text-gray-600 line-through"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-700 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="mt-10 text-center text-sm text-gray-400 dark:text-gray-500">
          All plans include a 14-day money-back guarantee.{" "}
          <Link href="/dashboard" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Back to dashboard
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
