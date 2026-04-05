"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import AuthIllustration from "@/components/auth/AuthIllustration";

// These pages are reachable by both authenticated and unauthenticated users.
// (e.g. verify-email after auto-login on register, reset-password from email link)
const OPEN_PATHS = ["/verify-email", "/forgot-password", "/reset-password"];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isOpenPage = OPEN_PATHS.some((p) => pathname?.startsWith(p));

  useEffect(() => {
    if (!isLoading && isAuthenticated && !isOpenPage) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router, isOpenPage]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated && !isOpenPage) return null;

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding illustration (hidden on mobile) */}
      <AuthIllustration className="hidden lg:flex lg:w-1/2" />

      {/* Right panel — auth form */}
      <div className="flex flex-1 items-center justify-center px-4 py-12 bg-gray-50 dark:bg-surface-900">
        <div className="w-full max-w-md animate-fade-in">{children}</div>
      </div>
    </div>
  );
}
