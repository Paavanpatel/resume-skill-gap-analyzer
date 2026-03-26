import React from "react";
import { render, screen } from "@testing-library/react";
import Card from "@/components/ui/Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Card content</Card>);
    expect(screen.getByText("Card content")).toBeInTheDocument();
  });

  it("applies default medium padding", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass("p-6");
  });

  it("applies small padding", () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    expect(container.firstChild).toHaveClass("p-4");
  });

  it("applies large padding", () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    expect(container.firstChild).toHaveClass("p-8");
  });

  it("has rounded border styling", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toHaveClass("rounded-xl");
    expect(container.firstChild).toHaveClass("border");
  });

  it("merges custom className", () => {
    const { container } = render(<Card className="mt-4">Content</Card>);
    expect(container.firstChild).toHaveClass("mt-4");
  });
});
