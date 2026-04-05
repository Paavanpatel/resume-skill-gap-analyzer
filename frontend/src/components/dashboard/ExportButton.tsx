"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import { apiClient, getExportUrl } from "@/lib/api";

interface ExportButtonProps {
  analysisId: string;
}

/**
 * Downloads the PDF analysis report.
 *
 * Strategy:
 *  1. Call GET /insights/{id}/export-url to get a download URL.
 *  2a. If `is_presigned` → open the URL directly (browser downloads from S3/MinIO).
 *  2b. If not presigned (local backend) → fetch the blob through the API and
 *      trigger a local download — same as before, but authenticated.
 *  3. If the presigned URL is expired (403), re-fetch once and retry.
 */
export default function ExportButton({ analysisId }: ExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function downloadBlob() {
    const response = await apiClient.get(`/insights/${analysisId}/export`, {
      responseType: "blob",
    });
    const disposition = response.headers["content-disposition"];
    let filename = "skillgap-report.pdf";
    if (disposition) {
      const match = disposition.match(/filename="(.+)"/);
      if (match) filename = match[1];
    }
    const blob = new Blob([response.data], { type: "application/pdf" });
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  }

  async function openPresignedUrl(url: string): Promise<boolean> {
    // Fetch the PDF bytes directly — this works for both expiry detection
    // and actual download without CORS issues (presigned URLs allow GET only,
    // not HEAD, so a HEAD probe would always 403).
    const response = await fetch(url);
    if (!response.ok) return false;
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = "skillgap-report.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    return true;
  }

  async function handleExport() {
    setIsDownloading(true);
    try {
      const { url, is_presigned } = await getExportUrl(analysisId);

      if (!is_presigned || !url) {
        // Local backend — proxy bytes through API
        await downloadBlob();
        return;
      }

      // S3 presigned URL — open directly
      const ok = await openPresignedUrl(url);
      if (!ok) {
        // URL expired between fetch and use — re-fetch once and retry
        const retry = await getExportUrl(analysisId);
        if (retry.url) {
          await openPresignedUrl(retry.url);
        }
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} isLoading={isDownloading}>
      <FileText className="h-4 w-4" />
      {isDownloading ? "Exporting..." : "Export PDF"}
    </Button>
  );
}
