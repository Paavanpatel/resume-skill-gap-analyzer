import React from "react";
import { render, screen, act } from "@testing-library/react";
import OfflineBanner from "@/components/ui/OfflineBanner";

jest.mock("lucide-react", () => ({
  WifiOff: (props: any) => <span data-testid="icon-wifi-off" {...props} />,
}));

describe("OfflineBanner", () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, "onLine");

  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(navigator, "onLine", originalOnLine);
    }
  });

  it("renders nothing when online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    const { container } = render(<OfflineBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders offline banner when navigator.onLine is false on mount", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("shows WifiOff icon when offline", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    expect(screen.getByTestId("icon-wifi-off")).toBeInTheDocument();
  });

  it("has role=status and aria-live=polite", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);
    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("shows offline banner when offline event fires", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it("shows 'Back online!' after coming back online", () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByText("Back online!")).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("hides 'Back online!' after 3 seconds", () => {
    jest.useFakeTimers();
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });
    render(<OfflineBanner />);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.getByText("Back online!")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.queryByText("Back online!")).not.toBeInTheDocument();
    jest.useRealTimers();
  });
});
