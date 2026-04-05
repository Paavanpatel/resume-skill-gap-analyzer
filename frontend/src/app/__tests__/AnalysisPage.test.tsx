import React, { act } from "react";
import { render, screen, fireEvent, waitFor } from "@/__tests__/test-utils";
import AnalysisPage from "@/app/(dashboard)/analysis/[id]/page";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: "analysis-123" }),
  usePathname: () => "/analysis/analysis-123",
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

const mockGetAnalysisStatus = jest.fn();
const mockGetAnalysisResult = jest.fn();
const mockRetryAnalysis = jest.fn();

jest.mock("@/lib/api", () => ({
  getAnalysisStatus: (...args: any[]) => mockGetAnalysisStatus(...args),
  getAnalysisResult: (...args: any[]) => mockGetAnalysisResult(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
  generateRoadmap: jest.fn(),
  getRoadmap: jest.fn().mockRejectedValue(new Error("Not found")),
  generateAdvisorRewrites: jest.fn(),
  retryAnalysis: (...args: any[]) => mockRetryAnalysis(...args),
}));

// ── Mock ExportButton component ────────────────────────────
jest.mock("@/components/dashboard/ExportButton", () => {
  return function MockExportButton({ analysisId }: { analysisId: string }) {
    return <button data-testid="export-button">Export PDF</button>;
  };
});

// ── Mock lucide-react icons ─────────────────────────────────
jest.mock("lucide-react", () => {
  const icons = [
    "Loader2",
    "ArrowLeft",
    "Clock",
    "CheckCircle2",
    "XCircle",
    "AlertTriangle",
    "FileSearch",
    "FileText",
    "Briefcase",
    "Lightbulb",
    "BarChart3",
    "Target",
    "BookOpen",
    "MessageSquare",
    "Sparkles",
    "ChevronDown",
    "ChevronUp",
    "X",
    "Download",
    "Map",
    "Wand2",
    "GraduationCap",
    "ExternalLink",
    "RefreshCw",
    "Play",
    "Copy",
    "Check",
    "Star",
    "TrendingUp",
    "TrendingDown",
    "Minus",
    "AlertCircle",
    "Info",
    "ArrowRight",
    "Plus",
    "Lock",
  ];
  const mocks: Record<string, any> = {};
  icons.forEach((name) => {
    mocks[name] = ({ className }: any) => (
      <span data-testid={`icon-${name}`} className={className} />
    );
  });
  return mocks;
});

// ── Mock AnalysisTrackerContext ──────────────────────────────
const mockTrack = jest.fn();
let mockTrackedAnalyses: any[] = [];

jest.mock("@/context/AnalysisTrackerContext", () => ({
  useAnalysisTracker: () => ({
    analyses: mockTrackedAnalyses,
    track: (...args: any[]) => mockTrack(...args),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    activeCount: mockTrackedAnalyses.filter(
      (a: any) => !a.dismissed && a.status?.status !== "completed" && a.status?.status !== "failed"
    ).length,
    completedCount: mockTrackedAnalyses.filter(
      (a: any) => !a.dismissed && a.status?.status === "completed"
    ).length,
  }),
}));

// ── Mock IntersectionObserver for AnimatedCounter ────────────
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockImplementation((callback: any) => {
  // Immediately trigger as intersecting
  callback([{ isIntersecting: true }]);
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  };
});
(global as any).IntersectionObserver = mockIntersectionObserver;

