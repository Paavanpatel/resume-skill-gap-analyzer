"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { resendVerification } from "@/lib/api";
import { cn } from "@/lib/utils";
import { MailWarning, X, RefreshCw } from "lucide-react";

export default function VerificationBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  if (!user || user.is_verified || dismissed) return null;

  async function handleResend() {
    if (sending || cooldown > 0 || !user) return;
    setSending(true);
    try {
      await resendVerification(user.email);
      setSent(true);
      setCooldown(60);
    } catch {
      // Silent
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 px-4 py-3 text-sm",
        "bg-warning-50 dark:bg-warning-900/20",
        "border-b border-warning-200 dark:border-warning-700/50",
        "text-warning-800 dark:text-warning-300"
      )}
    >
      <MailWarning className="h-4 w-4 shrink-0" />

      <span className="flex-1">
        Please verify your email address.{" "}
        {sent ? (
          <span className="font-medium text-warning-700 dark:text-warning-400">
            Code sent! Check your inbox.
          </span>
        ) : user.email ? (
          <Link
            href={`/verify-email?email=${encodeURIComponent(user.email)}`}
            className="font-semibold underline underline-offset-2 hover:no-underline"
          >
            Enter code
          </Link>
        ) : null}
      </span>

      {/* Resend link */}
      {!sent && cooldown === 0 && (
        <button
          type="button"
          onClick={handleResend}
          disabled={sending}
          className={cn(
            "shrink-0 text-xs font-medium underline underline-offset-2 hover:no-underline",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-1"
          )}
        >
          {sending && <RefreshCw className="h-3 w-3 animate-spin" />}
          Resend email
        </button>
      )}
      {cooldown > 0 && (
        <span className="shrink-0 text-xs tabular-nums font-medium opacity-70">
          Resend in {cooldown}s
        </span>
      )}

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
