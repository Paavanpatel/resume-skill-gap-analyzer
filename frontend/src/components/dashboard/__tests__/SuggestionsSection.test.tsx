import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import SuggestionsSection from "@/components/dashboard/SuggestionsSection";
import type { ResumeSuggestion } from "@/types/analysis";

const mockSuggestions: ResumeSuggestion[] = [
  {
    section: "summary",
    current: "Experienced developer",
    suggested: "Senior full-stack developer with 5+ years...",
    reason: "Add more specific keywords",
    priority: "high",
    source: "llm",
  },
  {
    section: "experience",
    current: "Built features",
    suggested: "Architected and built 3 production microservices...",
    reason: "Quantify achievements",
    priority: "medium",
    source: "rule",
  },
];

describe("SuggestionsSection", () => {
  it("renders header", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);
    expect(screen.getByText("Improvement Suggestions")).toBeInTheDocument();
  });

  it("shows suggestion count", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);
    expect(screen.getByText("2 suggestions")).toBeInTheDocument();
  });

  it("shows empty state", () => {
    render(<SuggestionsSection suggestions={[]} />);
    expect(screen.getByText("No suggestions at this time.")).toBeInTheDocument();
  });

  it("renders suggestion reasons", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);
    expect(screen.getByText("Add more specific keywords")).toBeInTheDocument();
    expect(screen.getByText("Quantify achievements")).toBeInTheDocument();
  });

  it("sorts suggestions by priority (high first)", () => {
    const unsorted: ResumeSuggestion[] = [
      {
        section: "a",
        current: "",
        suggested: "",
        reason: "Low priority",
        priority: "low",
        source: "rule",
      },
      {
        section: "b",
        current: "",
        suggested: "",
        reason: "High priority",
        priority: "high",
        source: "llm",
      },
    ];
    render(<SuggestionsSection suggestions={unsorted} />);
    const reasons = screen.getAllByText(/priority/i);
    expect(reasons[0].textContent).toBe("High priority");
  });

  it("expands suggestion on click", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);

    // Click the first suggestion
    fireEvent.click(screen.getByText("Add more specific keywords"));

    // Should show current and suggested text
    expect(screen.getByText("Experienced developer")).toBeInTheDocument();
    expect(screen.getByText(/Senior full-stack developer/)).toBeInTheDocument();
  });

  it("collapses suggestion on second click", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);

    const reason = screen.getByText("Add more specific keywords");
    fireEvent.click(reason);
    expect(screen.getByText("Experienced developer")).toBeInTheDocument();

    fireEvent.click(reason);
    expect(screen.queryByText("Experienced developer")).not.toBeInTheDocument();
  });

  it("shows source label when expanded", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);
    fireEvent.click(screen.getByText("Add more specific keywords"));
    expect(screen.getByText(/AI-generated/)).toBeInTheDocument();
  });

  it("renders section badges", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);
    expect(screen.getByText("summary")).toBeInTheDocument();
    expect(screen.getByText("experience")).toBeInTheDocument();
  });

  it("shows upgrade CTA when suggestionsLimited is true", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} suggestionsLimited={true} />);
    expect(screen.getByText("Upgrade to Pro")).toBeInTheDocument();
    expect(screen.getByText(/AI-powered suggestions/)).toBeInTheDocument();
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("does not show upgrade CTA when suggestionsLimited is false", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} suggestionsLimited={false} />);
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
  });

  it("does not show upgrade CTA when suggestionsLimited is undefined", () => {
    render(<SuggestionsSection suggestions={mockSuggestions} />);
    expect(screen.queryByText("Upgrade to Pro")).not.toBeInTheDocument();
  });
});