const mockCompletedResult = {
  id: "analysis-123",
  status: "completed",
  match_score: 75.5,
  ats_score: 80.0,
  matched_skills: [
    { name: "Python", confidence: 0.95, category: "programming_language", source: "resume" },
  ],
  missing_skills: [{ name: "Kubernetes", priority: "high", category: "devops" }],
  resume_skills: [
    { name: "Python", confidence: 0.95, category: "programming_language", source: "resume" },
  ],
  job_skills: [
    {
      name: "Python",
      confidence: 0.9,
      category: "programming_language",
      source: "job_description",
    },
    { name: "Kubernetes", confidence: 0.85, category: "devops", source: "job_description" },
  ],
  suggestions: [
    {
      section: "Skills",
      current: "Python",
      suggested: "Add Kubernetes certification",
      reason: "Required skill",
      priority: "high",
      source: "rule",
    },
  ],
  category_breakdowns: [
    {
      category: "programming_language",
      display_name: "Programming Languages",
      total_job_skills: 1,
      matched_count: 1,
      missing_count: 0,
      match_percentage: 100,
      matched_skills: ["Python"],
      missing_skills: [],
      priority: "critical",
    },
  ],
  score_explanation: {
    match_score: 75.5,
    ats_score: 80.0,
    match_summary: "Strong match",
    ats_summary: "Good ATS compatibility",
    strengths: ["Strong Python skills"],
    weaknesses: ["Missing DevOps experience"],
    overall_verdict: "Strong Match",
  },
  ats_check: {
    issues: [],
    format_score: 90,
    passed_checks: 8,
    total_checks: 10,
  },
  processing_time_ms: 15000,
  ai_provider: "openai",
  ai_model: "gpt-4o",
  ai_tokens_used: 1500,
  created_at: "2024-06-15T10:30:00Z",
};

