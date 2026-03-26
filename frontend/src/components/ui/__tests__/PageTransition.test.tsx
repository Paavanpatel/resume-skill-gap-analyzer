import React from "react";
import { render, screen, act } from "@testing-library/react";
import PageTransition from "@/components/ui/PageTransition";

let mockPathname = "/dashboard";

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

describe("PageTransition", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockPathname = "/dashboard";
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders children", () => {
    render(
      <PageTransition>
        <p>Hello World</p>
      </PageTransition>
    );
    expect(screen.getByText("Hello World")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <PageTransition>
        <p>Content</p>
      </PageTransition>
    );
    expect(screen.getByTestId("page-transition")).toBeInTheDocument();
  });

  it("starts invisible and becomes visible after mount", () => {
    render(
      <PageTransition>
        <p>Content</p>
      </PageTransition>
    );

    const el = screen.getByTestId("page-transition");

    // Advance timer to trigger visibility
    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(el.className).toContain("opacity-100");
  });

  it("applies slide-up variant classes", () => {
    render(
      <PageTransition variant="slide-up">
        <p>Content</p>
      </PageTransition>
    );

    const el = screen.getByTestId("page-transition");

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(el.className).toContain("translate-y-0");
  });

  it("applies custom duration via style", () => {
    render(
      <PageTransition duration={500}>
        <p>Content</p>
      </PageTransition>
    );

    const el = screen.getByTestId("page-transition");
    expect(el.style.transitionDuration).toBe("500ms");
  });

  it("applies fade variant (default)", () => {
    render(
      <PageTransition>
        <p>Content</p>
      </PageTransition>
    );

    const el = screen.getByTestId("page-transition");

    act(() => {
      jest.advanceTimersByTime(50);
    });

    expect(el.className).toContain("opacity-100");
  });
});
