import React from "react";
import { render, screen } from "@testing-library/react";
import ScoreTrendChart from "@/components/dashboard/ScoreTrendChart";
import type { AnalysisHistoryItem } from "@/types/analysis";

// Mock recharts
jest.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
}));

const makeItem = (
  score: number | null,
  date: string,
  status = "completed"
): AnalysisHistoryItem => ({
  id: `id-${score}-${date}`,
  job_title: "Test",
  job_company: null,
  match_score: score,
  ats_score: score ? score - 5 : null,
  status,
  created_at: date,
});

describe("ScoreTrendChart", () => {
  it("does not render with fewer than 2 data points", () => {
    const items = [makeItem(80, "2024-01-01T00:00:00Z")];
    const { container } = render(<ScoreTrendChart items={items} />);
    expect(container.innerHTML).toBe("");
  });

  it("does not render with no completed analyses", () => {
    const items = [
      makeItem(null, "2024-01-01T00:00:00Z", "processing"),
      makeItem(null, "2024-01-02T00:00:00Z", "queued"),
    ];
    const { container } = render(<ScoreTrendChart items={items} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders chart with 2+ completed analyses", () => {
    const items = [makeItem(60, "2024-01-01T00:00:00Z"), makeItem(80, "2024-02-01T00:00:00Z")];
    render(<ScoreTrendChart items={items} />);
    expect(screen.getByTestId("score-trend-chart")).toBeInTheDocument();
    expect(screen.getByText("Score Trends")).toBeInTheDocument();
  });

  it("shows analysis count", () => {
    const items = [
      makeItem(60, "2024-01-01T00:00:00Z"),
      makeItem(70, "2024-02-01T00:00:00Z"),
      makeItem(80, "2024-03-01T00:00:00Z"),
    ];
    render(<ScoreTrendChart items={items} />);
    expect(screen.getByText("(3 analyses)")).toBeInTheDocument();
  });

  it("renders the LineChart component", () => {
    const items = [makeItem(60, "2024-01-01T00:00:00Z"), makeItem(80, "2024-02-01T00:00:00Z")];
    render(<ScoreTrendChart items={items} />);
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  it("excludes non-completed analyses from chart", () => {
    const items = [
      makeItem(60, "2024-01-01T00:00:00Z"),
      makeItem(null, "2024-02-01T00:00:00Z", "processing"),
      makeItem(80, "2024-03-01T00:00:00Z"),
    ];
    render(<ScoreTrendChart items={items} />);
    // Only 2 completed, so it should render
    expect(screen.getByText("(2 analyses)")).toBeInTheDocument();
  });
});
