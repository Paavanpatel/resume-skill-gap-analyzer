"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import { verifyEmail, resendVerification, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { Mail, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

// ── OTP input: 6 individual boxes with auto-advance ──────────

interface OtpInputProps {
  value: string[];
  onChange: (digits: string[]) => void;
  disabled?: boolean;
}

function OtpInput({ value, onChange, disabled }: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function focus(index: number) {
    refs.current[index]?.focus();
  }

  function handleChange(index: number, raw: string) {
    // Accept only digits; take the last typed character
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...value];
    next[index] = digit;
    onChange(next);
    if (digit && index < OTP_LENGTH - 1) focus(index + 1);
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (value[index]) {
        const next = [...value];
        next[index] = "";
        onChange(next);
      } else if (index > 0) {
        focus(index - 1);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      focus(index - 1);
    } else if (e.key === "ArrowRight" && index < OTP_LENGTH - 1) {
      focus(index + 1);
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!pasted) return;
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    onChange(next);
    // Focus the box after the last pasted digit
    focus(Math.min(pasted.length, OTP_LENGTH - 1));
  }

  return (
    <div className="flex gap-3 justify-center" onPaste={handlePaste}>
      {Array.from({ length: OTP_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          disabled={disabled}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Digit ${i + 1}`}
          className={cn(
            "w-12 h-14 text-center text-xl font-bold rounded-lg border",
            "bg-white dark:bg-surface-800",
            "text-gray-900 dark:text-gray-100",
            "transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value[i]
              ? "border-primary-500 dark:border-primary-400 focus:ring-primary-500"
              : "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500"
          )}
        />
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function VerifyEmailPage() {
  usePageTitle("Verify Email");
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const { updateUser } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [verified, setVerified] = useState(false);

  // Resend cooldown
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const otp = digits.join("");
  const isComplete = otp.length === OTP_LENGTH;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isComplete || isLoading) return;

    setError("");
    setIsLoading(true);
    try {
      const updatedUser = await verifyEmail(email, otp);
      updateUser(updatedUser);
      setVerified(true);
      // Redirect to dashboard after a short success pause
      setTimeout(() => router.replace("/dashboard"), 1500);
    } catch (err) {
      setError(getErrorMessage(err));
      // Clear digits on wrong OTP
      setDigits(Array(OTP_LENGTH).fill(""));
    } finally {
      setIsLoading(false);
    }
  }

  const handleResend = useCallback(async () => {
    if (cooldown > 0 || isResending || !email) return;
    setIsResending(true);
    setError("");
    try {
      await resendVerification(email);
      setCooldown(RESEND_COOLDOWN);
      setDigits(Array(OTP_LENGTH).fill(""));
    } catch {
      // Error is silent — the backend never reveals if email is registered
    } finally {
      setIsResending(false);
    }
  }, [cooldown, isResending, email]);

  const maskedEmail = email
    ? email.replace(/(.{2})(.+)(@.+)/, (_, a, _b, c) => `${a}${"•".repeat(4)}${c}`)
    : "your email";

  if (verified) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Email verified!</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Redirecting you to your dashboard…
          </p>
        </div>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Check your email</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            We sent a 6-digit code to{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">{maskedEmail}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <OtpInput value={digits} onChange={setDigits} disabled={isLoading} />

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
            disabled={!isComplete}
          >
            Verify email
          </Button>
        </form>

        {/* Resend */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Didn&apos;t receive a code?{" "}
            {cooldown > 0 ? (
              <span className="text-gray-400 dark:text-gray-500">
                Resend in <span className="tabular-nums font-medium">{cooldown}s</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending}
                className={cn(
                  "inline-flex items-center gap-1 font-semibold",
                  "text-primary-600 hover:text-primary-500 dark:text-primary-400",
                  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                )}
              >
                {isResending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Resend code
              </button>
            )}
          </p>
        </div>

        {/* Skip */}
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
