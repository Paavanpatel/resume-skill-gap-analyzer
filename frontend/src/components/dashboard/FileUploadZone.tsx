"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import {
  Upload,
  FileText,
  File,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface FileUploadZoneProps {
  onFileAccepted: (file: File) => Promise<void>;
  /** After upload succeeds, the resolved filename */
  uploadedFileName?: string;
  /** Whether an upload is in progress */
  isUploading?: boolean;
  /** Error message from upload */
  error?: string;
  /** Called when user wants to remove the uploaded file */
  onRemove?: () => void;
  className?: string;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-5 w-5 text-danger-500" />;
  if (ext === "docx") return <File className="h-5 w-5 text-primary-500" />;
  if (ext === "txt") return <FileText className="h-5 w-5 text-gray-500" />;
  return <File className="h-5 w-5 text-gray-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadZone({
  onFileAccepted,
  uploadedFileName,
  isUploading,
  error,
  onRemove,
  className,
}: FileUploadZoneProps) {
  const [dragFile, setDragFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;
      setDragFile(file);
      // Simulate upload progress (real progress would come from axios onUploadProgress)
      setUploadProgress(0);
      const interval = setInterval(() => {
        setUploadProgress((p) => {
          if (p >= 90) {
            clearInterval(interval);
            return 90;
          }
          return p + 15;
        });
      }, 200);

      try {
        await onFileAccepted(file);
        setUploadProgress(100);
      } finally {
        clearInterval(interval);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
        ".docx",
      ],
      "text/plain": [".txt"],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: isUploading,
  });

  // ── Uploaded state ──
  if (uploadedFileName && !isUploading) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-success-200 dark:border-success-700/50 bg-success-50 dark:bg-success-900/20 p-4",
          "animate-fade-in",
          className
        )}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-100 dark:bg-success-900/40">
          {getFileIcon(uploadedFileName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {uploadedFileName}
          </p>
          <p className="flex items-center gap-1 text-xs text-success-600 dark:text-success-400">
            <CheckCircle2 className="h-3 w-3" />
            Uploaded and parsed successfully
          </p>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }

  // ── Uploading state ──
  if (isUploading && dragFile) {
    return (
      <div
        className={cn(
          "rounded-xl border border-primary-200 dark:border-primary-700/50 bg-primary-50 dark:bg-primary-900/20 p-6",
          className
        )}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100 dark:bg-primary-900/40">
            <Loader2 className="h-5 w-5 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {dragFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatFileSize(dragFile.size)} — Uploading and parsing...
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 w-full rounded-full bg-primary-100 dark:bg-primary-900/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary-500 transition-all duration-300 ease-out"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      </div>
    );
  }

  // ── Dropzone state ──
  return (
    <div className={className}>
      <div
        {...getRootProps()}
        className={cn(
          "group relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200",
          isDragActive
            ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 scale-[1.01]"
            : "border-gray-300 dark:border-surface-600 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-gray-50 dark:hover:bg-surface-800/50"
        )}
      >
        <input {...getInputProps()} />
        <div
          className={cn(
            "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200",
            isDragActive
              ? "bg-primary-100 dark:bg-primary-900/40"
              : "bg-gray-100 dark:bg-surface-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/30"
          )}
        >
          <Upload
            className={cn(
              "h-6 w-6 transition-colors duration-200",
              isDragActive
                ? "text-primary-600 dark:text-primary-400"
                : "text-gray-400 group-hover:text-primary-500"
            )}
          />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          {isDragActive
            ? "Drop your resume here"
            : "Drag and drop your resume, or click to browse"}
        </p>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          PDF, DOCX, or TXT — up to 10 MB
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className={cn(
            "mt-3 flex items-center gap-2 rounded-lg p-3 text-sm",
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
    </div>
  );
}
