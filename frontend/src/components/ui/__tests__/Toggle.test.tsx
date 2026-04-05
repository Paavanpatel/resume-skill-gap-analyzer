import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import Toggle from "@/components/ui/Toggle";

// Test wrapper component for managing toggle state
function TestToggleWrapper({
  defaultChecked = false,
  ...props
}: {
  defaultChecked?: boolean;
  [key: string]: any;
}) {
  const [checked, setChecked] = useState(defaultChecked);

  return <Toggle checked={checked} onChange={setChecked} {...props} />;
}

describe("Toggle", () => {
  describe("Basic rendering", () => {
    it("renders toggle switch", () => {
      render(<TestToggleWrapper />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toBeInTheDocument();
    });

    it("shows label text when provided", () => {
      render(<TestToggleWrapper label="Enable Feature" />);

      expect(screen.getByText("Enable Feature")).toBeInTheDocument();
    });

    it("shows description text when provided", () => {
      render(
        <TestToggleWrapper label="Enable Feature" description="Turn this feature on or off" />
      );

      expect(screen.getByText("Turn this feature on or off")).toBeInTheDocument();
    });

    it("renders without label or description", () => {
      const { container } = render(<TestToggleWrapper />);

      const textElements = container.querySelectorAll("span, p");
      // Should only have the toggle button, no text elements
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });
  });

  describe("State and interactions", () => {
    it("calls onChange with opposite value on click", () => {
      const handleChange = jest.fn();

      render(<Toggle checked={false} onChange={handleChange} label="Test Toggle" />);

      const toggleButton = screen.getByRole("switch");
      fireEvent.click(toggleButton);

      expect(handleChange).toHaveBeenCalledWith(true);
    });

    it("calls onChange when unchecking", () => {
      const handleChange = jest.fn();

      render(<Toggle checked={true} onChange={handleChange} label="Test Toggle" />);

      const toggleButton = screen.getByRole("switch");
      fireEvent.click(toggleButton);

      expect(handleChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Accessibility attributes", () => {
    it("has correct aria-checked attribute when checked", () => {
      render(<TestToggleWrapper defaultChecked={true} />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveAttribute("aria-checked", "true");
    });

    it("has correct aria-checked attribute when unchecked", () => {
      render(<TestToggleWrapper defaultChecked={false} />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveAttribute("aria-checked", "false");
    });

    it("sets aria-label to label prop when provided", () => {
      render(<TestToggleWrapper label="Enable notifications" />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveAttribute("aria-label", "Enable notifications");
    });

    it("has role=switch attribute", () => {
      render(<TestToggleWrapper />);

      expect(screen.getByRole("switch")).toBeInTheDocument();
    });
  });

  describe("Disabled state", () => {
    it("disabled toggle does not fire onChange on click", () => {
      const handleChange = jest.fn();

      render(
        <Toggle checked={false} onChange={handleChange} disabled={true} label="Disabled Toggle" />
      );

      const toggleButton = screen.getByRole("switch");
      fireEvent.click(toggleButton);

      expect(handleChange).not.toHaveBeenCalled();
    });

    it("has disabled attribute when disabled prop is true", () => {
      render(<TestToggleWrapper disabled={true} />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toBeDisabled();
    });

    it("applies opacity styling when disabled", () => {
      const { container } = render(<TestToggleWrapper disabled={true} />);

      const label = container.querySelector("label");
      expect(label).toHaveClass("opacity-50");
    });

    it("disabled toggle still shows label and description", () => {
      render(
        <TestToggleWrapper
          disabled={true}
          label="Disabled Feature"
          description="This feature is disabled"
        />
      );

      expect(screen.getByText("Disabled Feature")).toBeInTheDocument();
      expect(screen.getByText("This feature is disabled")).toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("renders sm size variant", () => {
      const { container } = render(<TestToggleWrapper size="sm" />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveClass("h-5");
      expect(toggleButton).toHaveClass("w-9");
    });

    it("renders md size variant by default", () => {
      const { container } = render(<TestToggleWrapper />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveClass("h-6");
      expect(toggleButton).toHaveClass("w-11");
    });

    it("applies correct thumb positioning for sm size", () => {
      const { container } = render(<TestToggleWrapper size="sm" defaultChecked={true} />);

      const thumb = container.querySelector("span.absolute");
      expect(thumb).toHaveClass("translate-x-4");
    });

    it("applies correct thumb positioning for md size", () => {
      const { container } = render(<TestToggleWrapper size="md" defaultChecked={true} />);

      const thumb = container.querySelector("span.absolute");
      expect(thumb).toHaveClass("translate-x-5");
    });
  });

  describe("Visual states", () => {
    it("applies primary color when checked", () => {
      const { container } = render(<TestToggleWrapper defaultChecked={true} />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveClass("bg-primary-600");
    });

    it("applies gray color when unchecked", () => {
      const { container } = render(<TestToggleWrapper defaultChecked={false} />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveClass("bg-gray-300");
    });

    it("thumb translates when checked", () => {
      const { container } = render(<TestToggleWrapper defaultChecked={true} />);

      const thumb = container.querySelector("span.absolute");
      expect(thumb).toHaveClass("translate-x-5");
    });

    it("thumb does not translate when unchecked", () => {
      const { container } = render(<TestToggleWrapper defaultChecked={false} />);

      const thumb = container.querySelector("span.absolute");
      expect(thumb).not.toHaveClass("translate-x-5");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      const { container } = render(<TestToggleWrapper className="custom-toggle-class" />);

      const label = container.querySelector("label");
      expect(label).toHaveClass("custom-toggle-class");
    });
  });

  describe("Label and description together", () => {
    it("renders both label and description when provided", () => {
      render(
        <TestToggleWrapper label="Dark Mode" description="Enable dark mode for the interface" />
      );

      expect(screen.getByText("Dark Mode")).toBeInTheDocument();
      expect(screen.getByText("Enable dark mode for the interface")).toBeInTheDocument();
    });

    it("renders only label when description is not provided", () => {
      render(<TestToggleWrapper label="Feature Toggle" />);

      expect(screen.getByText("Feature Toggle")).toBeInTheDocument();
    });

    it("renders only description is not practical without label", () => {
      const { container } = render(<TestToggleWrapper description="Just a description" />);

      expect(screen.getByText("Just a description")).toBeInTheDocument();
    });
  });

  describe("Type attribute", () => {
    it("toggle button is of type button", () => {
      render(<TestToggleWrapper />);

      const toggleButton = screen.getByRole("switch");
      expect(toggleButton).toHaveAttribute("type", "button");
    });
  });
});
