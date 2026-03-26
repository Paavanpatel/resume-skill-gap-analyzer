import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import HistoryFilters from "@/components/dashboard/HistoryFilters";

describe("HistoryFilters", () => {
  const defaultProps = {
    onSearchChange: jest.fn(),
    onSortChange: jest.fn(),
    onStatusChange: jest.fn(),
    currentSort: "newest" as const,
    currentStatus: "all" as const,
    resultCount: 10,
    totalCount: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders search input", () => {
    render(<HistoryFilters {...defaultProps} />);
    expect(screen.getByTestId("history-search")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search job title or company...")).toBeInTheDocument();
  });

  it("renders status filter", () => {
    render(<HistoryFilters {...defaultProps} />);
    expect(screen.getByTestId("history-status-filter")).toBeInTheDocument();
  });

  it("renders sort selector", () => {
    render(<HistoryFilters {...defaultProps} />);
    expect(screen.getByTestId("history-sort")).toBeInTheDocument();
  });

  it("shows result count", () => {
    render(<HistoryFilters {...defaultProps} />);
    expect(screen.getByTestId("history-result-count").textContent).toBe("10 analyses");
  });

  it("shows filtered result count", () => {
    render(<HistoryFilters {...defaultProps} resultCount={3} totalCount={10} />);
    expect(screen.getByTestId("history-result-count").textContent).toBe("3 of 10 analyses");
  });

  it("debounces search input", async () => {
    render(<HistoryFilters {...defaultProps} />);
    const input = screen.getByTestId("history-search");

    fireEvent.change(input, { target: { value: "test" } });

    expect(defaultProps.onSearchChange).not.toHaveBeenCalled();

    jest.advanceTimersByTime(300);

    expect(defaultProps.onSearchChange).toHaveBeenCalledWith("test");
  });

  it("fires onSortChange when sort changes", () => {
    render(<HistoryFilters {...defaultProps} />);
    const sortSelect = screen.getByTestId("history-sort");

    fireEvent.change(sortSelect, { target: { value: "highest" } });

    expect(defaultProps.onSortChange).toHaveBeenCalledWith("highest");
  });

  it("fires onStatusChange when status changes", () => {
    render(<HistoryFilters {...defaultProps} />);
    const statusFilter = screen.getByTestId("history-status-filter");

    fireEvent.change(statusFilter, { target: { value: "completed" } });

    expect(defaultProps.onStatusChange).toHaveBeenCalledWith("completed");
  });

  it("shows clear filters button when filters active", () => {
    render(<HistoryFilters {...defaultProps} currentStatus="completed" />);
    expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
  });

  it("does not show clear filters when no filters active", () => {
    render(<HistoryFilters {...defaultProps} />);
    expect(screen.queryByTestId("clear-filters")).not.toBeInTheDocument();
  });

  it("clears search on X button click", () => {
    render(<HistoryFilters {...defaultProps} />);
    const input = screen.getByTestId("history-search");

    fireEvent.change(input, { target: { value: "test" } });

    const clearButton = screen.getByLabelText("Clear search");
    fireEvent.click(clearButton);

    expect((input as HTMLInputElement).value).toBe("");
    expect(defaultProps.onSearchChange).toHaveBeenCalledWith("");
  });

  it("handles singular analysis text", () => {
    render(<HistoryFilters {...defaultProps} resultCount={1} totalCount={1} />);
    expect(screen.getByTestId("history-result-count").textContent).toBe("1 analysis");
  });
});
