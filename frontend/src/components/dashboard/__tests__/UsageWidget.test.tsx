import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import UsageWidget from "@/components/dashboard/UsageWidget";

jest.mock("lucide-react", () => ({
  Zap: (props: any) => <span data-testid="icon-zap" {...props} />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockGetUsageSummary = jest.fn();

jest.mock("@/lib/api", () => ({
  getUsageSummary: () => mockGetUsageSummary(),
}));

describe("UsageWidget", () => {
  beforeEach(() => {
    mockGetUsageSummary.mockReset();
  });

  it("renders nothing initially while loading", () => {
    mockGetUsageSummary.mockReturnValue(new Promise(() => {}));
    const { container } = render(<UsageWidget />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing for enterprise tier", async () => {
    mockGetUsageSummary.mockResolvedValue({
      tier: "enterprise",
      analyses: { used: 100, limit: 999, pct: 10 },
      period: "Apr 2024",
    });
    const { container } = render(<UsageWidget />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  it("renders usage for free tier", async () => {
    mockGetUsageSummary.mockResolvedValue({
      tier: "free",
      analyses: { used: 3, limit: 5, pct: 60 },
      period: "Apr 2024",
    });
    render(<UsageWidget />);
    await waitFor(() => {
      expect(screen.getByText("3 / 5 analyses used")).toBeInTheDocument();
    });
  });

  it("renders period label", async () => {
    mockGetUsageSummary.mockResolvedValue({
      tier: "free",
      analyses: { used: 2, limit: 5, pct: 40 },
      period: "Apr 2024",
    });
    render(<UsageWidget />);
    await waitFor(() => {
      expect(screen.getByText("Apr 2024")).toBeInTheDocument();
    });
  });

  it("shows 'Monthly limit reached' when at limit", async () => {
    mockGetUsageSummary.mockResolvedValue({
      tier: "free",
      analyses: { used: 5, limit: 5, pct: 100 },
      period: "Apr 2024",
    });
    render(<UsageWidget />);
    await waitFor(() => {
      expect(screen.getByText("Monthly limit reached")).toBeInTheDocument();
    });
  });

  it("shows Upgrade link when near limit for free tier", async () => {
    mockGetUsageSummary.mockResolvedValue({
      tier: "free",
      analyses: { used: 4, limit: 5, pct: 80 },
      period: "Apr 2024",
    });
    render(<UsageWidget />);
    await waitFor(() => {
      const upgradeLink = screen.getByText("Upgrade");
      expect(upgradeLink.closest("a")).toHaveAttribute("href", "/pricing");
    });
  });

  it("does not show Upgrade link for pro tier even near limit", async () => {
    mockGetUsageSummary.mockResolvedValue({
      tier: "pro",
      analyses: { used: 45, limit: 50, pct: 90 },
      period: "Apr 2024",
    });
    render(<UsageWidget />);
    await waitFor(() => {
      expect(screen.queryByText("Upgrade")).not.toBeInTheDocument();
    });
  });

  it("renders nothing if getUsageSummary throws", async () => {
    mockGetUsageSummary.mockRejectedValue(new Error("network error"));
    const { container } = render(<UsageWidget />);
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });
});
