import React from "react";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/context/ThemeContext";

jest.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="next-themes-provider">{children}</div>
  ),
}));

describe("ThemeProvider", () => {
  it("renders children", () => {
    render(
      <ThemeProvider>
        <span data-testid="child">Hello</span>
      </ThemeProvider>
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("wraps children in NextThemesProvider", () => {
    render(
      <ThemeProvider>
        <span>Content</span>
      </ThemeProvider>
    );
    expect(screen.getByTestId("next-themes-provider")).toBeInTheDocument();
  });
});
