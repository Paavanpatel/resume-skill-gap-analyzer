import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import GlobalError from "@/app/error";

describe("GlobalError", () => {
  const mockReset = jest.fn();
  const mockError = new Error("Something broke") as Error & { digest?: string };

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    mockReset.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders with data-testid", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByTestId("global-error")).toBeInTheDocument();
  });

  it("displays error heading", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("displays error description", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(
      screen.getByText(/unexpected error occurred/i)
    ).toBeInTheDocument();
  });

  it("renders Try Again button", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("calls reset on Try Again click", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("logs error to console", () => {
    render(<GlobalError error={mockError} reset={mockReset} />);
    expect(console.error).toHaveBeenCalledWith("[Global Error]", mockError);
  });
});
