import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ThemeToggle from "@/components/ui/ThemeToggle";

const mockSetTheme = jest.fn();
let mockTheme = "light";

jest.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    resolvedTheme: mockTheme,
  }),
}));

jest.mock("lucide-react", () => ({
  Sun: (props: any) => <span data-testid="icon-sun" {...props} />,
  Moon: (props: any) => <span data-testid="icon-moon" {...props} />,
  Monitor: (props: any) => <span data-testid="icon-monitor" {...props} />,
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
    mockTheme = "light";
  });

  describe("icon variant (default) - after mount", () => {
    it("renders a button after mounting", () => {
      render(<ThemeToggle />);
      // useEffect runs, setting mounted=true → real button renders
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("cycles from light to dark when clicked", () => {
      mockTheme = "light";
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole("button"));
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("cycles from dark to system when clicked", () => {
      mockTheme = "dark";
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole("button"));
      expect(mockSetTheme).toHaveBeenCalledWith("system");
    });

    it("cycles from system to light when clicked", () => {
      mockTheme = "system";
      render(<ThemeToggle />);
      fireEvent.click(screen.getByRole("button"));
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("has accessible aria-label", () => {
      mockTheme = "light";
      render(<ThemeToggle />);
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "Current theme: light. Click to change."
      );
    });

    it("applies custom className", () => {
      render(<ThemeToggle className="test-class" />);
      expect(screen.getByRole("button")).toHaveClass("test-class");
    });
  });

  describe("full variant", () => {
    it("renders three theme option buttons", () => {
      render(<ThemeToggle variant="full" />);
      expect(screen.getByText("Light")).toBeInTheDocument();
      expect(screen.getByText("Dark")).toBeInTheDocument();
      expect(screen.getByText("System")).toBeInTheDocument();
    });

    it("clicking Light sets light theme", () => {
      render(<ThemeToggle variant="full" />);
      fireEvent.click(screen.getByText("Light"));
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("clicking Dark sets dark theme", () => {
      render(<ThemeToggle variant="full" />);
      fireEvent.click(screen.getByText("Dark"));
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("clicking System sets system theme", () => {
      render(<ThemeToggle variant="full" />);
      fireEvent.click(screen.getByText("System"));
      expect(mockSetTheme).toHaveBeenCalledWith("system");
    });

    it("active theme button gets active styling", () => {
      mockTheme = "dark";
      render(<ThemeToggle variant="full" />);
      const darkBtn = screen.getByLabelText("Switch to Dark theme");
      expect(darkBtn).toHaveClass("bg-white");
    });

    it("inactive theme buttons do not have active styling", () => {
      mockTheme = "light";
      render(<ThemeToggle variant="full" />);
      const darkBtn = screen.getByLabelText("Switch to Dark theme");
      expect(darkBtn).not.toHaveClass("bg-white");
    });
  });
});
