import React from "react";
import { render, screen } from "@testing-library/react";
import DashboardLoading from "@/app/(dashboard)/loading";

describe("DashboardLoading", () => {
  it("renders with aria-busy attribute", () => {
    render(<DashboardLoading />);
    expect(screen.getByLabelText("Loading dashboard")).toHaveAttribute(
      "aria-busy",
      "true"
    );
  });

  it("renders skeleton elements", () => {
    const { container } = render(<DashboardLoading />);
    const skeletonItems = container.querySelectorAll(
      ".bg-gray-200, .bg-gray-100"
    );
    expect(skeletonItems.length).toBeGreaterThan(0);
  });

  it("applies animate-pulse class", () => {
    const { container } = render(<DashboardLoading />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });
});
