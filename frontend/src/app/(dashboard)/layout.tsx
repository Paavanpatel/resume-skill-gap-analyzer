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
      {/* Ambient gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary-100/40 via-accent-100/20 to-transparent dark:from-primary-950/30 dark:via-accent-950/20 blur-3xl" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-success-100/30 via-primary-100/10 to-transparent dark:from-success-950/20 dark:via-primary-950/10 blur-3xl" />
      </div>

      <div className="relative z-10">
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
    </div>
  );
}
