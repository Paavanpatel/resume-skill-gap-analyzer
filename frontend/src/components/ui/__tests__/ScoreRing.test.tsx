import React from "react";
import { render, screen } from "@testing-library/react";
import ScoreRing from "@/components/ui/ScoreRing";

describe("ScoreRing", () => {
  it("renders the score value", () => {
    render(<ScoreRing score={75} label="Match" />);
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("renders the label", () => {
    render(<ScoreRing score={75} label="Match Score" />);
    expect(screen.getByText("Match Score")).toBeInTheDocument();
  });

  it("rounds decimal scores", () => {
    render(<ScoreRing score={75.6} label="Score" />);
    expect(screen.getByText("76")).toBeInTheDocument();
  });

  it("shows -- for null score", () => {
    render(<ScoreRing score={null} label="Score" />);
    expect(screen.getByText("--")).toBeInTheDocument();
  });

  it("renders SVG element", () => {
    const { container } = render(<ScoreRing score={50} label="Test" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders two circles (background + progress)", () => {
    const { container } = render(<ScoreRing score={50} label="Test" />);
    const circles = container.querySelectorAll("circle");
    expect(circles).toHaveLength(2);
  });

  it("applies green color for high scores", () => {
    render(<ScoreRing score={85} label="Score" />);
    const scoreText = screen.getByText("85");
    expect(scoreText.style.color).toBe("rgb(16, 185, 129)");
  });

  it("applies blue color for medium-high scores", () => {
    render(<ScoreRing score={65} label="Score" />);
    const scoreText = screen.getByText("65");
    expect(scoreText.style.color).toBe("rgb(59, 130, 246)");
  });

  it("applies amber color for medium scores", () => {
    render(<ScoreRing score={45} label="Score" />);
    const scoreText = screen.getByText("45");
    expect(scoreText.style.color).toBe("rgb(245, 158, 11)");
  });

  it("applies red color for low scores", () => {
    render(<ScoreRing score={20} label="Score" />);
    const scoreText = screen.getByText("20");
    expect(scoreText.style.color).toBe("rgb(244, 63, 94)");
  });

  it("uses smaller font for small sizes", () => {
    render(<ScoreRing score={50} label="Score" size={60} />);
    const scoreText = screen.getByText("50");
    expect(scoreText.style.fontSize).toBe("0.875rem");
  });

  it("uses larger font for default size", () => {
    render(<ScoreRing score={50} label="Score" />);
    const scoreText = screen.getByText("50");
    expect(scoreText.style.fontSize).toBe("1.5rem");
  });

  it("applies glow class for high score when glow=true", () => {
    const { container } = render(<ScoreRing score={85} label="Score" glow={true} />);
    const ring = container.querySelector(".relative.rounded-full");
    expect(ring?.className).toContain("shadow-glow-success");
  });

  it("applies glow class for medium-high score when glow=true", () => {
    const { container } = render(<ScoreRing score={65} label="Score" glow={true} />);
    const ring = container.querySelector(".relative.rounded-full");
    expect(ring?.className).toContain("shadow-glow");
  });

  it("applies glow class for medium score when glow=true", () => {
    const { container } = render(<ScoreRing score={45} label="Score" glow={true} />);
    const ring = container.querySelector(".relative.rounded-full");
    expect(ring?.className).toContain("shadow-glow-warning");
  });

  it("applies glow-danger class for low score when glow=true", () => {
    const { container } = render(<ScoreRing score={20} label="Score" glow={true} />);
    const ring = container.querySelector(".relative.rounded-full");
    expect(ring?.className).toContain("shadow-glow-danger");
  });

  it("applies custom className", () => {
    const { container } = render(<ScoreRing score={50} label="Score" className="custom-ring" />);
    expect(container.firstChild).toHaveClass("custom-ring");
  });
});
