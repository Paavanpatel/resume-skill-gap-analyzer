"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import Button from "@/components/ui/Button";
import { apiClient } from "@/lib/api";

interface ExportButtonProps {
  analysisId: string;
}

export default function ExportButton({ analysisId }: ExportButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleExport() {
    setIsDownloading(true);
    try {
      const response = await apiClient.get(
        `/insights/${analysisId}/export`,
        { responseType: "blob" }
      );

      // Get filename from Content-Disposition header or use default
      const disposition = response.headers["content-disposition"];
      let filename = "skillgap-report.pdf";
      if (disposition) {
        const match = disposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Download the blob
      const blob = new Blob([response.data], { type: "application/pdf" });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Silently fail -- user can try again
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      isLoading={isDownloading}
    >
      <FileText className="h-4 w-4" />
      {isDownloading ? "Exporting..." : "Export PDF"}
    </Button>
  );
}
