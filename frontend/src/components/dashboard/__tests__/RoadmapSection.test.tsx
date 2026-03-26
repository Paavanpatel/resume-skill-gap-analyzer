import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RoadmapSection from "../RoadmapSection";

const mockGenerateRoadmap = jest.fn();
const mockGetRoadmap = jest.fn();

jest.mock("@/lib/api", () => ({
  generateRoadmap: (...args: any[]) => mockGenerateRoadmap(...args),
  getRoadmap: (...args: any[]) => mockGetRoadmap(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

const mockRoadmap = {
  id: "roadmap-1",
  analysis_id: "analysis-1",
  total_weeks: 12,
  phases: [
    {
      week_range: "1-4",
      focus: "Python Fundamentals",
      objectives: ["Learn advanced Python", "Build a REST API"],
      resources: ["Python Docs", "FastAPI Tutorial"],
    },
    {
      week_range: "5-8",
      focus: "Cloud Services",
      objectives: ["Learn AWS basics"],
      resources: [],
    },
  ],
};

describe("RoadmapSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state initially when checking for existing roadmap", () => {
    mockGetRoadmap.mockImplementation(() => new Promise(() => {}));
    render(<RoadmapSection analysisId="test-123" />);
    // Should show loading spinner
    expect(screen.getByText(/loading|generating/i)).toBeInTheDocument();
  });

  it("shows generate button when no roadmap exists", async () => {
    mockGetRoadmap.mockRejectedValue(new Error("Not found"));

    render(<RoadmapSection analysisId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText("Generate Roadmap")).toBeInTheDocument();
    });
  });

  it("displays existing roadmap after loading", async () => {
    mockGetRoadmap.mockResolvedValue(mockRoadmap);

    render(<RoadmapSection analysisId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText("Learning Roadmap")).toBeInTheDocument();
    });

    expect(screen.getByText("12 weeks")).toBeInTheDocument();
    expect(screen.getByText("Python Fundamentals")).toBeInTheDocument();
    expect(screen.getByText("Weeks 1-4")).toBeInTheDocument();
    expect(screen.getByText("Learn advanced Python")).toBeInTheDocument();
    expect(screen.getByText("Python Docs")).toBeInTheDocument();
  });

  it("generates roadmap on button click", async () => {
    mockGetRoadmap.mockRejectedValue(new Error("Not found"));
    mockGenerateRoadmap.mockResolvedValue(mockRoadmap);

    render(<RoadmapSection analysisId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText("Generate Roadmap")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Generate Roadmap"));

    await waitFor(() => {
      expect(screen.getByText("12 weeks")).toBeInTheDocument();
    });

    expect(mockGenerateRoadmap).toHaveBeenCalledWith("test-123");
  });

  it("shows error on generate failure", async () => {
    mockGetRoadmap.mockRejectedValue(new Error("Not found"));
    mockGenerateRoadmap.mockRejectedValue(new Error("Generation failed"));

    render(<RoadmapSection analysisId="test-123" />);

    await waitFor(() => {
      expect(screen.getByText("Generate Roadmap")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Generate Roadmap"));

    await waitFor(() => {
      expect(screen.getByText("Generation failed")).toBeInTheDocument();
    });
  });
});
