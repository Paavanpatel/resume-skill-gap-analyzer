import React from "react";
import { render, screen, act } from "@testing-library/react";
import ScrollReveal from "@/components/ui/ScrollReveal";

// Mock IntersectionObserver
let observerCallback: (entries: any[]) => void;

const mockIntersectionObserver = jest.fn().mockImplementation((callback) => {
  observerCallback = callback;
  return {
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
  };
});

// Mock matchMedia for reduced-motion
const mockMatchMedia = jest.fn().mockImplementation((query) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));

Object.defineProperty(window, "IntersectionObserver", { value: mockIntersectionObserver });
Object.defineProperty(window, "matchMedia", { value: mockMatchMedia });

describe("ScrollReveal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children", () => {
    render(
      <ScrollReveal>
        <p>Hello</p>
      </ScrollReveal>
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <ScrollReveal>
        <p>Content</p>
      </ScrollReveal>
    );
    expect(screen.getByTestId("scroll-reveal")).toBeInTheDocument();
  });

  it("starts with opacity 0", () => {
    render(
      <ScrollReveal>
        <p>Content</p>
      </ScrollReveal>
    );
    const el = screen.getByTestId("scroll-reveal");
    expect(el.style.opacity).toBe("0");
  });

  it("becomes visible when intersecting", () => {
    render(
      <ScrollReveal>
        <p>Content</p>
      </ScrollReveal>
    );

    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });

    const el = screen.getByTestId("scroll-reveal");
    expect(el.style.opacity).toBe("1");
  });

  it("applies correct transform for direction=up", () => {
    render(
      <ScrollReveal direction="up" distance={24}>
        <p>Content</p>
      </ScrollReveal>
    );

    const el = screen.getByTestId("scroll-reveal");
    expect(el.style.transform).toBe("translate3d(0, 24px, 0)");

    act(() => {
      observerCallback([{ isIntersecting: true }]);
    });

    expect(el.style.transform).toBe("translate3d(0, 0, 0)");
  });

  it("applies correct transform for direction=left", () => {
    render(
      <ScrollReveal direction="left" distance={20}>
        <p>Content</p>
      </ScrollReveal>
    );

    const el = screen.getByTestId("scroll-reveal");
    expect(el.style.transform).toBe("translate3d(20px, 0, 0)");
  });

  it("applies delay in transition", () => {
    render(
      <ScrollReveal delay={200} duration={500}>
        <p>Content</p>
      </ScrollReveal>
    );

    const el = screen.getByTestId("scroll-reveal");
    expect(el.style.transition).toContain("200ms");
    expect(el.style.transition).toContain("500ms");
  });

  it("creates IntersectionObserver on mount", () => {
    render(
      <ScrollReveal>
        <p>Content</p>
      </ScrollReveal>
    );
    expect(mockIntersectionObserver).toHaveBeenCalled();
  });

  it("immediately shows content when prefers-reduced-motion", () => {
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    render(
      <ScrollReveal>
        <p>Content</p>
      </ScrollReveal>
    );

    const el = screen.getByTestId("scroll-reveal");
    expect(el.style.opacity).toBe("1");

    // Reset
    mockMatchMedia.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });
});
