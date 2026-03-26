import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Button from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("applies primary variant by default", () => {
    render(<Button>Primary</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-primary-600");
  });

  it("applies outline variant", () => {
    render(<Button variant="outline">Outline</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("border");
  });

  it("applies danger variant", () => {
    render(<Button variant="danger">Delete</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("bg-danger-600");
  });

  it("handles click events", () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("disables when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("disables when isLoading is true", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("shows loader icon when isLoading", () => {
    render(<Button isLoading>Loading</Button>);
    expect(screen.getByTestId("icon-Loader2")).toBeInTheDocument();
  });

  it("applies size classes", () => {
    render(<Button size="lg">Large</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("px-6");
  });

  it("merges custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    const btn = screen.getByRole("button");
    expect(btn.className).toContain("custom-class");
  });
});
