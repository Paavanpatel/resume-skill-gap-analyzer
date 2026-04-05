import React from "react";
import { render, screen } from "@testing-library/react";
import Divider from "@/components/ui/Divider";

describe("Divider", () => {
  it("renders an hr element when no label is provided", () => {
    const { container } = render(<Divider />);
    expect(container.querySelector("hr")).toBeInTheDocument();
  });

  it("renders with label text", () => {
    render(<Divider label="OR" />);
    expect(screen.getByText("OR")).toBeInTheDocument();
  });

  it("renders divider lines around label", () => {
    const { container } = render(<Divider label="AND" />);
    const dividers = container.querySelectorAll(".border-t");
    expect(dividers.length).toBe(2);
  });

  it("applies custom className to plain hr", () => {
    const { container } = render(<Divider className="my-custom" />);
    expect(container.querySelector("hr")).toHaveClass("my-custom");
  });

  it("applies custom className to labelled container", () => {
    const { container } = render(<Divider label="OR" className="my-custom" />);
    expect(container.firstChild).toHaveClass("my-custom");
  });
});
