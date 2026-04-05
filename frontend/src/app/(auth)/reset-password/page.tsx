"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitle } from "@/hooks/usePageTitle";
import { resetPassword, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PasswordStrengthMeter, { getRequirements } from "@/components/ui/PasswordStrengthMeter";
import { AlertCircle, CheckCircle, Lock, ArrowLeft } from "lucide-react";

// Inline eye icons
function EyeSvg({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffSvg({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function ResetPasswordPage() {
  usePageTitle("Reset Password");
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [touched, setTouched] = useState<{ confirm?: boolean }>({});

  const requirements = useMemo(() => getRequirements(password), [password]);
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch = password === confirmPassword;
  const confirmError =
    touched.confirm && confirmPassword.length > 0 && !passwordsMatch
      ? "Passwords do not match"
      : undefined;

  const canSubmit = allRequirementsMet && passwordsMatch && confirmPassword.length > 0 && !!token;

  if (!token) {
    return (
      <div className="space-y-6">
        <div
          className={cn(
            "rounded-2xl border border-gray-200 dark:border-surface-700",
            "bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm",
            "shadow-lg dark:shadow-dark-lg",
            "p-8 text-center"
          )}
        >
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-danger-500" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Invalid reset link</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This reset link is missing a token. Request a new one from the forgot-password page.
          </p>
          <div className="mt-6">
            <Link
              href="/forgot-password"
              className="text-sm font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400"
            >
              Request new link
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-6">
        <div
          className={cn(
            "rounded-2xl border border-gray-200 dark:border-surface-700",
            "bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm",
            "shadow-lg dark:shadow-dark-lg",
            "p-10 text-center"
          )}
        >
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-success-500" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Password updated!</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Your password has been reset. Sign in with your new password.
          </p>
          <div className="mt-6">
            <Button size="lg" onClick={() => router.push("/login")}>
              Sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || isLoading) return;

    setError("");
    setIsLoading(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Mobile branding */}
      <div className="text-center lg:hidden">
        <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">SkillGap</h2>
      </div>

      <div
        className={cn(
          "rounded-2xl border border-gray-200 dark:border-surface-700",
          "bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm",
          "shadow-lg dark:shadow-dark-lg",
          "p-8"
        )}
      >
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Lock className="h-7 w-7 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Set new password</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New password */}
          <div className="space-y-1.5">
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              New password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                autoComplete="new-password"
                autoFocus
                className={cn(
                  "block w-full rounded-lg border pl-10 pr-10 py-2.5 text-sm",
                  "bg-white dark:bg-surface-800",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
                  "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOffSvg className="h-4 w-4" /> : <EyeSvg className="h-4 w-4" />}
              </button>
            </div>
            <PasswordStrengthMeter password={password} />
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Confirm password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, confirm: true }))}
                placeholder="Re-enter your password"
                required
                autoComplete="new-password"
                className={cn(
                  "block w-full rounded-lg border pl-10 pr-10 py-2.5 text-sm",
                  "bg-white dark:bg-surface-800",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
                  confirmError
                    ? "border-danger-300 dark:border-danger-700 focus:border-danger-500 focus:ring-danger-500"
                    : "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500"
                )}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label={showConfirm ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showConfirm ? <EyeOffSvg className="h-4 w-4" /> : <EyeSvg className="h-4 w-4" />}
              </button>
            </div>
            {confirmError && (
              <p className="text-xs text-danger-600 dark:text-danger-400">{confirmError}</p>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 text-sm",
                "bg-danger-50 dark:bg-danger-900/30",
                "text-danger-700 dark:text-danger-300",
                "border border-danger-200 dark:border-danger-700",
                "animate-slide-up"
              )}
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isLoading}
            disabled={!canSubmit}
          >
            Reset password
          </Button>
        </form>
      </div>

      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
