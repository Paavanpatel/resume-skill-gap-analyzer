import React from "react";
import { render, screen, act } from "@testing-library/react";
import WizardTransition from "@/components/ui/WizardTransition";

describe("WizardTransition", () => {
  it("renders children", () => {
    render(
      <WizardTransition step={0}>
        <p>Step content</p>
      </WizardTransition>
    );
    expect(screen.getByText("Step content")).toBeInTheDocument();
  });

  it("renders with data-testid", () => {
    render(
      <WizardTransition step={0}>
        <p>Content</p>
      </WizardTransition>
    );
    expect(screen.getByTestId("wizard-transition")).toBeInTheDocument();
  });

  it("starts visible", () => {
    render(
      <WizardTransition step={0}>
        <p>Content</p>
      </WizardTransition>
    );
    const el = screen.getByTestId("wizard-transition");
    expect(el.style.opacity).toBe("1");
  });

  it("applies custom className", () => {
    render(
      <WizardTransition step={0} className="my-class">
        <p>Content</p>
      </WizardTransition>
    );
    expect(screen.getByTestId("wizard-transition").className).toContain("my-class");
  });

  it("applies will-change for performance", () => {
    render(
      <WizardTransition step={0}>
        <p>Content</p>
      </WizardTransition>
    );
    expect(screen.getByTestId("wizard-transition").className).toContain("will-change");
  });
});
