import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import StatusIndicator from "@/components/ui/StatusIndicator";
import type { HealthStatus } from "@/hooks/useHealthCheck";

describe("StatusIndicator", () => {
  it("renders a button with aria-label for healthy status", () => {
    render(<StatusIndicator status="healthy" />);
    expect(screen.getByLabelText("System status: Healthy. Click for details.")).toBeInTheDocument();
  });

  it("renders a button with aria-label for degraded status", () => {
    render(<StatusIndicator status="degraded" />);
    expect(
      screen.getByLabelText("System status: Degraded. Click for details.")
    ).toBeInTheDocument();
  });

  it("renders a button with aria-label for unhealthy status", () => {
    render(<StatusIndicator status="unhealthy" />);
    expect(
      screen.getByLabelText("System status: Unhealthy. Click for details.")
    ).toBeInTheDocument();
  });

  it("renders a button with aria-label for unknown status", () => {
    render(<StatusIndicator status="unknown" />);
    expect(screen.getByLabelText("System status: Unknown. Click for details.")).toBeInTheDocument();
  });

  it("shows popover when button is clicked", () => {
    render(<StatusIndicator status="healthy" />);
    fireEvent.click(screen.getByLabelText("System status: Healthy. Click for details."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("System Health")).toBeInTheDocument();
  });

  it("hides popover on second click", () => {
    render(<StatusIndicator status="healthy" />);
    const btn = screen.getByLabelText("System status: Healthy. Click for details.");
    fireEvent.click(btn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("popover shows status label", () => {
    render(<StatusIndicator status="degraded" />);
    fireEvent.click(screen.getByLabelText("System status: Degraded. Click for details."));
    expect(screen.getByText("Degraded")).toBeInTheDocument();
  });

  it("shows dependency checks in popover", () => {
    const checks = { database: "ok", redis: "ok", celery: "no_workers" };
    render(<StatusIndicator status="degraded" checks={checks} />);
    fireEvent.click(screen.getByLabelText("System status: Degraded. Click for details."));
    expect(screen.getByText("database")).toBeInTheDocument();
    expect(screen.getByText("redis")).toBeInTheDocument();
    expect(screen.getByText("celery")).toBeInTheDocument();
  });

  it("shows 'No check data available' when checks is null", () => {
    render(<StatusIndicator status="healthy" checks={null} />);
    fireEvent.click(screen.getByLabelText("System status: Healthy. Click for details."));
    expect(screen.getByText("No check data available.")).toBeInTheDocument();
  });

  it("shows last checked time when provided", () => {
    const date = new Date("2024-01-01T10:30:00");
    render(<StatusIndicator status="healthy" lastChecked={date} />);
    fireEvent.click(screen.getByLabelText("System status: Healthy. Click for details."));
    expect(screen.getByText(/Last checked/)).toBeInTheDocument();
  });

  it("closes popover when clicking outside", () => {
    render(
      <div>
        <StatusIndicator status="healthy" />
        <button data-testid="outside">Outside</button>
      </div>
    );
    fireEvent.click(screen.getByLabelText("System status: Healthy. Click for details."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not show pulse ring for unknown status", () => {
    const { container } = render(<StatusIndicator status="unknown" />);
    expect(container.querySelector(".animate-ping")).not.toBeInTheDocument();
  });

  it("shows pulse ring for healthy status", () => {
    const { container } = render(<StatusIndicator status="healthy" />);
    expect(container.querySelector(".animate-ping")).toBeInTheDocument();
  });

  it("applies custom size", () => {
    const { container } = render(<StatusIndicator status="healthy" size={14} />);
    const dot = container.querySelector(".rounded-full.bg-success-500");
    expect(dot).toHaveStyle({ width: "14px", height: "14px" });
  });

  it("applies custom className", () => {
    const { container } = render(<StatusIndicator status="healthy" className="my-class" />);
    expect(container.firstChild).toHaveClass("my-class");
  });
});
