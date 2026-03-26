import React, { act } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CopyButton from "@/components/ui/CopyButton";

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  __esModule: true,
  Copy: (props: any) => <span data-testid="icon-copy" {...props} />,
  Check: (props: any) => <span data-testid="icon-check" {...props} />,
}));

describe("CopyButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
    });
    
  });

  describe("Basic rendering", () => {
    it("renders copy icon initially", () => {
      render(<CopyButton text="Copy me" />);

      expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
      expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
    });

    it("renders as a button", () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("has correct aria-label initially", () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Copy to clipboard");
    });

    it("renders without label when not provided", () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      // Should have icon but no text label
      expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
      expect(button.textContent).not.toContain("Copy");
    });
  });

  describe("Copy to clipboard functionality", () => {
    it("copies text to clipboard on click", async () => {
      const testText = "Hello, World!";
      render(<CopyButton text={testText} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testText);
      });
    });

    it("calls clipboard.writeText with the correct text", async () => {
      const textToCopy = "Test content";
      render(<CopyButton text={textToCopy} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(textToCopy);
      });
    });

    it("handles multiple copy operations", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");

      fireEvent.click(button);
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      fireEvent.click(button);
      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe("Visual feedback after copy", () => {
    it("shows check icon after copy", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("icon-check")).toBeInTheDocument();
        expect(screen.queryByTestId("icon-copy")).not.toBeInTheDocument();
      });
    });

    it("changes aria-label to Copied after copy", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-label", "Copied");
      });
    });

    it("shows Copied! label after copy when label provided", async () => {
      render(<CopyButton text="Copy me" label="Copy" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Copied!")).toBeInTheDocument();
      });
    });

    it("shows original label when no label prop provided", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("icon-check")).toBeInTheDocument();
      });

      // Without a label prop, text content should not change
      expect(button.textContent).toBe("");
    });
  });

  describe("Revert to initial state", () => {
    it("reverts to copy icon after 2 seconds", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("icon-check")).toBeInTheDocument();
      });

      // Advance time by 2 seconds
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
        expect(screen.queryByTestId("icon-check")).not.toBeInTheDocument();
      });
    });

    it("reverts label to original after 2 seconds", async () => {
      render(<CopyButton text="Copy me" label="Copy" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText("Copied!")).toBeInTheDocument();
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
        expect(screen.queryByText("Copied!")).not.toBeInTheDocument();
      });
    });

    it("reverts aria-label after 2 seconds", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-label", "Copied");
      });

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-label", "Copy to clipboard");
      });
    });

    it("exactly 1999ms does not revert", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId("icon-check")).toBeInTheDocument();
      });

      // Advance time by 1999ms (less than 2000)
      act(() => {
        jest.advanceTimersByTime(1999);
      });

      // Check icon should still be visible
      expect(screen.getByTestId("icon-check")).toBeInTheDocument();
      expect(screen.queryByTestId("icon-copy")).not.toBeInTheDocument();
    });
  });

  describe("Size variants", () => {
    it("renders sm size variant by default", () => {
      const { container } = render(<CopyButton text="Copy me" size="sm" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-2");
      expect(button).toHaveClass("py-1");
      expect(button).toHaveClass("text-xs");
    });

    it("renders md size variant", () => {
      const { container } = render(<CopyButton text="Copy me" size="md" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("px-3");
      expect(button).toHaveClass("py-1.5");
      expect(button).toHaveClass("text-sm");
    });

    it("applies correct icon size for sm", () => {
      const { container } = render(<CopyButton text="Copy me" size="sm" />);

      const icon = screen.getByTestId("icon-copy");
      expect(icon).toHaveClass("h-3.5");
      expect(icon).toHaveClass("w-3.5");
    });

    it("applies correct icon size for md", () => {
      const { container } = render(<CopyButton text="Copy me" size="md" />);

      const icon = screen.getByTestId("icon-copy");
      expect(icon).toHaveClass("h-4");
      expect(icon).toHaveClass("w-4");
    });
  });

  describe("Label rendering", () => {
    it("displays label text when provided", () => {
      render(<CopyButton text="Copy me" label="Copy URL" />);

      expect(screen.getByText("Copy URL")).toBeInTheDocument();
    });

    it("displays label with icon when provided", () => {
      render(<CopyButton text="Copy me" label="Copy" />);

      expect(screen.getByTestId("icon-copy")).toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
    });

    it("supports gap between icon and label", () => {
      const { container } = render(<CopyButton text="Copy me" label="Copy" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("gap-1.5");
    });
  });

  describe("Custom className", () => {
    it("applies custom className", () => {
      render(
        <CopyButton text="Copy me" className="custom-copy-btn" />
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-copy-btn");
    });

    it("preserves default classes with custom className", () => {
      render(
        <CopyButton text="Copy me" className="custom-class" />
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("inline-flex");
      expect(button).toHaveClass("items-center");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("Edge cases", () => {
    it("handles empty string text", async () => {
      render(<CopyButton text="" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith("");
      });
    });

    it("handles very long text", async () => {
      const longText = "a".repeat(10000);
      render(<CopyButton text={longText} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(longText);
      });
    });

    it("handles text with special characters", async () => {
      const specialText = "Special: !@#$%^&*()[]{}";
      render(<CopyButton text={specialText} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(specialText);
      });
    });

    it("handles text with newlines", async () => {
      const multilineText = "Line 1\nLine 2\nLine 3";
      render(<CopyButton text={multilineText} />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(multilineText);
      });
    });
  });

  describe("Accessibility", () => {
    it("is a button element", () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      expect(button.tagName).toBe("BUTTON");
    });

    it("has hover and focus styling classes", () => {
      const { container } = render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:text-gray-700");
      expect(button).toHaveClass("transition-all");
    });

    it("changes color when copied (success state)", async () => {
      render(<CopyButton text="Copy me" />);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveClass("text-success-600");
      });
    });
  });
});
