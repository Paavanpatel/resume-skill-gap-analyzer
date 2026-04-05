import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import FloatingAnalysisTracker from "@/components/ui/FloatingAnalysisTracker";
import type { TrackedAnalysis } from "@/context/AnalysisTrackerContext";

// ── Mock next/navigation ────────────────────────────────────

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/dashboard",
}));

// ── Mock AuthContext ────────────────────────────────────────

let mockIsAuthenticated = true;

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isLoading: false,
    user: { id: "u1", email: "test@test.com", full_name: "Test" },
  }),
}));

// ── Mock AnalysisTrackerContext ──────────────────────────────

let mockAnalyses: TrackedAnalysis[] = [];
const mockDismiss = jest.fn();
const mockDismissAll = jest.fn();
let mockActiveCount = 0;
let mockCompletedCount = 0;

jest.mock("@/context/AnalysisTrackerContext", () => ({
  useAnalysisTracker: () => ({
    analyses: mockAnalyses,
    track: jest.fn(),
    dismiss: (...args: any[]) => mockDismiss(...args),
    dismissAll: (...args: any[]) => mockDismissAll(...args),
    activeCount: mockActiveCount,
    completedCount: mockCompletedCount,
  }),
  // Re-export the type so it's available for imports
}));

// ── Helpers ─────────────────────────────────────────────────

function makeAnalysis(overrides: Partial<TrackedAnalysis> = {}): TrackedAnalysis {
  return {
    jobId: "job-1",
    label: "Senior Engineer",
    status: {
      job_id: "job-1",
      status: "processing",
      progress: 50,
      current_step: "Extracting skills",
      error_message: null,
    },
    startedAt: Date.now() - 10000,
    dismissed: false,
    pollError: null,
    transport: "websocket",
    wsStatus: "connected",
    ...overrides,
  };
}

