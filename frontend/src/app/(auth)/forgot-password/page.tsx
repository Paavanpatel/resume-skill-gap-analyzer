"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePageTitle } from "@/hooks/usePageTitle";
import { forgotPassword, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Mail, AlertCircle, CheckCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function ForgotPasswordPage() {
  usePageTitle("Forgot Password");

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState(false);

  // Resend cooldown (reuse after first submission)
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError =
    touched && email.length > 0 && !emailValid
      ? "Please enter a valid email address"
      : undefined;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!emailValid || isLoading) return;

    setError("");
    setIsLoading(true);
    try {
      await forgotPassword(email);
      setSubmitted(true);
      setCooldown(60);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      await forgotPassword(email);
      setCooldown(60);
    } catch {
      // Silent — backend never reveals if email is registered
    } finally {
      setIsResending(false);
    }
  }

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="text-center lg:hidden">
          <h2 className="text-2xl font-bold text-primary-600 dark:text-primary-400">SkillGap</h2>
        </div>

        <div
          className={cn(
            "rounded-2xl border border-gray-200 dark:border-surface-700",
            "bg-white/80 dark:bg-surface-800/80 backdrop-blur-sm",
            "shadow-lg dark:shadow-dark-lg",
            "p-8 text-center"
          )}
        >
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success-100 dark:bg-success-900/30">
            <CheckCircle className="h-7 w-7 text-success-600 dark:text-success-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Check your inbox</h1>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            If an account exists for{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>, we&apos;ve
            sent a password reset link. It expires in 1 hour.
          </p>

          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Didn&apos;t receive it? Check your spam folder or{" "}
            {cooldown > 0 ? (
              <span className="tabular-nums font-medium">resend in {cooldown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className="inline-flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 disabled:opacity-50"
              >
                {isResending && <RefreshCw className="h-3 w-3 animate-spin" />}
                resend it
              </button>
            )}
            .
          </p>
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
            <Mail className="h-7 w-7 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Forgot password?</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label
              htmlFor="forgot-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                autoFocus
                className={cn(
                  "block w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm",
                  "bg-white dark:bg-surface-800",
                  "text-gray-900 dark:text-gray-100",
                  "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                  "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
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
            disabled={!emailValid}
          >
            Send reset link
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
