import React from "react";
import { render, screen } from "@testing-library/react";
import AnimatedCounter from "@/components/ui/AnimatedCounter";

// Mock IntersectionObserver
const mockObserve = jest.fn();
const mockDisconnect = jest.fn();

class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe(el: Element) {
    mockObserve(el);
    // Immediately trigger intersection
    this.callback(
      [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver
    );
  }
  disconnect() {
    mockDisconnect();
  }
  unobserve = jest.fn();
}

// Mock requestAnimationFrame to complete animation in one frame
beforeAll(() => {
  Object.defineProperty(window, "IntersectionObserver", {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });

  // Run animation immediately by providing a timestamp well past the duration
  global.requestAnimationFrame = (cb: FrameRequestCallback) => {
    cb(9999); // elapsed >> duration, so progress=1 → completes in one call
    return 0;
  };
});

beforeEach(() => {
  mockObserve.mockClear();
  mockDisconnect.mockClear();
});

describe("AnimatedCounter", () => {
  it("renders a span element", () => {
    const { container } = render(<AnimatedCounter value={42} animateOnView={false} />);
    expect(container.querySelector("span")).toBeInTheDocument();
  });

  it("shows final value after animation when animateOnView=false", () => {
    render(<AnimatedCounter value={75} animateOnView={false} />);
    expect(screen.getByText("75")).toBeInTheDocument();
  });

  it("renders suffix", () => {
    render(<AnimatedCounter value={90} suffix="%" animateOnView={false} />);
    expect(screen.getByText("90%")).toBeInTheDocument();
  });

  it("renders prefix", () => {
    render(<AnimatedCounter value={10} prefix="$" animateOnView={false} />);
    expect(screen.getByText("$10")).toBeInTheDocument();
  });

  it("renders with decimals", () => {
    render(<AnimatedCounter value={3.14} decimals={2} animateOnView={false} />);
    expect(screen.getByText("3.14")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <AnimatedCounter value={10} className="my-counter" animateOnView={false} />
    );
    expect(container.querySelector("span")).toHaveClass("my-counter");
  });

  it("uses IntersectionObserver when animateOnView=true", () => {
    render(<AnimatedCounter value={100} animateOnView={true} />);
    expect(mockObserve).toHaveBeenCalled();
  });

  it("renders prefix + value + suffix together", () => {
    render(
      <AnimatedCounter value={50} prefix="#" suffix=" pts" animateOnView={false} />
    );
    expect(screen.getByText("#50 pts")).toBeInTheDocument();
  });

  it("has tabular-nums class", () => {
    const { container } = render(<AnimatedCounter value={10} animateOnView={false} />);
    expect(container.querySelector("span")).toHaveClass("tabular-nums");
  });
});
