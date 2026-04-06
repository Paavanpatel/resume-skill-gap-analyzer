import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DashboardPage from "@/app/(dashboard)/dashboard/page";
import * as api from "@/lib/api";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard",
}));

const mockUploadResume = jest.fn();
const mockSubmitAnalysis = jest.fn();

const mockGetHealthLive = jest.fn();

jest.mock("@/lib/api", () => ({
  uploadResume: (...args: any[]) => mockUploadResume(...args),
  submitAnalysis: (...args: any[]) => mockSubmitAnalysis(...args),
  getUsageSummary: jest.fn().mockResolvedValue({
    period: "monthly",
    tier: "free",
    analyses: { used: 1, limit: 10, pct: 10 },
  }),
  getHealthLive: (...args: any[]) => mockGetHealthLive(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

const mockTrack = jest.fn();

jest.mock("@/context/AnalysisTrackerContext", () => ({
  useAnalysisTracker: () => ({
    analyses: [],
    track: (...args: any[]) => mockTrack(...args),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    activeCount: 0,
    completedCount: 0,
  }),
}));

// Mock react-dropzone
jest.mock("react-dropzone", () => ({
  useDropzone: ({ onDrop }: any) => ({
    getRootProps: () => ({
      onClick: () => {
        const file = new File(["resume content"], "resume.pdf", {
          type: "application/pdf",
        });
        onDrop([file]);
      },
    }),
    getInputProps: () => ({}),
    isDragActive: false,
  }),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Upload: (props: any) => <span data-testid="icon-upload" {...props} />,
  FileText: (props: any) => <span data-testid="icon-file-text" {...props} />,
  File: (props: any) => <span data-testid="icon-file" {...props} />,
  Briefcase: (props: any) => <span data-testid="icon-briefcase" {...props} />,
  ArrowRight: (props: any) => <span data-testid="icon-arrow-right" {...props} />,
  ArrowLeft: (props: any) => <span data-testid="icon-arrow-left" {...props} />,
  CheckCircle2: (props: any) => <span data-testid="icon-check-circle" {...props} />,
  Sparkles: (props: any) => <span data-testid="icon-sparkles" {...props} />,
  Loader2: (props: any) => <span data-testid="icon-loader" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
  Check: (props: any) => <span data-testid="icon-check" {...props} />,
  AlertCircle: (props: any) => <span data-testid="icon-alert" {...props} />,
  ClipboardPaste: (props: any) => <span data-testid="icon-paste" {...props} />,
}));

jest.mock("@/components/dashboard/UsageWidget", () => ({
  __esModule: true,
  default: () => <div data-testid="usage-widget" />,
}));

const LONG_JD =
  "We need a senior backend engineer with 5+ years of Python experience building scalable web applications.";

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetHealthLive.mockResolvedValue({ status: "ok", timestamp: Date.now() });
    (api.getUsageSummary as jest.Mock).mockResolvedValue({
      period: "monthly",
      tier: "free",
      analyses: { used: 1, limit: 10, pct: 10 },
    });
  });

  it("renders the upload step initially with progress stepper", () => {
    render(<DashboardPage />);
    expect(screen.getByText("New Analysis")).toBeInTheDocument();
    expect(screen.getByText("Choose Resume")).toBeInTheDocument();
    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    // Progress stepper labels
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Describe")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("shows file format info", () => {
    render(<DashboardPage />);
    expect(screen.getByText(/PDF, DOCX, or TXT/i)).toBeInTheDocument();
  });

  it("transitions to describe step after upload", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "my_resume.pdf",
    });

    render(<DashboardPage />);

    const dropzone = screen.getByText(/drag and drop/i).closest("div");
    fireEvent.click(dropzone!);

    await waitFor(() => {
      expect(screen.getByText("my_resume.pdf")).toBeInTheDocument();
    });

    // Job description form should appear
    expect(screen.getByText("Job Description")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Senior Backend/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Acme Corp/i)).toBeInTheDocument();
  });

  it("disables Review button when description is too short", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });

    render(<DashboardPage />);

    const dropzone = screen.getByText(/drag and drop/i).closest("div");
    fireEvent.click(dropzone!);

    await waitFor(() => {
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    });

    const textarea = screen.getByPlaceholderText(/Paste the full job description/i);
    fireEvent.change(textarea, { target: { value: "Short" } });

    const reviewBtn = screen.getByRole("button", { name: /review & submit/i });
    expect(reviewBtn).toBeDisabled();
  });

  it("advances to review step when description is valid", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });

    render(<DashboardPage />);

    const dropzone = screen.getByText(/drag and drop/i).closest("div");
    fireEvent.click(dropzone!);

    await waitFor(() => {
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Senior Backend/i), {
      target: { value: "Senior Engineer" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Acme Corp/i), {
      target: { value: "TestCo" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });

    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));

    await waitFor(() => {
      expect(screen.getByTestId("step-review")).toBeInTheDocument();
    });

    expect(screen.getByText("Review Your Analysis")).toBeInTheDocument();
    expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Senior Engineer/)).toBeInTheDocument();
    expect(screen.getByText(/TestCo/)).toBeInTheDocument();
  });

  it("shows confirmation modal before submission", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });

    render(<DashboardPage />);

    // Upload
    const dropzone = screen.getByText(/drag and drop/i).closest("div");
    fireEvent.click(dropzone!);

    await waitFor(() => {
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    });

    // Fill
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));

    await waitFor(() => {
      expect(screen.getByText("Review Your Analysis")).toBeInTheDocument();
    });

    // Click Analyze My Resume — should open modal
    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));

    await waitFor(() => {
      expect(screen.getByText("Start Analysis?")).toBeInTheDocument();
    });

    expect(screen.getByText(/analysis typically takes/i)).toBeInTheDocument();
  });

  it("submits and shows success state after confirmation", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });
    mockSubmitAnalysis.mockResolvedValue({
      job_id: "analysis-456",
      status: "queued",
    });

    render(<DashboardPage />);

    // Upload
    const dropzone = screen.getByText(/drag and drop/i).closest("div");
    fireEvent.click(dropzone!);

    await waitFor(() => {
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    });

    // Fill with job title
    fireEvent.change(screen.getByPlaceholderText(/Senior Backend/i), {
      target: { value: "Senior Engineer" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });

    // Review
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));

    await waitFor(() => {
      expect(screen.getByText("Review Your Analysis")).toBeInTheDocument();
    });

    // Open confirm modal
    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));

    await waitFor(() => {
      expect(screen.getByText("Start Analysis?")).toBeInTheDocument();
    });

    // Confirm
    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

    await waitFor(() => {
      expect(screen.getByText("Analysis Submitted!")).toBeInTheDocument();
    });

    expect(mockTrack).toHaveBeenCalledWith("analysis-456", "Senior Engineer");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows View Progress and Start Another buttons after submission", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });
    mockSubmitAnalysis.mockResolvedValue({
      job_id: "analysis-456",
      status: "queued",
    });

    render(<DashboardPage />);

    // Full flow: upload → describe → review → confirm
    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);

    await waitFor(() => {
      expect(screen.getByText("resume.pdf")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));

    await waitFor(() => {
      expect(screen.getByText("Review Your Analysis")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));

    await waitFor(() => {
      expect(screen.getByText("Start Analysis?")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

    await waitFor(() => {
      expect(screen.getByText("Analysis Submitted!")).toBeInTheDocument();
    });

    expect(screen.getByText("View Progress")).toBeInTheDocument();
    expect(screen.getByText("Start Another Analysis")).toBeInTheDocument();
  });

  it("navigates to analysis page when View Progress is clicked", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });
    mockSubmitAnalysis.mockResolvedValue({
      job_id: "analysis-456",
      status: "queued",
    });

    render(<DashboardPage />);

    // Full flow
    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);
    await waitFor(() => expect(screen.getByText("resume.pdf")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));
    await waitFor(() => expect(screen.getByText("Review Your Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));
    await waitFor(() => expect(screen.getByText("Start Analysis?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));
    await waitFor(() => expect(screen.getByText("View Progress")).toBeInTheDocument());

    fireEvent.click(screen.getByText("View Progress"));
    expect(mockPush).toHaveBeenCalledWith("/analysis/analysis-456");
  });

  it("resets form when Start Another Analysis is clicked", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });
    mockSubmitAnalysis.mockResolvedValue({
      job_id: "analysis-456",
      status: "queued",
    });

    render(<DashboardPage />);

    // Full flow
    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);
    await waitFor(() => expect(screen.getByText("resume.pdf")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));
    await waitFor(() => expect(screen.getByText("Review Your Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));
    await waitFor(() => expect(screen.getByText("Start Analysis?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));
    await waitFor(() => expect(screen.getByText("Start Another Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Start Another Analysis"));

    expect(screen.getByText(/drag and drop/i)).toBeInTheDocument();
    expect(screen.queryByText("Analysis Submitted!")).not.toBeInTheDocument();
  });

  it("uses filename as label when no job title provided", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "my_resume.pdf",
    });
    mockSubmitAnalysis.mockResolvedValue({
      job_id: "analysis-456",
      status: "queued",
    });

    render(<DashboardPage />);

    // Upload
    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);
    await waitFor(() => expect(screen.getByText("my_resume.pdf")).toBeInTheDocument());

    // Only fill description (no title)
    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));
    await waitFor(() => expect(screen.getByText("Review Your Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));
    await waitFor(() => expect(screen.getByText("Start Analysis?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("analysis-456", "my_resume.pdf");
    });
  });

  it("shows error on upload failure", async () => {
    mockUploadResume.mockRejectedValue(new Error("File too large"));

    render(<DashboardPage />);

    const dropzone = screen.getByText(/drag and drop/i).closest("div");
    fireEvent.click(dropzone!);

    await waitFor(() => {
      expect(screen.getByText("File too large")).toBeInTheDocument();
    });
  });

  it("shows error on submission failure and returns to describe step", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });
    mockSubmitAnalysis.mockRejectedValue(new Error("Server error"));

    render(<DashboardPage />);

    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);
    await waitFor(() => expect(screen.getByText("resume.pdf")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));
    await waitFor(() => expect(screen.getByText("Review Your Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));
    await waitFor(() => expect(screen.getByText("Start Analysis?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /start analysis/i }));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });

    // Should be back on describe step
    expect(screen.queryByText("Analysis Submitted!")).not.toBeInTheDocument();
  });

  it("navigates back from describe to upload step", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);
    await waitFor(() => expect(screen.getByText("resume.pdf")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByTestId("step-upload")).toBeInTheDocument();
  });

  it("navigates back from review to describe step", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);
    await waitFor(() => expect(screen.getByText("resume.pdf")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));
    await waitFor(() => expect(screen.getByText("Review Your Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    expect(screen.getByTestId("step-describe")).toBeInTheDocument();
  });

  it("can cancel the confirmation modal", async () => {
    mockUploadResume.mockResolvedValue({
      id: "resume-123",
      original_filename: "resume.pdf",
    });

    render(<DashboardPage />);

    fireEvent.click(screen.getByText(/drag and drop/i).closest("div")!);

    // Wait for upload to complete and filename to appear
    await waitFor(() => expect(screen.getByText("resume.pdf")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Paste the full job description/i), {
      target: { value: LONG_JD },
    });
    fireEvent.click(screen.getByRole("button", { name: /review & submit/i }));
    await waitFor(() => expect(screen.getByText("Review Your Analysis")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /analyze my resume/i }));
    await waitFor(() => expect(screen.getByText("Start Analysis?")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    // Modal should close, still on review step
    expect(screen.queryByText("Start Analysis?")).not.toBeInTheDocument();
    expect(screen.getByText("Review Your Analysis")).toBeInTheDocument();
  });

  it("shows healthy status when backend is reachable", async () => {
    mockGetHealthLive.mockResolvedValue({ status: "ok", timestamp: Date.now() });

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("All systems operational")).toBeInTheDocument();
    });
  });

  it("shows error status when backend is unreachable", async () => {
    mockGetHealthLive.mockRejectedValue(new Error("Network Error"));

    render(<DashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Backend unavailable — some features may not work")
      ).toBeInTheDocument();
    });
  });
});
