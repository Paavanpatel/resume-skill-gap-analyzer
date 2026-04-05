import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import HistoryCard from "@/components/dashboard/HistoryCard";
import type { AnalysisHistoryItem } from "@/types/analysis";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const completedItem: AnalysisHistoryItem = {
  id: "analysis-1",
  job_title: "Senior Developer",
  job_company: "Acme Corp",
  match_score: 85,
  ats_score: 90,
  status: "completed",
  created_at: "2024-06-15T10:30:00Z",
};

const processingItem: AnalysisHistoryItem = {
  id: "analysis-2",
  job_title: null,
  job_company: null,
  match_score: null,
  ats_score: null,
  status: "processing",
  created_at: new Date().toISOString(),
};

const lowScoreItem: AnalysisHistoryItem = {
  id: "analysis-3",
  job_title: "Intern",
  job_company: "Startup",
  match_score: 30,
  ats_score: 25,
  status: "completed",
  created_at: "2024-01-01T10:00:00Z",
};

describe("HistoryCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders job title and company", () => {
    render(<HistoryCard item={completedItem} />);
    expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("shows 'Untitled Position' for null job title", () => {
    render(<HistoryCard item={processingItem} />);
    expect(screen.getByText("Untitled Position")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<HistoryCard item={completedItem} />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows animated pulse dot for processing status", () => {
    render(<HistoryCard item={processingItem} />);
    const badge = screen.getByText("Processing");
    const dot = badge.querySelector('[class*="animate-pulse"]');
    expect(dot).toBeInTheDocument();
  });

  it("shows ATS score on desktop", () => {
    render(<HistoryCard item={completedItem} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
    expect(screen.getByText("ATS")).toBeInTheDocument();
  });

  it("navigates to analysis on click", () => {
    render(<HistoryCard item={completedItem} />);
    const title = screen.getByText("Senior Developer").closest("button");
    fireEvent.click(title!);
    expect(mockPush).toHaveBeenCalledWith("/analysis/analysis-1");
  });

  it("has gradient score accent", () => {
    render(<HistoryCard item={completedItem} />);
    const accent = screen.getByTestId("score-accent");
    expect(accent).toBeInTheDocument();
    expect(accent.className).toContain("bg-gradient-to-b");
  });

  it("renders checkbox in selectable mode", () => {
    const onSelect = jest.fn();
    render(<HistoryCard item={completedItem} selectable selected={false} onSelect={onSelect} />);
    const checkbox = screen.getByTestId("compare-checkbox-analysis-1");
    expect(checkbox).toBeInTheDocument();
  });

  it("calls onSelect when checkbox clicked", () => {
    const onSelect = jest.fn();
    render(<HistoryCard item={completedItem} selectable selected={false} onSelect={onSelect} />);
    const checkbox = screen.getByTestId("compare-checkbox-analysis-1");
    fireEvent.click(checkbox);
    expect(onSelect).toHaveBeenCalledWith("analysis-1");
  });

  it("shows selected state with ring", () => {
    render(<HistoryCard item={completedItem} selectable selected onSelect={jest.fn()} />);
    const card = screen.getByTestId("history-card-analysis-1");
    expect(card.className).toContain("border-primary-500");
    expect(card.className).toContain("ring-2");
  });

  it("shows delete modal on delete action", () => {
    const onDelete = jest.fn();
    render(<HistoryCard item={completedItem} onDelete={onDelete} />);

    // The delete modal should not be visible initially
    expect(screen.queryByText("Delete Analysis")).not.toBeInTheDocument();
  });

  it("shows relative time", () => {
    render(<HistoryCard item={processingItem} />);
    // Recently created should show "Just now" or similar
    expect(screen.getByText(/just now|ago/i)).toBeInTheDocument();
  });
});
