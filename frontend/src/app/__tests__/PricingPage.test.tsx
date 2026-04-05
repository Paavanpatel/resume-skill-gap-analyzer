import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PricingPage from "@/app/pricing/page";

const mockPush = jest.fn();
let mockIsAuthenticated = false;
let mockUser: any = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, isAuthenticated: mockIsAuthenticated }),
}));

const mockCreateCheckoutSession = jest.fn();

jest.mock("@/lib/api", () => ({
  createCheckoutSession: (...args: any[]) => mockCreateCheckoutSession(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

jest.mock("lucide-react", () => {
  const MockIcon = (props: any) => <span {...props} />;
  return new Proxy({}, { get: () => MockIcon });
});

describe("PricingPage", () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockCreateCheckoutSession.mockReset();
    mockIsAuthenticated = false;
    mockUser = null;
  });

  it("renders page heading", () => {
    render(<PricingPage />);
    expect(screen.getByText("Simple, transparent pricing")).toBeInTheDocument();
  });

  it("renders all three plan names", () => {
    render(<PricingPage />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("renders plan prices", () => {
    render(<PricingPage />);
    expect(screen.getByText("$0")).toBeInTheDocument();
    expect(screen.getByText("$12")).toBeInTheDocument();
    expect(screen.getByText("$49")).toBeInTheDocument();
  });

  it("shows current plan label for authenticated user's tier", () => {
    mockUser = { tier: "pro" };
    mockIsAuthenticated = true;
    render(<PricingPage />);
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("shows user's current tier in header", () => {
    mockUser = { tier: "free" };
    mockIsAuthenticated = true;
    render(<PricingPage />);
    expect(screen.getByText(/You are currently on the/)).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
  });

  it("redirects to login when unauthenticated user clicks upgrade", () => {
    mockIsAuthenticated = false;
    render(<PricingPage />);
    fireEvent.click(screen.getByText("Upgrade to Pro"));
    expect(mockPush).toHaveBeenCalledWith("/login?redirect=/pricing");
  });

  it("redirects to dashboard when free plan is clicked (authenticated)", () => {
    mockIsAuthenticated = true;
    mockUser = { tier: "pro" };
    render(<PricingPage />);
    fireEvent.click(screen.getByText("Get Started"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("calls createCheckoutSession for pro plan", async () => {
    mockIsAuthenticated = true;
    mockUser = { tier: "free" };
    // Return a url that won't cause issues when assigned to window.location.href
    mockCreateCheckoutSession.mockResolvedValue({ url: "/" });

    render(<PricingPage />);
    fireEvent.click(screen.getByText("Upgrade to Pro"));

    await waitFor(() => {
      expect(mockCreateCheckoutSession).toHaveBeenCalledWith("pro");
    });
  });

  it("shows error when checkout session fails", async () => {
    mockIsAuthenticated = true;
    mockUser = { tier: "free" };
    mockCreateCheckoutSession.mockRejectedValue(new Error("Payment failed"));

    render(<PricingPage />);
    fireEvent.click(screen.getByText("Upgrade to Pro"));

    await waitFor(() => {
      expect(screen.getByText("Payment failed")).toBeInTheDocument();
    });
  });

  it("shows loading state while creating session", async () => {
    mockIsAuthenticated = true;
    mockUser = { tier: "free" };
    mockCreateCheckoutSession.mockReturnValue(new Promise(() => {}));

    render(<PricingPage />);
    fireEvent.click(screen.getByText("Upgrade to Pro"));

    await waitFor(() => {
      expect(screen.getByText("Redirecting…")).toBeInTheDocument();
    });
  });

  it("renders Most Popular badge on pro plan", () => {
    render(<PricingPage />);
    expect(screen.getByText("Most Popular")).toBeInTheDocument();
  });

  it("renders back to app link", () => {
    render(<PricingPage />);
    expect(screen.getByText("Back to app")).toBeInTheDocument();
  });

  it("renders money-back guarantee note", () => {
    render(<PricingPage />);
    expect(screen.getByText(/14-day money-back guarantee/)).toBeInTheDocument();
  });

  it("current plan button is disabled", () => {
    mockUser = { tier: "pro" };
    mockIsAuthenticated = true;
    render(<PricingPage />);
    const currentPlanBtn = screen.getByText("Current plan");
    expect(currentPlanBtn.closest("button")).toBeDisabled();
  });
});
