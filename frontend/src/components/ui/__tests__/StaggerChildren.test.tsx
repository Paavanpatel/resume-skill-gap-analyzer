import React from "react";
import { render, screen, act } from "@testing-library/react";
import StaggerChildren from "@/components/ui/StaggerChildren";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe("StaggerChildren", () => {
  it("renders children", () => {
    render(
      <StaggerChildren>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </StaggerChildren>
    );

    expect(screen.getByText("Child 1")).toBeInTheDocument();
    expect(screen.getByText("Child 2")).toBeInTheDocument();
    expect(screen.getByText("Child 3")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <StaggerChildren>
        <div>Child</div>
      </StaggerChildren>
    );
    expect(screen.getByTestId("stagger-children")).toBeInTheDocument();
  });

  it("assigns stagger-child testids to each child", () => {
    render(
      <StaggerChildren>
        <div>A</div>
        <div>B</div>
      </StaggerChildren>
    );

    expect(screen.getByTestId("stagger-child-0")).toBeInTheDocument();
    expect(screen.getByTestId("stagger-child-1")).toBeInTheDocument();
  });

  it("children are immediately visible when not onScroll", () => {
    render(
      <StaggerChildren>
        <div>Visible</div>
      </StaggerChildren>
    );

    const child = screen.getByTestId("stagger-child-0");
    expect(child.style.opacity).toBe("1");
  });

  it("applies stagger delays", () => {
    render(
      <StaggerChildren staggerDelay={100} baseDelay={50}>
        <div>A</div>
        <div>B</div>
        <div>C</div>
      </StaggerChildren>
    );

    const child0 = screen.getByTestId("stagger-child-0");
    const child1 = screen.getByTestId("stagger-child-1");
    const child2 = screen.getByTestId("stagger-child-2");

    // Delays should be baseDelay + index * staggerDelay
    expect(child0.style.transition).toContain("50ms");
    expect(child1.style.transition).toContain("150ms");
    expect(child2.style.transition).toContain("250ms");
  });

  it("children start hidden when onScroll is true", () => {
    // Mock IntersectionObserver for this test
    const mockObserve = jest.fn();
    Object.defineProperty(window, "IntersectionObserver", {
      value: jest.fn().mockImplementation(() => ({
        observe: mockObserve,
        unobserve: jest.fn(),
        disconnect: jest.fn(),
      })),
      configurable: true,
    });

    render(
      <StaggerChildren onScroll>
        <div>Hidden initially</div>
      </StaggerChildren>
    );

    const child = screen.getByTestId("stagger-child-0");
    expect(child.style.opacity).toBe("0");
  });

  it("applies custom className", () => {
    render(
      <StaggerChildren className="my-custom-class">
        <div>Child</div>
      </StaggerChildren>
    );

    const container = screen.getByTestId("stagger-children");
    expect(container.className).toContain("my-custom-class");
  });
});
