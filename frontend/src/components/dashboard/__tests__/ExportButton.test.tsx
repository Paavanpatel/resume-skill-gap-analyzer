import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ExportButton from "@/components/dashboard/ExportButton";

// Mock the API client
jest.mock("@/lib/api", () => ({
  apiClient: {
    get: jest.fn(),
  },
  getExportUrl: jest.fn(() => new Promise(() => {})),
}));

describe("ExportButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Export PDF button", () => {
    render(<ExportButton analysisId="test-123" />);
    expect(screen.getByText("Export PDF")).toBeInTheDocument();
  });

  it("renders FileText icon", () => {
    render(<ExportButton analysisId="test-123" />);
    expect(screen.getByTestId("icon-FileText")).toBeInTheDocument();
  });

  it("shows exporting text when downloading", async () => {
    const { apiClient } = require("@/lib/api");
    // Make it hang so we can check loading state
    apiClient.get.mockReturnValue(new Promise(() => {}));

    render(<ExportButton analysisId="test-123" />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Exporting...")).toBeInTheDocument();
    });
  });
});
