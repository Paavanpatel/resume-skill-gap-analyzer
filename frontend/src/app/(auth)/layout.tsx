"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AuthIllustration from "@/components/auth/AuthIllustration";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  if (isAuthenticated) return null;

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
