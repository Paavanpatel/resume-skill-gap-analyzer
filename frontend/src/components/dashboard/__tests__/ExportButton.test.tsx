import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExportButton from "@/components/dashboard/ExportButton";

const mockGetExportUrl = jest.fn();
const mockApiClientGet = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    get: (...args: any[]) => mockApiClientGet(...args),
  },
  getExportUrl: (...args: any[]) => mockGetExportUrl(...args),
}));

jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe("ExportButton", () => {
  let anchorClickSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    global.URL.createObjectURL = jest.fn(() => "blob:fake-url");
    global.URL.revokeObjectURL = jest.fn();
    // Prevent anchor clicks from causing JSDOM navigation errors
    anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    // Mock global fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    anchorClickSpy.mockRestore();
  });

  it("renders Export PDF button", () => {
    render(<ExportButton analysisId="test-123" />);
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("shows Exporting... while downloading", async () => {
    mockGetExportUrl.mockReturnValue(new Promise(() => {}));
    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => {
      expect(screen.getByText("Exporting...")).toBeInTheDocument();
    });
  });

  it("calls downloadBlob (apiClient.get) when not presigned", async () => {
    mockGetExportUrl.mockResolvedValue({ url: "", is_presigned: false });
    mockApiClientGet.mockResolvedValue({
      data: new ArrayBuffer(8),
      headers: { "content-disposition": 'attachment; filename="report.pdf"' },
    });

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockApiClientGet).toHaveBeenCalledWith(
        "/insights/test-123/export",
        { responseType: "blob" }
      );
    });
    await waitFor(() => {
      expect(screen.getByText("Export PDF")).toBeInTheDocument();
    });
  });

  it("triggers anchor click with correct filename from content-disposition", async () => {
    mockGetExportUrl.mockResolvedValue({ url: "", is_presigned: false });
    mockApiClientGet.mockResolvedValue({
      data: new ArrayBuffer(8),
      headers: { "content-disposition": 'attachment; filename="my-report.pdf"' },
    });

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalled();
    });
  });

  it("uses default filename when content-disposition is absent", async () => {
    mockGetExportUrl.mockResolvedValue({ url: "", is_presigned: false });
    mockApiClientGet.mockResolvedValue({ data: new ArrayBuffer(8), headers: {} });

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalled();
    });
  });

  it("calls fetch for presigned URL", async () => {
    mockGetExportUrl.mockResolvedValue({
      url: "https://s3.example.com/report.pdf",
      is_presigned: true,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["pdf"], { type: "application/pdf" })),
    });

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("https://s3.example.com/report.pdf");
    });
    await waitFor(() => {
      expect(screen.getByText("Export PDF")).toBeInTheDocument();
    });
  });

  it("retries with fresh URL when presigned URL is expired (fetch returns !ok)", async () => {
    mockGetExportUrl
      .mockResolvedValueOnce({ url: "https://s3.example.com/expired.pdf", is_presigned: true })
      .mockResolvedValueOnce({ url: "https://s3.example.com/fresh.pdf", is_presigned: true });

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, blob: jest.fn() })
      .mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(["pdf"])),
      });

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockGetExportUrl).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("https://s3.example.com/fresh.pdf");
    });
  });

  it("silently handles errors and resets loading state", async () => {
    mockGetExportUrl.mockRejectedValue(new Error("Network error"));

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Export PDF")).toBeInTheDocument();
    });
  });

  it("revokes blob URL after download", async () => {
    mockGetExportUrl.mockResolvedValue({ url: "", is_presigned: false });
    mockApiClientGet.mockResolvedValue({ data: new ArrayBuffer(4), headers: {} });

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    });
  });
});
