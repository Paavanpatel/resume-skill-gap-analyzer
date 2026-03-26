import React from "react";
import { render, screen } from "@testing-library/react";
import Badge from "@/components/ui/Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Status</Badge>);
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("applies default variant styling", () => {
    render(<Badge>Default</Badge>);
    const badge = screen.getByText("Default");
    expect(badge.className).toContain("bg-gray-100");
  });

  it("applies success variant", () => {
    render(<Badge variant="success">Success</Badge>);
    const badge = screen.getByText("Success");
    expect(badge.className).toContain("bg-success-100");
  });

  it("applies danger variant", () => {
    render(<Badge variant="danger">Error</Badge>);
    const badge = screen.getByText("Error");
    expect(badge.className).toContain("bg-danger-100");
  });

  it("applies warning variant", () => {
    render(<Badge variant="warning">Warning</Badge>);
    const badge = screen.getByText("Warning");
    expect(badge.className).toContain("bg-warning-100");
  });

  it("applies info variant", () => {
    render(<Badge variant="info">Info</Badge>);
    const badge = screen.getByText("Info");
    expect(badge.className).toContain("bg-primary-100");
  });

  it("has rounded-full class", () => {
    render(<Badge>Pill</Badge>);
    const badge = screen.getByText("Pill");
    expect(badge.className).toContain("rounded-full");
  });

  it("merges custom className", () => {
    render(<Badge className="ml-2">Custom</Badge>);
    const badge = screen.getByText("Custom");
    expect(badge.className).toContain("ml-2");
  });
});
