"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import usePageTitle from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import { useRateLimit } from "@/hooks/useRateLimit";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Mail, Lock, AlertCircle, Clock } from "lucide-react";

// Inline eye icons — avoids lucide-react export resolution issues in Docker builds
function EyeSvg({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffSvg({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export default function LoginPage() {
  usePageTitle("Sign In");
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Track rate limit state — clears the generic error when triggered
  const { isLimited, secondsRemaining } = useRateLimit(() => {
    setError("");
  });

  const emailError =
    touched.email && email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ? "Please enter a valid email address"
      : undefined;

  // Button is disabled while submitting OR while rate-limited
  const isSubmitDisabled = isLoading || isLimited;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitDisabled) return;

    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      // 429 errors are handled by the useRateLimit hook via the interceptor event.
      // We only set a generic error message for non-rate-limit failures.
      const msg = getErrorMessage(err);
      const isRateLimit = (err as any)?.response?.status === 429;
      if (!isRateLimit) {
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }

  // Build the countdown label for the submit button
  const countdownLabel = (() => {
    if (!isLimited) return null;
    const mins = Math.floor(secondsRemaining / 60);
    const secs = secondsRemaining % 60;
    return mins > 0
      ? `${mins}m ${secs.toString().padStart(2, "0")}s`
      : `${secondsRemaining}s`;
  })();

  return (
    <div className="space-y-6">
      {/* Mobile-only branding */}
      <div className="text-center lg:hidden">
        <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">SkillGap</h2>
      </div>

      {/* Glass card */}
      <div
        className={cn(
          "rounded-2xl border border-gray-200 dark:border-surface-700",
          "bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm",
          "shadow-lg dark:shadow-dark-lg",
          "p-8"
        )}
      >
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Welcome back
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label
              htmlFor="login-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={isLimited}
                className={cn(
                  "block w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm",
                  "bg-white dark:bg-surface-800",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  emailError
                    ? "border-danger-300 dark:border-danger-700 focus:border-danger-500 focus:ring-danger-500"
                    : "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500"
                )}
              />
            </div>
            {emailError && (
              <p className="text-xs text-danger-600 dark:text-danger-400">{emailError}</p>
            )}
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, password: true }))}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={isLimited}
                className={cn(
                  "block w-full rounded-lg border pl-10 pr-10 py-2.5 text-sm",
                  "bg-white dark:bg-surface-800",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
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
                {showPassword ? (
                  <EyeOffSvg className="h-4 w-4" />
                ) : (
                  <EyeSvg className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2">
            <input
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label
              htmlFor="remember-me"
              className="text-sm text-gray-600 dark:text-gray-400"
            >
              Remember me
            </label>
          </div>

          {/* Rate limit inline error with countdown */}
          {isLimited && (
            <div
              role="alert"
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 text-sm",
                "bg-warning-50 dark:bg-warning-900/30",
                "text-warning-700 dark:text-warning-300",
                "border border-warning-200 dark:border-warning-700",
                "animate-slide-up"
              )}
            >
              <Clock className="h-4 w-4 shrink-0" />
              <span>
                Too many attempts. You can try again in{" "}
                <span className="font-semibold tabular-nums">{countdownLabel}</span>.
              </span>
            </div>
          )}

          {/* Generic error message (non-rate-limit failures) */}
          {error && !isLimited && (
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

          {/* Submit — disabled with countdown label while rate-limited */}
          <Button
            type="submit"
            isLoading={isLoading}
            disabled={isSubmitDisabled}
            size="lg"
            className="w-full"
          >
            {isLimited ? (
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Try again in {countdownLabel}
              </span>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-surface-700" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-surface-800 px-3 text-gray-400">
              Or continue with
            </span>
          </div>
        </div>

        {/* Social login buttons (UI only) */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium",
              "border-gray-300 dark:border-surface-700",
              "text-gray-700 dark:text-gray-300",
              "hover:bg-gray-50 dark:hover:bg-surface-700",
              "transition-colors"
            )}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google
          </button>
          <button
            type="button"
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium",
              "border-gray-300 dark:border-surface-700",
              "text-gray-700 dark:text-gray-300",
              "hover:bg-gray-50 dark:hover:bg-surface-700",
              "transition-colors"
            )}
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            GitHub
          </button>
        </div>
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
