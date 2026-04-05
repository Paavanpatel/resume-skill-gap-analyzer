import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import RateLimitBanner from "@/components/ui/RateLimitBanner";

jest.mock("lucide-react", () => ({
  AlertTriangle: (props: any) => <span data-testid="icon-alert" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}));

const mockUseRateLimit = jest.fn();

jest.mock("@/hooks/useRateLimit", () => ({
  useRateLimit: (cb: any) => mockUseRateLimit(cb),
}));

describe("RateLimitBanner", () => {
  beforeEach(() => {
    mockUseRateLimit.mockReturnValue({
      isLimited: false,
      secondsRemaining: 0,
      retryAfter: 0,
    });
  });

  it("renders nothing when not rate limited", () => {
    const { container } = render(<RateLimitBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders banner when rate limited", () => {
    mockUseRateLimit.mockReturnValue({
      isLimited: true,
      secondsRemaining: 30,
      retryAfter: 30,
    });
    render(<RateLimitBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Too many requests.")).toBeInTheDocument();
  });

  it("shows seconds countdown", () => {
    mockUseRateLimit.mockReturnValue({
      isLimited: true,
      secondsRemaining: 45,
      retryAfter: 45,
    });
    render(<RateLimitBanner />);
    expect(screen.getByText("Try again in 45s.")).toBeInTheDocument();
  });

  it("shows minutes and seconds when over 60 seconds", () => {
    mockUseRateLimit.mockReturnValue({
      isLimited: true,
      secondsRemaining: 90,
      retryAfter: 90,
    });
    render(<RateLimitBanner />);
    expect(screen.getByText("Try again in 1m 30s.")).toBeInTheDocument();
  });

  it("dismiss button hides the banner", () => {
    mockUseRateLimit.mockReturnValue({
      isLimited: true,
      secondsRemaining: 30,
      retryAfter: 30,
    });
    render(<RateLimitBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Dismiss rate limit warning"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("calls useRateLimit with a callback that resets dismissed state", () => {
    let capturedCallback: any;
    mockUseRateLimit.mockImplementation((cb: any) => {
      capturedCallback = cb;
      return { isLimited: true, secondsRemaining: 10, retryAfter: 10 };
    });

    render(<RateLimitBanner />);

    // Dismiss the banner
    fireEvent.click(screen.getByLabelText("Dismiss rate limit warning"));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    // Simulate a new rate-limit event via the callback
    act(() => capturedCallback());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    mockUseRateLimit.mockReturnValue({
      isLimited: true,
      secondsRemaining: 10,
      retryAfter: 10,
    });
    render(<RateLimitBanner className="custom-class" />);
    expect(screen.getByRole("alert")).toHaveClass("custom-class");
  });
});
