import React from "react";
import { render, screen } from "@testing-library/react";
import HistoryStatsBar from "@/components/dashboard/HistoryStatsBar";
import type { AnalysisHistoryItem } from "@/types/analysis";

// Mock IntersectionObserver for AnimatedCounter
const mockIntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
Object.defineProperty(window, "IntersectionObserver", {
  value: mockIntersectionObserver,
});

const mockItems: AnalysisHistoryItem[] = [
  {
    id: "1",
    job_title: "Developer",
    job_company: "Acme",
    match_score: 80,
    ats_score: 70,
    status: "completed",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    job_title: "Designer",
    job_company: "BigCo",
    match_score: 60,
    ats_score: 50,
    status: "completed",
    created_at: new Date().toISOString(),
  },
  {
    id: "3",
    job_title: null,
    job_company: null,
    match_score: null,
    ats_score: null,
    status: "processing",
    created_at: new Date().toISOString(),
  },
];

describe("HistoryStatsBar", () => {
  it("renders the stats bar", () => {
    render(<HistoryStatsBar items={mockItems} />);
    expect(screen.getByTestId("history-stats-bar")).toBeInTheDocument();
  });

  it("displays all four stat labels", () => {
    render(<HistoryStatsBar items={mockItems} />);
    expect(screen.getByText("Total Analyses")).toBeInTheDocument();
    expect(screen.getByText("Avg Score")).toBeInTheDocument();
    expect(screen.getByText("Best Score")).toBeInTheDocument();
    expect(screen.getByText("This Month")).toBeInTheDocument();
  });

  it("handles empty items array", () => {
    render(<HistoryStatsBar items={[]} />);
    expect(screen.getByTestId("history-stats-bar")).toBeInTheDocument();
    expect(screen.getByText("Total Analyses")).toBeInTheDocument();
  });

  it("uses 4-column grid on large screens", () => {
    render(<HistoryStatsBar items={mockItems} />);
    const container = screen.getByTestId("history-stats-bar");
    expect(container.className).toContain("grid-cols-2");
    expect(container.className).toContain("lg:grid-cols-4");
  });
});
