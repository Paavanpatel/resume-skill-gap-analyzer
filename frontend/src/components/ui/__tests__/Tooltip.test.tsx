import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import userEvent from "@testing-library/user-event";
import Tooltip from "@/components/ui/Tooltip";

describe("Tooltip", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("does not show tooltip by default", () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on mouse enter after delay", async () => {
    render(
      <Tooltip content="Tooltip text" delay={200}>
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    fireEvent.mouseEnter(trigger);

    // Tooltip should not appear immediately
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    // Advance time past the delay
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
  });

  it("hides tooltip on mouse leave", async () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows tooltip on focus", async () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Focus me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByText("Tooltip text")).toBeInTheDocument();
  });

  it("hides tooltip on blur", async () => {
    render(
      <Tooltip content="Tooltip text">
        <button>Focus me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    fireEvent.focus(trigger);
    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.blur(trigger);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("renders tooltip content text", async () => {
    render(
      <Tooltip content="Custom tooltip content">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByText("Custom tooltip content")).toBeInTheDocument();
  });

  it("applies correct position class for top", async () => {
    render(
      <Tooltip content="Top tooltip" position="top">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("bottom-full");
    expect(tooltip.className).toContain("mb-2");
  });

  it("applies correct position class for bottom", async () => {
    render(
      <Tooltip content="Bottom tooltip" position="bottom">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("top-full");
    expect(tooltip.className).toContain("mt-2");
  });

  it("applies correct position class for left", async () => {
    render(
      <Tooltip content="Left tooltip" position="left">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("right-full");
    expect(tooltip.className).toContain("mr-2");
  });

  it("applies correct position class for right", async () => {
    render(
      <Tooltip content="Right tooltip" position="right">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("left-full");
    expect(tooltip.className).toContain("ml-2");
  });

  it("has role='tooltip' attribute", async () => {
    render(
      <Tooltip content="Accessible tooltip">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toHaveAttribute("role", "tooltip");
  });

  it("clears timeout on mouse leave before delay", () => {
    render(
      <Tooltip content="Tooltip text" delay={500}>
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    fireEvent.mouseEnter(trigger);

    // Leave before delay completes
    jest.advanceTimersByTime(100);
    fireEvent.mouseLeave(trigger);
    jest.advanceTimersByTime(400);

    // Tooltip should not appear
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("merges custom className", async () => {
    render(
      <Tooltip content="Tooltip" className="custom-class">
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    act(() => {
      fireEvent.mouseEnter(trigger);
      jest.advanceTimersByTime(200);
    });

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip.className).toContain("custom-class");
  });

  it("respects custom delay prop", () => {
    const { rerender } = render(
      <Tooltip content="Tooltip" delay={100}>
        <button>Hover me</button>
      </Tooltip>
    );

    const trigger = screen.getByRole("button");
    fireEvent.mouseEnter(trigger);

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(50);
    });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });
});
