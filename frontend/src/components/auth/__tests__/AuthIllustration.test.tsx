import React from "react";
import { render, screen } from "@testing-library/react";
import AuthIllustration from "@/components/auth/AuthIllustration";

jest.mock("lucide-react", () => ({
  FileText: (props: any) => <span data-testid="icon-file-text" {...props} />,
  Target: (props: any) => <span data-testid="icon-target" {...props} />,
  TrendingUp: (props: any) => <span data-testid="icon-trending-up" {...props} />,
  Sparkles: (props: any) => <span data-testid="icon-sparkles" {...props} />,
}));

describe("AuthIllustration", () => {
  it("renders brand name", () => {
    render(<AuthIllustration />);
    expect(screen.getByText("SkillGap")).toBeInTheDocument();
  });

  it("renders tagline", () => {
    render(<AuthIllustration />);
    expect(
      screen.getByText("AI-powered resume analysis to help you land your dream role")
    ).toBeInTheDocument();
  });

  it("renders all feature highlights", () => {
    render(<AuthIllustration />);
    expect(screen.getByText("Smart Resume Parsing")).toBeInTheDocument();
    expect(screen.getByText("AI Skill Matching")).toBeInTheDocument();
    expect(screen.getByText("Actionable Roadmap")).toBeInTheDocument();
  });

  it("renders feature descriptions", () => {
    render(<AuthIllustration />);
    expect(screen.getByText("Upload PDF, DOCX, or TXT files")).toBeInTheDocument();
    expect(screen.getByText("Compare against any job description")).toBeInTheDocument();
    expect(screen.getByText("Personalized learning paths to close gaps")).toBeInTheDocument();
  });

  it("renders social proof text", () => {
    render(<AuthIllustration />);
    expect(
      screen.getByText(/Trusted by job seekers/)
    ).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(<AuthIllustration className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });
});
