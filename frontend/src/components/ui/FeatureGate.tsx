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

export default function FeatureGate({ requiredTier, featureName, children }: FeatureGateProps) {
  const { user } = useAuth();
  const userTier = user?.tier ?? "free";

  if (tierRank(userTier) >= tierRank(requiredTier)) {
    return <>{children}</>;
  }

  return <UpgradePrompt requiredTier={requiredTier} featureName={featureName} />;
}

function UpgradePrompt({
  requiredTier,
  featureName,
}: {
  requiredTier: "pro" | "enterprise";
  featureName: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-surface-700 dark:to-surface-800 shadow-soft dark:shadow-dark-sm">
          <Lock className="h-8 w-8 text-gray-300 dark:text-gray-600" />
        </div>
        <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-surface-800 shadow-md border border-gray-100 dark:border-surface-700">
          <Lock className="h-3.5 w-3.5 text-gray-400" />
        </div>
      </div>
      <h3 className="mt-5 text-lg font-semibold text-gray-900 dark:text-gray-100">{featureName}</h3>
      <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 max-w-sm">
        Upgrade your plan to unlock AI-powered {featureName.toLowerCase()} and more advanced
        capabilities.
      </p>
      <Link
        href="/pricing"
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
      >
        <Sparkles className="h-4 w-4" />
        Upgrade to {requiredTier.charAt(0).toUpperCase() + requiredTier.slice(1)}
      </Link>
    </div>
  );
}
