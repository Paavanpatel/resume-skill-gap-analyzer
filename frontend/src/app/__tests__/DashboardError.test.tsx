import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DashboardError from "@/app/(dashboard)/error";

describe("DashboardError", () => {
  const mockReset = jest.fn();
  const mockError = new Error("Dashboard broke") as Error & { digest?: string };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockReset.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders with data-testid", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByTestId("dashboard-error")).toBeInTheDocument();
  });

  it("displays error heading", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders Try Again button", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls reset on Try Again click", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console", () => {
    render(<DashboardError error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith("[Dashboard Error]", mockError);
  });
});
