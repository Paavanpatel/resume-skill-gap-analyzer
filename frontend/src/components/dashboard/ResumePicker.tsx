"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, Upload, Clock, CheckCircle2, Loader2 } from "lucide-react";
import Tabs, { TabPanel } from "@/components/ui/Tabs";
import FileUploadZone from "@/components/dashboard/FileUploadZone";
import { listResumes, getErrorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ResumeUploadResponse } from "@/types/analysis";

interface ResumePickerProps {
  /** Called when user drops/selects a file to upload (Upload New tab) */
  onFileAccepted: (file: File) => Promise<void>;
  /** Called when the user picks an existing resume */
  onSelect: (resumeId: string, fileName: string) => void;
  /** Currently active resume id (to highlight the selected card) */
  selectedResumeId?: string | null;
  isUploading?: boolean;
  uploadError?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const PICKER_TABS = [
  { id: "upload", label: "Upload New", icon: <Upload className="h-3.5 w-3.5" /> },
  { id: "existing", label: "Use Existing", icon: <FileText className="h-3.5 w-3.5" /> },
];

export default function ResumePicker({
  onFileAccepted,
  onSelect,
  selectedResumeId,
  isUploading = false,
  uploadError,
}: ResumePickerProps) {
  const [activeTab, setActiveTab] = useState("upload");
  const [resumes, setResumes] = useState<ResumeUploadResponse[]>([]);
  const [isLoadingResumes, setIsLoadingResumes] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadResumes = useCallback(async () => {
    setIsLoadingResumes(true);
    setLoadError("");
    try {
      const data = await listResumes();
      // Sort by last_used_at desc, then created_at desc as fallback
      data.sort((a, b) => {
        const aTime = a.last_used_at ?? a.created_at;
        const bTime = b.last_used_at ?? b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
      setResumes(data);
    } catch (err) {
      setLoadError(getErrorMessage(err));
    } finally {
      setIsLoadingResumes(false);
    }
  }, []);

  // Load resumes when tab is switched to "existing"
  useEffect(() => {
    if (activeTab === "existing") {
      loadResumes();
    }
  }, [activeTab, loadResumes]);


  return (
    <div className="space-y-4">
      <Tabs
        tabs={PICKER_TABS}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        variant="pill"
        size="sm"
      >
        {/* Upload New tab */}
        <TabPanel id="upload" activeTab={activeTab}>
          <FileUploadZone
            onFileAccepted={onFileAccepted}
            isUploading={isUploading}
            error={uploadError}
          />
        </TabPanel>

        {/* Use Existing tab */}
        <TabPanel id="existing" activeTab={activeTab}>
          {isLoadingResumes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          ) : loadError ? (
            <p className="py-8 text-center text-sm text-danger-600 dark:text-danger-400">
              {loadError}
            </p>
          ) : resumes.length === 0 ? (
            <div className="py-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-surface-600" />
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                No previously uploaded resumes found.
              </p>
              <button
                className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                onClick={() => setActiveTab("upload")}
              >
                Upload one now
              </button>
            </div>
          ) : (
            <ul className="space-y-2" role="listbox" aria-label="Select an existing resume">
              {resumes.map((resume) => {
                const isSelected = resume.id === selectedResumeId;
                return (
                  <li key={resume.id}>
                    <button
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => onSelect(resume.id, resume.original_filename)}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 text-left transition-all duration-150",
                        "flex items-center gap-3",
                        isSelected
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-500/20"
                          : "border-gray-200 dark:border-surface-700 bg-white dark:bg-surface-800",
                        "hover:border-primary-400 hover:shadow-sm"
                      )}
                    >
                      {/* File type icon */}
                      <div
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase",
                          resume.file_type === "pdf"
                            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
                            : "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        )}
                      >
                        {resume.file_type}
                      </div>

                      {/* File info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {resume.original_filename}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                          <span>{formatFileSize(resume.file_size_bytes)}</span>
                          <span>·</span>
                          <Clock className="h-3 w-3" />
                          <span>
                            {resume.last_used_at
                              ? `Used ${formatRelativeTime(resume.last_used_at)}`
                              : `Uploaded ${formatRelativeTime(resume.created_at)}`}
                          </span>
                        </div>
                      </div>

                      {/* Selected indicator */}
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-primary-500" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}
