import React from "react";
import { render, screen } from "@testing-library/react";
import NotFound from "@/app/not-found";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("NotFoundPage", () => {
  it("renders 404 text", () => {
    render(<NotFound />);
    expect(screen.getByText("404")).toBeInTheDocument();
  });

  it("renders page not found heading", () => {
    render(<NotFound />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<NotFound />);
    expect(
      screen.getByText(/The page you're looking for doesn't exist/)
    ).toBeInTheDocument();
  });

  it("renders dashboard link", () => {
    render(<NotFound />);
    const dashLink = screen.getByText("Go to Dashboard");
    expect(dashLink.closest("a")).toHaveAttribute("href", "/dashboard");
  });

  it("renders home link", () => {
    render(<NotFound />);
    const homeLink = screen.getByText("Back to Home");
    expect(homeLink.closest("a")).toHaveAttribute("href", "/");
  });
});
