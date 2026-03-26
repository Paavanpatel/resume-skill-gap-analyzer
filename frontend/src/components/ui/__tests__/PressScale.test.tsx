import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import PressScale from "@/components/ui/PressScale";

describe("PressScale", () => {
  it("renders children", () => {
    render(
      <PressScale>
        <p>Clickable</p>
      </PressScale>
    );
    expect(screen.getByText("Clickable")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <PressScale>
        <p>Content</p>
      </PressScale>
    );
    expect(screen.getByTestId("press-scale")).toBeInTheDocument();
  });

  it("applies scale on mouseDown", () => {
    render(
      <PressScale scale={0.95}>
        <p>Press me</p>
      </PressScale>
    );

    const el = screen.getByTestId("press-scale");
    fireEvent.mouseDown(el);
    expect(el.style.transform).toBe("scale(0.95)");
  });

  it("removes scale on mouseUp", () => {
    render(
      <PressScale scale={0.95}>
        <p>Press me</p>
      </PressScale>
    );

    const el = screen.getByTestId("press-scale");
    fireEvent.mouseDown(el);
    fireEvent.mouseUp(el);
    expect(el.style.transform).toBe("");
  });

  it("removes scale on mouseLeave", () => {
    render(
      <PressScale>
        <p>Press me</p>
      </PressScale>
    );

    const el = screen.getByTestId("press-scale");
    fireEvent.mouseDown(el);
    fireEvent.mouseLeave(el);
    expect(el.style.transform).toBe("");
  });

  it("does not apply effects when disabled", () => {
    render(
      <PressScale enabled={false} className="my-class">
        <p>Disabled</p>
      </PressScale>
    );

    expect(screen.queryByTestId("press-scale")).not.toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("renders as button when specified", () => {
    render(
      <PressScale as="button">
        <span>Click</span>
      </PressScale>
    );

    const el = screen.getByTestId("press-scale");
    expect(el.tagName).toBe("BUTTON");
  });

  it("has hover translate class", () => {
    render(
      <PressScale>
        <p>Hover me</p>
      </PressScale>
    );

    const el = screen.getByTestId("press-scale");
    expect(el.className).toContain("hover:-translate-y-0.5");
  });
});
