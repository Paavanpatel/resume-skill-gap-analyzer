"use client";

/**
 * FeatureGate — wraps pro/enterprise features.
 *
 * If the user's tier is insufficient, renders an UpgradePrompt overlay
 * instead of the children. The overlay shows what tier is needed and
 * links to /pricing.
 *
 * Usage:
 *   <FeatureGate requiredTier="pro" featureName="Learning Roadmap">
 *     <RoadmapSection ... />
 *   </FeatureGate>
 */

import { Lock, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const TIER_RANK: Record<string, number> = { free: 0, pro: 1, enterprise: 2 };

function tierRank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

interface FeatureGateProps {
  /** Minimum tier required to access the feature. */
  requiredTier: "pro" | "enterprise";
  /** Human-readable feature name shown in the upgrade prompt. */
  featureName: string;
  children: React.ReactNode;
}

export default function FeatureGate({
  requiredTier,
  featureName,
  children,
}: FeatureGateProps) {
  const { user } = useAuth();
  const userTier = user?.tier ?? "free";

  if (tierRank(userTier) >= tierRank(requiredTier)) {
    return <>{children}</>;
  }

  return (
    <UpgradePrompt requiredTier={requiredTier} featureName={featureName} />
  );
}

function UpgradePrompt({
  requiredTier,
  featureName,
}: {
  requiredTier: "pro" | "enterprise";
  featureName: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10 py-16 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-100 dark:bg-primary-900/40 mb-4">
        <Lock className="h-7 w-7 text-primary-600 dark:text-primary-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
        {featureName} is a{" "}
        <span className="capitalize text-primary-600 dark:text-primary-400">
          {requiredTier}
        </span>{" "}
        feature
      </h3>
      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
        Upgrade your plan to unlock AI-powered {featureName.toLowerCase()} and
        more advanced capabilities.
      </p>
      <Link
        href="/pricing"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
