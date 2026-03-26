import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdvisorSection from "../AdvisorSection";

const mockGenerateAdvisorRewrites = jest.fn();
jest.mock("@/lib/api", () => ({
  generateAdvisorRewrites: (...args: any[]) => mockGenerateAdvisorRewrites(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

describe("AdvisorSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the initial generate button", () => {
    render(<AdvisorSection analysisId="test-123" />);
    expect(screen.getByText("Resume Advisor")).toBeInTheDocument();
    expect(screen.getByText("Generate Rewrites")).toBeInTheDocument();
  });

  it("shows loading state when generating", async () => {
    mockGenerateAdvisorRewrites.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<AdvisorSection analysisId="test-123" />);
    fireEvent.click(screen.getByText("Generate Rewrites"));

    expect(screen.getByText("Generating rewrites...")).toBeInTheDocument();
  });

  it("displays error on failure", async () => {
    mockGenerateAdvisorRewrites.mockRejectedValue(new Error("API failed"));

    render(<AdvisorSection analysisId="test-123" />);
    fireEvent.click(screen.getByText("Generate Rewrites"));

    await waitFor(() => {
      expect(screen.getByText("API failed")).toBeInTheDocument();
    });
  });

  it("renders rewrites on success", async () => {
    mockGenerateAdvisorRewrites.mockResolvedValue({
      overall_summary: "Your resume needs improvements",
      rewrites: [
        {
          section: "Experience",
          original: "Worked on projects",
          rewritten: "Led cross-functional team delivering 3 projects",
          changes_made: ["Added metrics", "Used action verbs"],
          confidence: 0.85,
        },
      ],
    });

    render(<AdvisorSection analysisId="test-123" />);
    fireEvent.click(screen.getByText("Generate Rewrites"));

    await waitFor(() => {
      expect(screen.getByText("Your resume needs improvements")).toBeInTheDocument();
    });

    expect(screen.getByText("Experience")).toBeInTheDocument();
    expect(screen.getByText("85% confidence")).toBeInTheDocument();
    expect(screen.getByText("2 changes")).toBeInTheDocument();
  });

  it("expands and collapses rewrite details", async () => {
    mockGenerateAdvisorRewrites.mockResolvedValue({
      overall_summary: "Summary",
      rewrites: [
        {
          section: "Skills",
          original: "Python",
          rewritten: "Python, Django, FastAPI",
          changes_made: ["Added frameworks"],
          confidence: 0.9,
        },
      ],
    });

    render(<AdvisorSection analysisId="test-123" />);
    fireEvent.click(screen.getByText("Generate Rewrites"));

    await waitFor(() => {
      expect(screen.getByText("Skills")).toBeInTheDocument();
    });

    // Click to expand
    const expandBtn = screen.getByText("Skills").closest("button");
    fireEvent.click(expandBtn!);

    expect(screen.getByText("Python, Django, FastAPI")).toBeInTheDocument();
    expect(screen.getByText("Added frameworks")).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(expandBtn!);
    expect(screen.queryByText("Python, Django, FastAPI")).not.toBeInTheDocument();
  });
});
