// MUST BE FIRST - before any imports
Object.defineProperty(window, "IntersectionObserver", {
  value: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  })),
  configurable: true,
});
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ComparisonView from "@/components/dashboard/ComparisonView";

const mockGetAnalysisResult = jest.fn();

jest.mock("@/lib/api", () => ({
  getAnalysisResult: (...args: any[]) => mockGetAnalysisResult(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("lucide-react", () => ({
  ArrowUp: () => <span data-testid="icon-arrow-up" />,
  ArrowDown: () => <span data-testid="icon-arrow-down" />,
  Minus: () => <span data-testid="icon-minus" />,
  X: () => <span data-testid="icon-x" />,
  Target: () => <span data-testid="icon-target" />,
  Shield: () => <span data-testid="icon-shield" />,
  FileText: () => <span data-testid="icon-filetext" />,
  CheckCircle2: () => <span data-testid="icon-check-circle-2" />,
  XCircle: () => <span data-testid="icon-x-circle" />,
  GitCompareArrows: () => <span data-testid="icon-git-compare" />,
}));

jest.mock("@/components/ui/ScoreRing", () => {
  return function ScoreRingMock({ score, label }: any) {
    return <div data-testid={`score-ring-${label}`}>{score}%</div>;
  };
});

jest.mock("@/components/ui/AnimatedCounter", () => {
  return function AnimatedCounterMock({ value, suffix }: any) {
    return (
      <span data-testid="animated-counter">
        {value}
        {suffix}
      </span>
    );
  };
});

// // Mock IntersectionObserver for AnimatedCounter
// Object.defineProperty(window, "IntersectionObserver", {
//   value: jest.fn().mockImplementation(() => ({
//     observe: jest.fn(),
//     unobserve: jest.fn(),
//     disconnect: jest.fn(),
//   })),
// });

const mockResultA = {
  id: "analysis-1",
  status: "completed",
  match_score: 70,
  ats_score: 65,
  matched_skills: [
    { name: "React", confidence: 0.9, category: "technical" },
    { name: "TypeScript", confidence: 0.85, category: "technical" },
  ],
  missing_skills: [
    { name: "Go", priority: "high", category: "technical" },
    { name: "Kubernetes", priority: "medium", category: "technical" },
  ],
  resume_skills: [],
  job_skills: [],
  suggestions: [],
  category_breakdowns: [],
  score_explanation: null,
  ats_check: { issues: [], format_score: 60, passed_checks: 5, total_checks: 8 },
  processing_time_ms: 1000,
  ai_provider: "openai",
  ai_model: "gpt-4",
  ai_tokens_used: 500,
  created_at: "2024-06-15T10:30:00Z",
};

const mockResultB = {
  ...mockResultA,
  id: "analysis-2",
  match_score: 85,
  ats_score: 80,
  matched_skills: [
    { name: "React", confidence: 0.95, category: "technical" },
    { name: "TypeScript", confidence: 0.9, category: "technical" },
    { name: "Go", confidence: 0.7, category: "technical" },
  ],
  missing_skills: [{ name: "Rust", priority: "low", category: "technical" }],
  ats_check: { issues: [], format_score: 75, passed_checks: 7, total_checks: 8 },
  created_at: "2024-06-20T14:00:00Z",
};

describe("ComparisonView", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state while fetching", () => {
    mockGetAnalysisResult.mockImplementation(() => new Promise(() => {}));
    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);
    expect(screen.getByTestId("comparison-loading")).toBeInTheDocument();
  });

  it("shows error on fetch failure", async () => {
    mockGetAnalysisResult.mockRejectedValue(new Error("Fetch failed"));
    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);
    await waitFor(() => {
      expect(screen.getByText("Fetch failed")).toBeInTheDocument();
    });
  });

  it("renders comparison view after loading", async () => {
    mockGetAnalysisResult.mockResolvedValueOnce(mockResultA).mockResolvedValueOnce(mockResultB);

    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("comparison-view")).toBeInTheDocument();
    });

    expect(screen.getByText("Side-by-Side Comparison")).toBeInTheDocument();
  });

  it("shows score deltas", async () => {
    mockGetAnalysisResult.mockResolvedValueOnce(mockResultA).mockResolvedValueOnce(mockResultB);

    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("comparison-view")).toBeInTheDocument();
    });

    // Score Changes header
    expect(screen.getByText("Score Changes (A → B)")).toBeInTheDocument();

    // Match Score improved by 15
    expect(screen.getByTestId("delta-match-score")).toBeInTheDocument();
  });

  it("shows skill changes", async () => {
    mockGetAnalysisResult.mockResolvedValueOnce(mockResultA).mockResolvedValueOnce(mockResultB);

    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("skills-diff")).toBeInTheDocument();
    });

    expect(screen.getByText("Skill Changes")).toBeInTheDocument();
  });

  it("shows matched and missing skill counts", async () => {
    mockGetAnalysisResult.mockResolvedValueOnce(mockResultA).mockResolvedValueOnce(mockResultB);

    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTestId("comparison-view")).toBeInTheDocument();
    });

    // Analysis A has 2 matched, 2 missing
    expect(screen.getByText("2 matched skills")).toBeInTheDocument();
    // Analysis B has 3 matched, 1 missing
    expect(screen.getByText("3 matched skills")).toBeInTheDocument();
  });

  it("fetches both analyses", async () => {
    mockGetAnalysisResult.mockResolvedValueOnce(mockResultA).mockResolvedValueOnce(mockResultB);

    render(<ComparisonView analysisIds={["analysis-1", "analysis-2"]} onClose={onClose} />);

    await waitFor(() => {
      expect(mockGetAnalysisResult).toHaveBeenCalledWith("analysis-1");
      expect(mockGetAnalysisResult).toHaveBeenCalledWith("analysis-2");
    });
  });
});
