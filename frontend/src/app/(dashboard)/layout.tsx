"use client";

import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Skeleton from "@/components/ui/Skeleton";
import PageTransition from "@/components/ui/PageTransition";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import VerificationBanner from "@/components/ui/VerificationBanner";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-surface-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
            <span className="text-lg font-bold text-white">S</span>
          </div>
          <div className="space-y-2">
            <Skeleton variant="text" width="120px" height="12px" />
            <Skeleton variant="text" width="80px" height="12px" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-surface-950">
      <Navbar />
      <VerificationBanner />
      <main id="main-content" className="mx-auto max-w-6xl px-4 py-8 pb-24 sm:pb-8">
        <ErrorBoundary>
          <PageTransition variant="slide-up" duration={350}>
            {children}
          </PageTransition>
        </ErrorBoundary>
      </main>
      <MobileBottomNav />
    </div>
  );
}
