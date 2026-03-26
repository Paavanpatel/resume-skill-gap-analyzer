import React from "react";
import { render, screen, act } from "@testing-library/react";
import ShakeOnError from "@/components/ui/ShakeOnError";

describe("ShakeOnError", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders children", () => {
    render(
      <ShakeOnError trigger={false}>
        <p>Error field</p>
      </ShakeOnError>
    );
    expect(screen.getByText("Error field")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <ShakeOnError trigger={false}>
        <p>Content</p>
      </ShakeOnError>
    );
    expect(screen.getByTestId("shake-on-error")).toBeInTheDocument();
  });

  it("does not shake when trigger is false", () => {
    render(
      <ShakeOnError trigger={false}>
        <p>Content</p>
      </ShakeOnError>
    );
    const el = screen.getByTestId("shake-on-error");
    expect(el.getAttribute("data-shaking")).toBe("false");
  });

  it("shakes when trigger is true", () => {
    render(
      <ShakeOnError trigger={true}>
        <p>Content</p>
      </ShakeOnError>
    );
    const el = screen.getByTestId("shake-on-error");
    expect(el.getAttribute("data-shaking")).toBe("true");
    expect(el.className).toContain("animate-shake");
  });

  it("stops shaking after duration", () => {
    render(
      <ShakeOnError trigger={true} duration={500}>
        <p>Content</p>
      </ShakeOnError>
    );

    const el = screen.getByTestId("shake-on-error");
    expect(el.getAttribute("data-shaking")).toBe("true");

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(el.getAttribute("data-shaking")).toBe("false");
    expect(el.className).not.toContain("animate-shake");
  });

  it("applies custom className", () => {
    render(
      <ShakeOnError trigger={false} className="my-class">
        <p>Content</p>
      </ShakeOnError>
    );
    expect(screen.getByTestId("shake-on-error").className).toContain("my-class");
  });
});
