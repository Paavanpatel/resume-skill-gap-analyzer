"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import usePageTitle from "@/hooks/usePageTitle";
import {
  Upload,
  FileText,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ProgressSteps from "@/components/ui/ProgressSteps";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import ResumePicker from "@/components/dashboard/ResumePicker";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import JobDescriptionInput from "@/components/dashboard/JobDescriptionInput";
import { uploadResume, submitAnalysis, getErrorMessage, getUsageSummary } from "@/lib/api";
import { useAnalysisTracker } from "@/context/AnalysisTrackerContext";
import UsageWidget from "@/components/dashboard/UsageWidget";
import WizardTransition from "@/components/ui/WizardTransition";
import Link from "next/link";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  { id: "upload", label: "Upload", icon: <Upload className="h-3.5 w-3.5" /> },
  { id: "describe", label: "Describe", icon: <Briefcase className="h-3.5 w-3.5" /> },
  { id: "review", label: "Review", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

export default function DashboardPage() {
  usePageTitle("New Analysis");
  const router = useRouter();
  const { track } = useAnalysisTracker();
  const [quotaReached, setQuotaReached] = useState(false);

  // Check quota once on mount
  useEffect(() => {
    getUsageSummary().then((u) => {
      if (u.analyses.used >= u.analyses.limit && u.tier !== "enterprise") {
        setQuotaReached(true);
      }
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wizard step: 0=upload, 1=describe, 2=review
  const [step, setStep] = useState(0);

  // Form state
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");

  // UI state
  const [error, setError] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submittedJobId, setSubmittedJobId] = useState<string | null>(null);

  // ── File upload handler ──
  const handleFileAccepted = useCallback(async (file: File) => {
    setError("");
    setIsUploading(true);
    try {
      const result = await uploadResume(file);
      setResumeId(result.id);
      setFileName(result.original_filename);
      setStep(1); // advance to describe step
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsUploading(false);
    }
  }, []);

  // ── Step validation ──
  const canAdvanceToReview =
    resumeId && jobDescription.length >= 50;

  // ── Submit ──
  async function handleConfirmSubmit() {
    if (!resumeId) return;
    setShowConfirmModal(false);
    setError("");
    setIsSubmitting(true);
    try {
      const result = await submitAnalysis(
        resumeId,
        jobDescription,
        jobTitle,
        jobCompany
      );
      track(result.job_id, jobTitle || fileName || "Resume Analysis");
      setSubmittedJobId(result.job_id);
      setStep(3); // submitted state
    } catch (err) {
      setError(getErrorMessage(err));
      setStep(1); // back to describe
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleReset() {
    setStep(0);
    setResumeId(null);
    setFileName("");
    setJobTitle("");
    setJobCompany("");
    setJobDescription("");
    setSubmittedJobId(null);
    setError("");
  }

  // ── Submitted success state ──
  if (step === 3 && submittedJobId) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div
          className={cn(
            "rounded-2xl border border-success-200 dark:border-success-700/50",
            "bg-success-50 dark:bg-success-900/20",
            "p-8 text-center animate-fade-in"
          )}
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-success-100 dark:bg-success-900/40">
            <CheckCircle2 className="h-8 w-8 text-success-600 dark:text-success-400" />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-gray-100">
            Analysis Submitted!
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            Your analysis is processing in the background. The floating tracker
            in the bottom-right will notify you when results are ready.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => router.push(`/analysis/${submittedJobId}`)}
            >
              <ArrowRight className="h-4 w-4" />
              View Progress
            </Button>
            <Button onClick={handleReset} variant="outline">
              Start Another Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Quota-blocked state — show CTA instead of wizard
  if (quotaReached) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-warning-200 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-warning-100 dark:bg-warning-900/40 mb-4">
            <Sparkles className="h-8 w-8 text-warning-600 dark:text-warning-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Monthly Limit Reached
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            You&apos;ve used all your analyses for this month. Upgrade to Pro
            for 50 analyses/month and unlock AI Roadmap, Advisor, and PDF
            Export.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
              Upgrade to Pro
            </Link>
            <Link
              href="/history"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 dark:border-surface-600 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
            >
              View History
            </Link>
          </div>
        </div>
        <UsageWidget />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Usage widget */}
      <UsageWidget />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          New Analysis
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload your resume and paste a job description to see how well you
          match.
        </p>
      </div>

      {/* Progress stepper */}
      <ProgressSteps
        steps={WIZARD_STEPS}
        currentStep={step}
      />

      {/* ── Step Content (with directional transition) ── */}
      <WizardTransition step={step}>

      {/* ── Step 0: Choose Resume ── */}
      {step === 0 && (
        <div className="space-y-4" data-testid="step-upload">
          <div className="flex items-center gap-2 mb-2">
            <Upload className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Choose Resume
            </h2>
          </div>
          <ResumePicker
            onFileAccepted={handleFileAccepted}
            onSelect={(id, name) => {
              setResumeId(id);
              setFileName(name);
              setStep(1);
            }}
            selectedResumeId={resumeId}
            isUploading={isUploading}
            uploadError={error}
          />
        </div>
      )}

      {/* ── Step 1: Describe the Job ── */}
      {step === 1 && (
        <div className="space-y-6" data-testid="step-describe">
          {/* Uploaded file summary */}
          <FileUploadZone
            onFileAccepted={handleFileAccepted}
            uploadedFileName={fileName}
            isUploading={false}
            onRemove={() => {
              setStep(0);
              setResumeId(null);
              setFileName("");
            }}
          />

          {/* Job details */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Briefcase className="h-5 w-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Job Description
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Job title"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
              />
              <Input
                label="Company"
                value={jobCompany}
                onChange={(e) => setJobCompany(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>

            <JobDescriptionInput
              value={jobDescription}
              onChange={setJobDescription}
              minLength={50}
            />

            {/* Error from submission attempt */}
            {error && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg p-3 text-sm",
                  "bg-danger-50 dark:bg-danger-900/30",
                  "text-danger-700 dark:text-danger-300",
                  "border border-danger-200 dark:border-danger-700",
                  "animate-slide-up"
                )}
              >
                {error}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(0)}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              className="flex-1"
              size="lg"
              disabled={!canAdvanceToReview}
              onClick={() => {
                setError("");
                setStep(2);
              }}
            >
              Review & Submit
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 2: Review & Confirm ── */}
      {step === 2 && (
        <div className="space-y-6" data-testid="step-review">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Review Your Analysis
            </h2>
          </div>

          {/* Summary card */}
          <div
            className={cn(
              "rounded-xl border border-gray-200 dark:border-surface-700",
              "bg-white dark:bg-surface-800 p-6 space-y-4"
            )}
          >
            {/* Resume */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-900/30">
                <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Resume
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {fileName}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-surface-700" />

            {/* Job info */}
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-50 dark:bg-accent-900/30">
                <Briefcase className="h-5 w-5 text-accent-600 dark:text-accent-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  Target Position
                </p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {jobTitle || "Not specified"}
                  {jobCompany ? ` at ${jobCompany}` : ""}
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-surface-700" />

            {/* JD preview */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2">
                Job Description Preview
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
                {jobDescription}
              </p>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {jobDescription.length} characters
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className={cn(
                "flex items-center gap-2 rounded-lg p-3 text-sm",
                "bg-danger-50 dark:bg-danger-900/30",
                "text-danger-700 dark:text-danger-300",
                "border border-danger-200 dark:border-danger-700",
                "animate-slide-up"
              )}
            >
              {error}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="h-4 w-4" />
              Edit
            </Button>
            <Button
              className="flex-1"
              size="lg"
              isLoading={isSubmitting}
              onClick={() => setShowConfirmModal(true)}
            >
              <Sparkles className="h-4 w-4" />
              Analyze My Resume
            </Button>
          </div>
        </div>
      )}

      </WizardTransition>

      {/* ── Confirmation Modal ── */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Start Analysis?"
        description="This will use one of your monthly analysis credits."
        size="sm"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Your resume <span className="font-medium text-gray-900 dark:text-gray-100">{fileName}</span> will
          be analyzed against the{" "}
          {jobTitle ? (
            <span className="font-medium text-gray-900 dark:text-gray-100">{jobTitle}</span>
          ) : (
            "provided"
          )}{" "}
          job description. The analysis typically takes 10–20 seconds.
        </p>
        <ModalFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfirmModal(false)}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirmSubmit}>
            <Sparkles className="h-3.5 w-3.5" />
            Start Analysis
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
