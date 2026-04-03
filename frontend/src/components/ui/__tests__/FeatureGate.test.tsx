import React from "react";
import { render, screen } from "@testing-library/react";
import FeatureGate from "@/components/ui/FeatureGate";

jest.mock("lucide-react", () => ({
  Lock: (props: any) => <span data-testid="icon-lock" {...props} />,
  Sparkles: (props: any) => <span data-testid="icon-sparkles" {...props} />,
  ArrowRight: (props: any) => <span data-testid="icon-arrow-right" {...props} />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockUseAuth = jest.fn();

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

describe("FeatureGate", () => {
  it("renders children when user tier meets requirement", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "pro" } });
    render(
      <FeatureGate requiredTier="pro" featureName="Roadmap">
        <span data-testid="pro-content">Pro Content</span>
      </FeatureGate>
    );
    expect(screen.getByTestId("pro-content")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-lock")).not.toBeInTheDocument();
  });

  it("renders children when user tier exceeds requirement", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "enterprise" } });
    render(
      <FeatureGate requiredTier="pro" featureName="Roadmap">
        <span data-testid="content">Content</span>
      </FeatureGate>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("shows upgrade prompt for free user requiring pro", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "free" } });
    render(
      <FeatureGate requiredTier="pro" featureName="Learning Roadmap">
        <span>Pro Content</span>
      </FeatureGate>
    );
    expect(screen.getByText(/Learning Roadmap is a/)).toBeInTheDocument();
    expect(screen.queryByText("Pro Content")).not.toBeInTheDocument();
  });

  it("shows upgrade prompt for free user requiring enterprise", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "free" } });
    render(
      <FeatureGate requiredTier="enterprise" featureName="API Access">
        <span>Enterprise Content</span>
      </FeatureGate>
    );
    expect(screen.getByText(/API Access is a/)).toBeInTheDocument();
  });

  it("shows upgrade prompt for pro user requiring enterprise", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "pro" } });
    render(
      <FeatureGate requiredTier="enterprise" featureName="Custom Integrations">
        <span>Enterprise Content</span>
      </FeatureGate>
    );
    expect(screen.queryByText("Enterprise Content")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
  });

  it("defaults to free tier when user is null", () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(
      <FeatureGate requiredTier="pro" featureName="Roadmap">
        <span>Pro Content</span>
      </FeatureGate>
    );
    expect(screen.queryByText("Pro Content")).not.toBeInTheDocument();
  });

  it("upgrade prompt has link to pricing page", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "free" } });
    render(
      <FeatureGate requiredTier="pro" featureName="Feature">
        <span>Content</span>
      </FeatureGate>
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/pricing");
  });

  it("upgrade prompt mentions the required tier", () => {
    mockUseAuth.mockReturnValue({ user: { tier: "free" } });
    render(
      <FeatureGate requiredTier="pro" featureName="Feature">
        <span>Content</span>
      </FeatureGate>
    );
    expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument();
  });
});
