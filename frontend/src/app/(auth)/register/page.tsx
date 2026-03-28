"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import usePageTitle from "@/hooks/usePageTitle";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import PasswordStrengthMeter, {
  getRequirements,
} from "@/components/ui/PasswordStrengthMeter";
import ProgressSteps from "@/components/ui/ProgressSteps";
import {
  Mail,
  Lock,
  User,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";

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

const STEPS = [
  { id: "info", label: "Your Info" },
  { id: "security", label: "Security" },
  { id: "confirm", label: "Confirm" },
];

export default function RegisterPage() {
  usePageTitle("Create Account");
  const router = useRouter();
  const { register } = useAuth();

  // Wizard state
  const [step, setStep] = useState(0);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);

  // UI state
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const emailError =
    touched.email && email.length > 0 && !emailValid
      ? "Please enter a valid email address"
      : undefined;

  const requirements = useMemo(() => getRequirements(password), [password]);
  const allRequirementsMet = requirements.every((r) => r.met);
  const passwordsMatch = password === confirmPassword;
  const confirmError =
    touched.confirm && confirmPassword.length > 0 && !passwordsMatch
      ? "Passwords do not match"
      : undefined;

  // Step validation
  const step1Valid = email.length > 0 && emailValid;
  const step2Valid = allRequirementsMet && passwordsMatch && confirmPassword.length > 0;
  const step3Valid = acceptTerms;

  function handleNext() {
    setError("");
    if (step === 0 && !step1Valid) {
      setTouched((p) => ({ ...p, email: true }));
      return;
    }
    if (step === 1 && !step2Valid) {
      setTouched((p) => ({ ...p, confirm: true }));
      return;
    }
    setStep((s) => Math.min(s + 1, 2));
  }

  function handleBack() {
    setError("");
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!step3Valid) return;

    setError("");
    setIsLoading(true);
    try {
      await register(email, password, fullName || undefined);
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

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
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start analyzing your resume in minutes
          </p>
        </div>

        {/* Progress stepper */}
        <div className="mb-8">
          <ProgressSteps steps={STEPS} currentStep={step} />
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Step 1: Your Info ── */}
          {step === 0 && (
            <div className="space-y-4 animate-fade-in" data-testid="step-info">
              <div className="space-y-1.5">
                <label
                  htmlFor="reg-name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Full name{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="reg-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Doe"
                    autoComplete="name"
                    className={cn(
                      "block w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm",
                      "bg-white dark:bg-surface-800",
                      "text-gray-900 dark:text-gray-100",
                      "placeholder:text-gray-400 dark:placeholder:text-gray-500",
                      "transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 dark:focus:ring-offset-surface-800",
                      "border-gray-300 dark:border-surface-700 focus:border-primary-500 focus:ring-primary-500"
                    )}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
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

              <Button
                type="button"
                size="lg"
                className="w-full"
                onClick={handleNext}
                disabled={!step1Valid}
              >
                Continue
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Security ── */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in" data-testid="step-security">
              <div className="space-y-1.5">
                <label
                  htmlFor="reg-password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a strong password"
                    required
                    autoComplete="new-password"
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

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-confirm"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    id="reg-confirm"
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
                {touched.confirm && passwordsMatch && confirmPassword.length > 0 && (
                  <p className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
                    <Check className="h-3.5 w-3.5" /> Passwords match
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="button"
                  size="lg"
                  className="flex-1"
                  onClick={handleNext}
                  disabled={!step2Valid}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in" data-testid="step-confirm">
              {/* Summary */}
              <div className="rounded-lg bg-gray-50 dark:bg-surface-700/50 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Account summary
                </h3>
                {fullName && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <User className="h-4 w-4" />
                    {fullName}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Mail className="h-4 w-4" />
                  {email}
                </div>
                <div className="flex items-center gap-2 text-sm text-success-600 dark:text-success-400">
                  <Check className="h-4 w-4" />
                  Strong password set
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start gap-3">
                <input
                  id="terms"
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <label
                  htmlFor="terms"
                  className="text-sm text-gray-600 dark:text-gray-400 leading-snug"
                >
                  I agree to the{" "}
                  <button type="button" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium">
                    Terms of Service
                  </button>{" "}
                  and{" "}
                  <button type="button" className="text-primary-600 hover:text-primary-500 dark:text-primary-400 font-medium">
                    Privacy Policy
                  </button>
                </label>
              </div>

              {/* Error */}
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="flex-1"
                  onClick={handleBack}
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                  isLoading={isLoading}
                  disabled={!step3Valid}
                >
                  Create account
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-gray-500 dark:text-gray-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary-600 hover:text-primary-500 dark:text-primary-400 transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
