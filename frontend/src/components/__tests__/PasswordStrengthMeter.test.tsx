import React from "react";
import { render, screen } from "@testing-library/react";
import PasswordStrengthMeter, {
  getRequirements,
  getStrength,
} from "@/components/ui/PasswordStrengthMeter";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Check: (props: any) => <span data-testid="icon-check" {...props} />,
  X: (props: any) => <span data-testid="icon-x" {...props} />,
}));

describe("PasswordStrengthMeter", () => {
  it("renders nothing when password is empty", () => {
    const { container } = render(<PasswordStrengthMeter password="" />);
    expect(container.firstChild).toBeNull();
  });

  it("shows all four requirements", () => {
    render(<PasswordStrengthMeter password="a" />);
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByText("One uppercase letter")).toBeInTheDocument();
    expect(screen.getByText("One number")).toBeInTheDocument();
    expect(screen.getByText("One special character")).toBeInTheDocument();
  });

  it("shows Weak label for score 1", () => {
    // "A" meets only the uppercase requirement (1 of 4)
    render(<PasswordStrengthMeter password="A" />);
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("shows Strong label when all requirements met", () => {
    render(<PasswordStrengthMeter password="StrongP1!" />);
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });
});

describe("getRequirements", () => {
  it("checks length", () => {
    const reqs = getRequirements("short");
    expect(reqs[0].met).toBe(false);

    const reqs2 = getRequirements("longpassword");
    expect(reqs2[0].met).toBe(true);
  });

  it("checks uppercase", () => {
    expect(getRequirements("abc")[1].met).toBe(false);
    expect(getRequirements("Abc")[1].met).toBe(true);
  });

  it("checks number", () => {
    expect(getRequirements("abc")[2].met).toBe(false);
    expect(getRequirements("abc1")[2].met).toBe(true);
  });

  it("checks special character", () => {
    expect(getRequirements("abc")[3].met).toBe(false);
    expect(getRequirements("abc!")[3].met).toBe(true);
  });
});

describe("getStrength", () => {
  it("returns empty for score 0", () => {
    const reqs = [
      { label: "a", met: false },
      { label: "b", met: false },
      { label: "c", met: false },
      { label: "d", met: false },
    ];
    expect(getStrength(reqs).score).toBe(0);
    expect(getStrength(reqs).label).toBe("");
  });

  it("returns Weak for score 1", () => {
    const reqs = [
      { label: "a", met: true },
      { label: "b", met: false },
      { label: "c", met: false },
      { label: "d", met: false },
    ];
    expect(getStrength(reqs).score).toBe(1);
    expect(getStrength(reqs).label).toBe("Weak");
  });

  it("returns Strong for score 4", () => {
    const reqs = [
      { label: "a", met: true },
      { label: "b", met: true },
      { label: "c", met: true },
      { label: "d", met: true },
    ];
    expect(getStrength(reqs).score).toBe(4);
    expect(getStrength(reqs).label).toBe("Strong");
  });
});
