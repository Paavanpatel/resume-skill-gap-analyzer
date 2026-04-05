import React from "react";
import { render, screen } from "@testing-library/react";
import MaintenancePage from "@/app/maintenance/page";

describe("MaintenancePage", () => {
  it("renders scheduled maintenance heading", () => {
    render(<MaintenancePage />);
    expect(screen.getByText("Scheduled Maintenance")).toBeInTheDocument();
  });

  it("renders maintenance description", () => {
    render(<MaintenancePage />);
    expect(screen.getByText(/We're making improvements/)).toBeInTheDocument();
  });

  it("renders status indicators", () => {
    render(<MaintenancePage />);
    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Database")).toBeInTheDocument();
    expect(screen.getByText("Static assets")).toBeInTheDocument();
  });

  it("shows API as under maintenance", () => {
    render(<MaintenancePage />);
    const items = screen.getAllByText("Under maintenance");
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it("shows static assets as operational", () => {
    render(<MaintenancePage />);
    expect(screen.getByText("Operational")).toBeInTheDocument();
  });

  it("renders check back message", () => {
    render(<MaintenancePage />);
    expect(screen.getByText("Check back in a few minutes.")).toBeInTheDocument();
  });
});
