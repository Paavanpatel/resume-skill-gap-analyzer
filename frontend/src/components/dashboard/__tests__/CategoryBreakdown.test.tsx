import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import CategoryBreakdown from "@/components/dashboard/CategoryBreakdown";
import type { CategoryBreakdown as CategoryBreakdownType } from "@/types/analysis";

const mockBreakdowns: CategoryBreakdownType[] = [
  {
    category: "programming_language",
    display_name: "Programming Languages",
    total_job_skills: 4,
    matched_count: 3,
    missing_count: 1,
    match_percentage: 75,
    matched_skills: ["Python", "JavaScript", "TypeScript"],
    missing_skills: ["Go"],
    priority: "critical",
  },
  {
    category: "framework",
    display_name: "Frameworks",
    total_job_skills: 3,
    matched_count: 1,
    missing_count: 2,
    match_percentage: 33,
    matched_skills: ["React"],
    missing_skills: ["Vue", "Angular"],
    priority: "important",
  },
];

describe("CategoryBreakdown", () => {
  it("renders header", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);
    expect(screen.getByText("Skill Categories")).toBeInTheDocument();
  });

  it("renders category names", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);
    expect(screen.getByText("Programming Languages")).toBeInTheDocument();
    expect(screen.getByText("Frameworks")).toBeInTheDocument();
  });

  it("shows match percentages", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("33%")).toBeInTheDocument();
  });

  it("shows skill counts", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);
    expect(screen.getByText("3 of 4 skills matched")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 skills matched")).toBeInTheDocument();
  });

  it("shows priority labels", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("Important")).toBeInTheDocument();
  });

  it("sorts by priority (critical first)", () => {
    const reversed: CategoryBreakdownType[] = [
      { ...mockBreakdowns[1], priority: "nice_to_have" },
      { ...mockBreakdowns[0], priority: "critical" },
    ];
    render(<CategoryBreakdown breakdowns={reversed} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons[0].textContent).toContain("Programming Languages");
  });

  it("expands category on click to show skills", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);

    fireEvent.click(screen.getByText("Programming Languages"));

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("JavaScript")).toBeInTheDocument();
    expect(screen.getByText("Go")).toBeInTheDocument();
  });

  it("shows matched and missing skill counts in expanded view", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);
    fireEvent.click(screen.getByText("Programming Languages"));

    expect(screen.getByText(/Matched \(3\)/)).toBeInTheDocument();
    expect(screen.getByText(/Missing \(1\)/)).toBeInTheDocument();
  });

  it("collapses category on second click", () => {
    render(<CategoryBreakdown breakdowns={mockBreakdowns} />);

    fireEvent.click(screen.getByText("Programming Languages"));
    expect(screen.getByText("Python")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Programming Languages"));
    expect(screen.queryByText(/Matched \(3\)/)).not.toBeInTheDocument();
  });
});
