import React from "react";
import { render, screen } from "@testing-library/react";
import SkipToContent from "@/components/ui/SkipToContent";

describe("SkipToContent", () => {
  it("renders with data-testid", () => {
    render(<SkipToContent />);
    expect(screen.getByTestId("skip-to-content")).toBeInTheDocument();
  });

  it("has default href pointing to #main-content", () => {
    render(<SkipToContent />);
    expect(screen.getByTestId("skip-to-content")).toHaveAttribute("href", "#main-content");
  });

  it("renders default label text", () => {
    render(<SkipToContent />);
    expect(screen.getByText("Skip to main content")).toBeInTheDocument();
  });

  it("accepts custom href", () => {
    render(<SkipToContent href="#custom-target" />);
    expect(screen.getByTestId("skip-to-content")).toHaveAttribute("href", "#custom-target");
  });

  it("accepts custom label", () => {
    render(<SkipToContent label="Jump to content" />);
    expect(screen.getByText("Jump to content")).toBeInTheDocument();
  });

  it("applies sr-only class for screen reader visibility", () => {
    render(<SkipToContent />);
    expect(screen.getByTestId("skip-to-content").className).toContain("sr-only");
  });

  it("applies custom className", () => {
    render(<SkipToContent className="my-class" />);
    expect(screen.getByTestId("skip-to-content").className).toContain("my-class");
  });
});