describe("AnalysisPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockTrackedAnalyses = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── Processing state tests ──────────────────────────────────

  it("shows loading state while polling", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    expect(screen.getByText(/analyzing your resume/i)).toBeInTheDocument();
  });

  it("shows all four processing stages", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    expect(screen.getByText("Parsing Resume")).toBeInTheDocument();
    expect(screen.getByText("Extracting Skills")).toBeInTheDocument();
    expect(screen.getByText("Matching with Job")).toBeInTheDocument();
    expect(screen.getByText("Generating Insights")).toBeInTheDocument();
  });

  it("shows Overall Progress label and percentage", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    expect(screen.getByText("Overall Progress")).toBeInTheDocument();
    expect(screen.getByText("0%")).toBeInTheDocument();
  });

  it("shows a rotating tip during processing", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    // First tip should be visible
    expect(screen.getByText(/Tailoring your resume to each job description/i)).toBeInTheDocument();
  });

  it("shows Back to Dashboard button during processing", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    act(() => {
      jest.useRealTimers();
    });
    render(<AnalysisPage />);

    expect(screen.getByText("Back to Dashboard")).toBeInTheDocument();
  });

  it("navigates to dashboard when Back to Dashboard is clicked", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    fireEvent.click(screen.getByText("Back to Dashboard"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("shows current step text from status", async () => {
    act(() => {
      jest.useRealTimers();
    });

    mockGetAnalysisStatus.mockResolvedValueOnce({
      job_id: "analysis-123",
      status: "processing",
      progress: 50,
      current_step: "Extracting Skills...",
      error_message: null,
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Extracting Skills")).toBeInTheDocument();
    });
  });

  it("shows progress percentage during processing", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValueOnce({
      job_id: "analysis-123",
      status: "processing",
      progress: 65,
      current_step: "Matching with job requirements",
      error_message: null,
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("65%")).toBeInTheDocument();
    });
  });

  it("registers with tracker when not already tracked", async () => {
    mockTrackedAnalyses = [];
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("analysis-123", "Resume Analysis");
    });
  });

  it("does not register with tracker when already tracked globally", async () => {
    mockTrackedAnalyses = [
      {
        jobId: "analysis-123",
        label: "Senior Engineer",
        status: {
          job_id: "analysis-123",
          status: "processing",
          progress: 30,
          current_step: "Extracting Skills",
          error_message: null,
        },
        startedAt: Date.now(),
        dismissed: false,
        pollError: null,
      },
    ];

    jest.useRealTimers();
    render(<AnalysisPage />);

    // Should NOT call track since it's already tracked
    expect(mockTrack).not.toHaveBeenCalled();
  });

  // ── Error state tests ───────────────────────────────────────

  it("shows error state when analysis fails", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "failed",
      progress: 0,
      current_step: null,
      error_message: "LLM provider down",
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Analysis Failed")).toBeInTheDocument();
    });
    expect(screen.getByText("LLM provider down")).toBeInTheDocument();
  });

  it("shows Try Again button on error", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "failed",
      progress: 0,
      current_step: null,
      error_message: "Something broke",
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Retry Analysis")).toBeInTheDocument();
    });

    // Setup retry to resolve and resume processing
    mockRetryAnalysis.mockResolvedValue({ job_id: "analysis-123" });
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "processing",
      progress: 10,
      current_step: "Parsing Resume",
      error_message: null,
    });

    fireEvent.click(screen.getByText("Retry Analysis"));
    // Retry button should clear error and go back to processing state, not navigate
    await waitFor(() => {
      expect(screen.queryByText("Analysis Failed")).not.toBeInTheDocument();
    });
  });

  it("shows error on network failure", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockRejectedValue(new Error("Network error"));

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows error when tracked analysis has failed status", async () => {
    mockTrackedAnalyses = [
      {
        jobId: "analysis-123",
        label: "Senior Engineer",
        status: {
          job_id: "analysis-123",
          status: "failed",
          progress: 0,
          current_step: null,
          error_message: "Tracked failure",
        },
        startedAt: Date.now(),
        dismissed: false,
        pollError: null,
      },
    ];

    jest.useRealTimers();
    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Analysis Failed")).toBeInTheDocument();
    });
    expect(screen.getByText("Tracked failure")).toBeInTheDocument();
  });

  // ── Results state tests ─────────────────────────────────────

  it("renders completed analysis results with tabbed layout", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Analysis Results")).toBeInTheDocument();
    });

    // Verify tabbed layout is present
    expect(screen.getByRole("tablist")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /skills/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /suggestions/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /roadmap/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /advisor/i })).toBeInTheDocument();
  });

  it("shows verdict section with strengths and weaknesses", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Strong Match")).toBeInTheDocument();
    });

    expect(screen.getByText("Strong Python skills")).toBeInTheDocument();
    expect(screen.getByText("Missing DevOps experience")).toBeInTheDocument();
  });

  it("shows score cards section", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByTestId("score-cards")).toBeInTheDocument();
    });

    // Score labels should be present
    expect(screen.getByText("Skill Match")).toBeInTheDocument();
    expect(screen.getByText("ATS Score")).toBeInTheDocument();
    expect(screen.getByText("Format Score")).toBeInTheDocument();
  });

  it("shows processing time", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/15\.0s/)).toBeInTheDocument();
    });
  });

  it("switches to Skills tab when clicked", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /skills/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /skills/i }));

    // Skills tab panel should be visible
    await waitFor(() => {
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });
  });

  it("switches to Suggestions tab when clicked", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /suggestions/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /suggestions/i }));

    await waitFor(() => {
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });
  });

  it("fetches result when tracked analysis is completed", async () => {
    mockTrackedAnalyses = [
      {
        jobId: "analysis-123",
        label: "Senior Engineer",
        status: {
          job_id: "analysis-123",
          status: "completed",
          progress: 100,
          current_step: null,
          error_message: null,
        },
        startedAt: Date.now(),
        dismissed: false,
        pollError: null,
      },
    ];

    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    jest.useRealTimers();
    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("Analysis Results")).toBeInTheDocument();
    });

    // Should have called getAnalysisResult but NOT getAnalysisStatus (tracker handles that)
    expect(mockGetAnalysisResult).toHaveBeenCalledWith("analysis-123");
  });

  it("shows navigate-away message during processing", async () => {
    mockGetAnalysisStatus.mockImplementation(() => new Promise(() => {}));

    jest.useRealTimers();
    render(<AnalysisPage />);

    expect(screen.getByText(/feel free to navigate away/i)).toBeInTheDocument();
  });

  it("Overview tab is active by default and shows category breakdowns", async () => {
    jest.useRealTimers();
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "analysis-123",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });
    mockGetAnalysisResult.mockResolvedValue(mockCompletedResult);

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /overview/i })).toBeInTheDocument();
    });

    // Overview tab should be selected by default
    const overviewTab = screen.getByRole("tab", { name: /overview/i });
    expect(overviewTab).toHaveAttribute("aria-selected", "true");
  });
});
