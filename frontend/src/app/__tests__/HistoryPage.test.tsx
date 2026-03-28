import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@/__tests__/test-utils";
import HistoryPage from "@/app/(dashboard)/history/page";

const mockPush = jest.fn();
const mockGetAnalysisHistory = jest.fn();
const mockGetAnalysisResult = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/history",
}));

jest.mock("@/lib/api", () => ({
  getAnalysisHistory: (...args: any[]) => mockGetAnalysisHistory(...args),
  getAnalysisResult: (...args: any[]) => mockGetAnalysisResult(...args),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

// Mock recharts to avoid canvas issues in jsdom
jest.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
}));

jest.mock("@/context/AnalysisTrackerContext", () => ({
  useAnalysisTracker: () => ({
    analyses: [],
    track: jest.fn(),
    dismiss: jest.fn(),
    dismissAll: jest.fn(),
    activeCount: 0,
    completedCount: 0,
  }),
}));

// Mock IntersectionObserver for AnimatedCounter
const mockIntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));
Object.defineProperty(window, "IntersectionObserver", {
  value: mockIntersectionObserver,
});

const mockItems = [
  {
    id: "analysis-1",
    job_title: "Senior Developer",
    job_company: "Acme Corp",
    match_score: 75,
    ats_score: 80,
    status: "completed",
    created_at: "2024-06-15T10:30:00Z",
  },
  {
    id: "analysis-2",
    job_title: "Product Manager",
    job_company: "BigCo",
    match_score: 55,
    ats_score: 60,
    status: "completed",
    created_at: "2024-06-16T14:00:00Z",
  },
  {
    id: "analysis-3",
    job_title: null,
    job_company: null,
    match_score: null,
    ats_score: null,
    status: "processing",
    created_at: "2024-06-17T09:00:00Z",
  },
];

describe("HistoryPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading skeleton initially", async () => {
    mockGetAnalysisHistory.mockImplementation(() => new Promise(() => {}));

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })
    // // Should show skeleton loading state (not Loader2 anymore)
    // expect(document.querySelectorAll('[class*="animate"]').length).toBeGreaterThan(0);
    // // Should show skeleton loading state
    expect(document.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it("shows empty state when no analyses exist", async () => {
    mockGetAnalysisHistory.mockResolvedValue([]);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("No analyses yet")).toBeInTheDocument();
    });

    expect(screen.getByText("Start Your First Analysis")).toBeInTheDocument();
  });

  it("renders analysis history items with stats bar", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("Product Manager")).toBeInTheDocument();
    expect(screen.getByText("BigCo")).toBeInTheDocument();

    // Stats bar should be present
    expect(screen.getByTestId("history-stats-bar")).toBeInTheDocument();
  });

  it("navigates to analysis on card click", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    const card = screen.getByText("Senior Developer").closest("button");
    fireEvent.click(card!);
    expect(mockPush).toHaveBeenCalledWith("/analysis/analysis-1");
  });

  it("shows error on load failure", async () => {
    mockGetAnalysisHistory.mockRejectedValue(new Error("Network error"));

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("navigates to dashboard on New Analysis button", async () => {
    mockGetAnalysisHistory.mockResolvedValue([]);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("No analyses yet")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Start Your First Analysis"));
    expect(mockPush).toHaveBeenCalledWith("/dashboard");
  });

  it("filters by status", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    // Filter to completed only
    const statusFilter = screen.getByTestId("history-status-filter");
    fireEvent.change(statusFilter, { target: { value: "processing" } });

    await waitFor(() => {
      expect(screen.queryByText("Senior Developer")).not.toBeInTheDocument();
    });

    expect(screen.getByText("Untitled Position")).toBeInTheDocument();
  });

  it("sorts by highest score", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    const sortSelect = screen.getByTestId("history-sort");
    fireEvent.change(sortSelect, { target: { value: "highest" } });

    // First card should now be the one with 75 score
    await waitFor(() => {
      const cards = screen.getAllByText(/Developer|Manager|Untitled/);
      expect(cards[0].textContent).toContain("Senior Developer");
    });
  });

  it("searches by job title", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    const searchInput = screen.getByTestId("history-search");
    fireEvent.change(searchInput, { target: { value: "Product" } });

    // Wait for debounce
    await waitFor(
      () => {
        expect(screen.queryByText("Senior Developer")).not.toBeInTheDocument();
      },
      { timeout: 500 }
    );

    expect(screen.getByText("Product Manager")).toBeInTheDocument();
  });

  it("toggles comparison mode", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    // Enable compare mode
    const compareToggle = screen.getByTestId("compare-toggle");
    fireEvent.click(compareToggle);

    // Should show the compare bar
    await waitFor(() => {
      expect(screen.getByTestId("compare-bar")).toBeInTheDocument();
    });

    expect(screen.getByText("Select 2 analyses to compare")).toBeInTheDocument();
  });

  it("shows compare bar status when selecting analyses", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    // Enable compare mode
    fireEvent.click(screen.getByTestId("compare-toggle"));

    await waitFor(() => {
      expect(screen.getByTestId("compare-bar")).toBeInTheDocument();
    });

    // Select first item
    const checkbox1 = screen.getByTestId("compare-checkbox-analysis-1");
    fireEvent.click(checkbox1);

    await waitFor(() => {
      expect(screen.getByText("Select 1 more analysis to compare")).toBeInTheDocument();
    });

    // Select second item
    const checkbox2 = screen.getByTestId("compare-checkbox-analysis-2");
    fireEvent.click(checkbox2);

    await waitFor(() => {
      expect(screen.getByText("Ready to compare!")).toBeInTheDocument();
    });
  });

  it("shows result count", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })

    await waitFor(() => {
      expect(screen.getByTestId("history-result-count")).toBeInTheDocument();
    });

    expect(screen.getByTestId("history-result-count").textContent).toContain("3 analyses");
  });

  it("clears filters", async () => {
    mockGetAnalysisHistory.mockResolvedValue(mockItems);

    // render(<HistoryPage />);
      
    await act(async () => {
      render(<HistoryPage />);
      // Give the effect time to run
      await new Promise(resolve => setTimeout(resolve, 0));
    })


    await waitFor(() => {
      expect(screen.getByText("Senior Developer")).toBeInTheDocument();
    });

    // Apply a status filter
    const statusFilter = screen.getByTestId("history-status-filter");
    fireEvent.change(statusFilter, { target: { value: "completed" } });

    await waitFor(() => {
      expect(screen.getByTestId("clear-filters")).toBeInTheDocument();
    });

    // Click clear filters
    fireEvent.click(screen.getByTestId("clear-filters"));

    await waitFor(() => {
      expect(screen.queryByTestId("clear-filters")).not.toBeInTheDocument();
    });
  });
});