describe("FloatingAnalysisTracker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsAuthenticated = true;
    mockAnalyses = [];
    mockActiveCount = 0;
    mockCompletedCount = 0;
  });

  it("renders nothing when no analyses are tracked", () => {
    const { container } = render(<FloatingAnalysisTracker />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when user is not authenticated", () => {
    mockIsAuthenticated = false;
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    const { container } = render(<FloatingAnalysisTracker />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when all analyses are dismissed", () => {
    mockAnalyses = [makeAnalysis({ dismissed: true })];
    mockActiveCount = 0;

    const { container } = render(<FloatingAnalysisTracker />);
    expect(container.firstChild).toBeNull();
  });

  it("shows active analysis count in the pill button", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);
    expect(screen.getByText("1 analysis running")).toBeInTheDocument();
  });

  it("shows plural text for multiple active analyses", () => {
    mockAnalyses = [
      makeAnalysis({ jobId: "job-1" }),
      makeAnalysis({ jobId: "job-2", label: "Data Scientist" }),
    ];
    mockActiveCount = 2;

    render(<FloatingAnalysisTracker />);
    expect(screen.getByText("2 analyses running")).toBeInTheDocument();
  });

  it("shows completed count when no active analyses", () => {
    mockAnalyses = [
      makeAnalysis({
        status: {
          job_id: "job-1",
          status: "completed",
          progress: 100,
          current_step: null,
          error_message: null,
        },
      }),
    ];
    mockActiveCount = 0;
    mockCompletedCount = 1;

    render(<FloatingAnalysisTracker />);
    expect(screen.getByText("1 ready to view")).toBeInTheDocument();
  });

  it("expands panel on pill click", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);

    // Panel header should NOT be visible initially
    expect(screen.queryByText("Analysis Progress")).not.toBeInTheDocument();

    // Click the pill
    fireEvent.click(screen.getByText("1 analysis running"));

    // Panel should now be visible
    expect(screen.getByText("Analysis Progress")).toBeInTheDocument();
    expect(screen.getByText("Senior Engineer")).toBeInTheDocument();
  });

  it("collapses panel on second pill click", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);

    const pill = screen.getByText("1 analysis running");
    fireEvent.click(pill); // expand
    expect(screen.getByText("Analysis Progress")).toBeInTheDocument();

    fireEvent.click(pill); // collapse
    expect(screen.queryByText("Analysis Progress")).not.toBeInTheDocument();
  });

  it("shows current step text for active analysis", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 analysis running"));

    expect(screen.getByText("Extracting skills")).toBeInTheDocument();
  });

  it("shows starting text when no current step", () => {
    mockAnalyses = [makeAnalysis({ status: null })];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 analysis running"));

    expect(screen.getByText("Starting analysis...")).toBeInTheDocument();
  });

  it("shows error message for failed analysis", () => {
    mockAnalyses = [
      makeAnalysis({
        status: {
          job_id: "job-1",
          status: "failed",
          progress: 0,
          current_step: null,
          error_message: "LLM provider error",
        },
      }),
    ];
    mockActiveCount = 0;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByRole("button"));

    expect(screen.getByText("LLM provider error")).toBeInTheDocument();
  });

  it("calls dismiss when dismiss button is clicked", () => {
    mockAnalyses = [
      makeAnalysis({
        status: {
          job_id: "job-1",
          status: "completed",
          progress: 100,
          current_step: null,
          error_message: null,
        },
      }),
    ];
    mockActiveCount = 0;
    mockCompletedCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 ready to view"));

    const dismissBtn = screen.getByTitle("Dismiss");
    fireEvent.click(dismissBtn);

    expect(mockDismiss).toHaveBeenCalledWith("job-1");
  });

  it("navigates to analysis page on view click", () => {
    mockAnalyses = [
      makeAnalysis({
        status: {
          job_id: "job-1",
          status: "completed",
          progress: 100,
          current_step: null,
          error_message: null,
        },
      }),
    ];
    mockActiveCount = 0;
    mockCompletedCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 ready to view"));

    const viewBtn = screen.getByTitle("View results");
    fireEvent.click(viewBtn);

    expect(mockPush).toHaveBeenCalledWith("/analysis/job-1");
  });

  it("shows Clear completed button when completed analyses exist", () => {
    mockAnalyses = [
      makeAnalysis({
        status: {
          job_id: "job-1",
          status: "completed",
          progress: 100,
          current_step: null,
          error_message: null,
        },
      }),
    ];
    mockActiveCount = 0;
    mockCompletedCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 ready to view"));

    const clearBtn = screen.getByText("Clear completed");
    fireEvent.click(clearBtn);

    expect(mockDismissAll).toHaveBeenCalled();
  });

  it("does not show Clear completed button when no completed analyses", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;
    mockCompletedCount = 0;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 analysis running"));

    expect(screen.queryByText("Clear completed")).not.toBeInTheDocument();
  });

  it("does not show view/dismiss buttons for active analyses", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 analysis running"));

    expect(screen.queryByTitle("View results")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Dismiss")).not.toBeInTheDocument();
  });

  it("shows progress bar for active analysis", () => {
    mockAnalyses = [makeAnalysis()];
    mockActiveCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 analysis running"));

    // Find the progress bar by its style (50% width)
    // const progressBars = document.querySelectorAll('[class*="bg-primary-500"]');
    const progressBars = document.querySelectorAll('[style*="width"]');
    const progressBar = Array.from(progressBars).find(
      (el) => (el as HTMLElement).style.width === "50%"
    );
    expect(progressBar).toBeTruthy();
  });

  it("renders multiple analyses in the expanded panel", () => {
    mockAnalyses = [
      makeAnalysis({ jobId: "job-1", label: "Frontend Dev" }),
      makeAnalysis({
        jobId: "job-2",
        label: "Backend Engineer",
        status: {
          job_id: "job-2",
          status: "completed",
          progress: 100,
          current_step: null,
          error_message: null,
        },
      }),
    ];
    mockActiveCount = 1;
    mockCompletedCount = 1;

    render(<FloatingAnalysisTracker />);
    fireEvent.click(screen.getByText("1 analysis running"));

    expect(screen.getByText("Frontend Dev")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
  });
});
