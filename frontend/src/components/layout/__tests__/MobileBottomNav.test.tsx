import React from "react";
import { render, screen } from "@testing-library/react";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/dashboard"),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  BarChart3: (props: any) => <svg data-testid="icon-barchart3" {...props} />,
  FileText: (props: any) => <svg data-testid="icon-filetext" {...props} />,
  PlusCircle: (props: any) => <svg data-testid="icon-pluscircle" {...props} />,
}));

import { usePathname } from "next/navigation";
const mockUsePathname = usePathname as jest.Mock;

describe("MobileBottomNav", () => {
  beforeEach(() => {
    mockUsePathname.mockReturnValue("/dashboard");
  });

  it("renders with data-testid", () => {
    render(<MobileBottomNav />);
    expect(screen.getByTestId("mobile-bottom-nav")).toBeInTheDocument();
  });

  it("renders Analyze and History nav items", () => {
    render(<MobileBottomNav />);
    expect(screen.getByText("Analyze")).toBeInTheDocument();
    expect(screen.getByText("History")).toBeInTheDocument();
  });

  it("marks current route as active", () => {
    render(<MobileBottomNav />);
    const analyzeLink = screen.getByText("Analyze").closest("a");
    expect(analyzeLink?.className).toContain("text-primary-600");
  });

  it("marks non-current routes as inactive", () => {
    render(<MobileBottomNav />);
    const historyLink = screen.getByText("History").closest("a");
    expect(historyLink?.className).toContain("text-gray-500");
  });

  it("updates active state on route change", () => {
    mockUsePathname.mockReturnValue("/history");
    render(<MobileBottomNav />);
    const historyLink = screen.getByText("History").closest("a");
    expect(historyLink?.className).toContain("text-primary-600");

    const analyzeLink = screen.getByText("Analyze").closest("a");
    expect(analyzeLink?.className).toContain("text-gray-500");
  });

  it("has correct href attributes", () => {
    render(<MobileBottomNav />);
    expect(screen.getByText("Analyze").closest("a")).toHaveAttribute("href", "/dashboard");
    expect(screen.getByText("History").closest("a")).toHaveAttribute("href", "/history");
  });

  it("is hidden on sm+ screens via className", () => {
    render(<MobileBottomNav />);
    expect(screen.getByTestId("mobile-bottom-nav").className).toContain("sm:hidden");
  });

  it("has minimum touch target size", () => {
    render(<MobileBottomNav />);
    const links = screen.getByTestId("mobile-bottom-nav").querySelectorAll("a");
    links.forEach((link) => {
      expect(link.className).toContain("min-h-[44px]");
    });
  });
});
