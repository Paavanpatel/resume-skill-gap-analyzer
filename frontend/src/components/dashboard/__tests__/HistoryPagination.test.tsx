import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import HistoryPagination from "@/components/dashboard/HistoryPagination";

describe("HistoryPagination", () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    itemsPerPage: 10,
    totalItems: 50,
    onPageChange: jest.fn(),
    onItemsPerPageChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders when more than 10 items", () => {
    render(<HistoryPagination {...defaultProps} />);
    expect(screen.getByTestId("history-pagination")).toBeInTheDocument();
  });

  it("does not render when 10 or fewer items", () => {
    render(<HistoryPagination {...defaultProps} totalItems={10} totalPages={1} />);
    expect(screen.queryByTestId("history-pagination")).not.toBeInTheDocument();
  });

  it("shows correct range text", () => {
    render(<HistoryPagination {...defaultProps} />);
    expect(screen.getByText(/Showing 1–10 of 50/)).toBeInTheDocument();
  });

  it("shows correct range on page 2", () => {
    render(<HistoryPagination {...defaultProps} currentPage={2} />);
    expect(screen.getByText(/Showing 11–20 of 50/)).toBeInTheDocument();
  });

  it("calls onPageChange when page button clicked", () => {
    render(<HistoryPagination {...defaultProps} />);
    fireEvent.click(screen.getByTestId("page-2"));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange when next button clicked", () => {
    render(<HistoryPagination {...defaultProps} />);
    fireEvent.click(screen.getByLabelText("Next page"));
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables previous button on first page", () => {
    render(<HistoryPagination {...defaultProps} currentPage={1} />);
    const prevButton = screen.getByLabelText("Previous page");
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<HistoryPagination {...defaultProps} currentPage={5} />);
    const nextButton = screen.getByLabelText("Next page");
    expect(nextButton).toBeDisabled();
  });

  it("highlights current page", () => {
    render(<HistoryPagination {...defaultProps} currentPage={3} />);
    const page3 = screen.getByTestId("page-3");
    expect(page3.className).toContain("bg-primary-500");
  });

  it("changes items per page", () => {
    render(<HistoryPagination {...defaultProps} />);
    const select = screen.getByTestId("items-per-page");
    fireEvent.change(select, { target: { value: "20" } });
    expect(defaultProps.onItemsPerPageChange).toHaveBeenCalledWith(20);
  });
});
