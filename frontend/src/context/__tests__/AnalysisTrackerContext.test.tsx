import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AnalysisTrackerProvider, useAnalysisTracker } from "@/context/AnalysisTrackerContext";

// ── Mock API ────────────────────────────────────────────────

const mockGetAnalysisStatus = jest.fn();

jest.mock("@/lib/api", () => ({
  getAnalysisStatus: (...args: any[]) => mockGetAnalysisStatus(...args),
  getStoredTokens: jest.fn(() => null),
  getErrorMessage: (err: any) => err?.message || "Something went wrong",
}));

// ── Test consumer to expose context values ──────────────────

function TestConsumer({
  onRender,
}: {
  onRender?: (ctx: ReturnType<typeof useAnalysisTracker>) => void;
}) {
  const ctx = useAnalysisTracker();
  if (onRender) onRender(ctx);
  return (
    <div>
      <span data-testid="active-count">{ctx.activeCount}</span>
      <span data-testid="completed-count">{ctx.completedCount}</span>
      <span data-testid="analyses-count">{ctx.analyses.length}</span>
      {ctx.analyses.map((a) => (
        <div key={a.jobId} data-testid={`analysis-${a.jobId}`}>
          <span data-testid={`label-${a.jobId}`}>{a.label}</span>
          <span data-testid={`status-${a.jobId}`}>{a.status?.status ?? "null"}</span>
          <span data-testid={`dismissed-${a.jobId}`}>{a.dismissed ? "yes" : "no"}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────

function renderWithProvider(onRender?: (ctx: ReturnType<typeof useAnalysisTracker>) => void) {
  return render(
    <AnalysisTrackerProvider>
      <TestConsumer onRender={onRender} />
    </AnalysisTrackerProvider>
  );
}

describe("AnalysisTrackerContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("throws when used outside provider", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<TestConsumer />)).toThrow(
      "useAnalysisTracker must be used within AnalysisTrackerProvider"
    );
    spy.mockRestore();
  });

  it("starts with empty state", () => {
    renderWithProvider();
    expect(screen.getByTestId("active-count").textContent).toBe("0");
    expect(screen.getByTestId("completed-count").textContent).toBe("0");
    expect(screen.getByTestId("analyses-count").textContent).toBe("0");
  });

  it("tracks a new analysis and polls for status", async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "job-1",
      status: "processing",
      progress: 30,
      current_step: "Extracting skills",
      error_message: null,
    });

    let trackFn: (jobId: string, label: string) => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
    });

    // Track a new analysis
    await act(async () => {
      trackFn("job-1", "Senior Engineer");
    });

    // The immediate poll should have fired
    await waitFor(() => {
      expect(mockGetAnalysisStatus).toHaveBeenCalledWith("job-1");
    });

    expect(screen.getByTestId("analyses-count").textContent).toBe("1");
    expect(screen.getByTestId("label-job-1").textContent).toBe("Senior Engineer");
    expect(screen.getByTestId("active-count").textContent).toBe("1");
  });

  it("stops polling when analysis completes", async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "job-2",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });

    let trackFn: (jobId: string, label: string) => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
    });

    await act(async () => {
      trackFn("job-2", "Data Scientist");
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-job-2").textContent).toBe("completed");
    });

    expect(screen.getByTestId("active-count").textContent).toBe("0");
    expect(screen.getByTestId("completed-count").textContent).toBe("1");

    // Clear call count and advance timer — should NOT poll again
    mockGetAnalysisStatus.mockClear();
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Only the initial poll, no additional calls
    expect(mockGetAnalysisStatus).not.toHaveBeenCalled();
  });

  it("tracks failed analyses", async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "job-3",
      status: "failed",
      progress: 0,
      current_step: null,
      error_message: "LLM provider error",
    });

    let trackFn: (jobId: string, label: string) => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
    });

    await act(async () => {
      trackFn("job-3", "Failed Job");
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-job-3").textContent).toBe("failed");
    });

    expect(screen.getByTestId("active-count").textContent).toBe("0");
  });

  it("dismisses a specific analysis", async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "job-4",
      status: "completed",
      progress: 100,
      current_step: null,
      error_message: null,
    });

    let trackFn: (jobId: string, label: string) => void = () => {};
    let dismissFn: (jobId: string) => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
      dismissFn = ctx.dismiss;
    });

    await act(async () => {
      trackFn("job-4", "To Dismiss");
    });

    await waitFor(() => {
      expect(screen.getByTestId("dismissed-job-4").textContent).toBe("no");
    });

    act(() => {
      dismissFn("job-4");
    });

    expect(screen.getByTestId("dismissed-job-4").textContent).toBe("yes");
    expect(screen.getByTestId("completed-count").textContent).toBe("0");
  });

  it("dismissAll dismisses all completed/failed analyses", async () => {
    // First analysis: completed
    mockGetAnalysisStatus
      .mockResolvedValueOnce({
        job_id: "job-5",
        status: "completed",
        progress: 100,
        current_step: null,
        error_message: null,
      })
      .mockResolvedValueOnce({
        job_id: "job-6",
        status: "failed",
        progress: 0,
        current_step: null,
        error_message: "Error",
      });

    let trackFn: (jobId: string, label: string) => void = () => {};
    let dismissAllFn: () => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
      dismissAllFn = ctx.dismissAll;
    });

    await act(async () => {
      trackFn("job-5", "Completed");
    });
    await act(async () => {
      trackFn("job-6", "Failed");
    });

    await waitFor(() => {
      expect(screen.getByTestId("status-job-5").textContent).toBe("completed");
    });

    act(() => {
      dismissAllFn();
    });

    expect(screen.getByTestId("dismissed-job-5").textContent).toBe("yes");
    expect(screen.getByTestId("dismissed-job-6").textContent).toBe("yes");
  });

  it("does not add duplicate analyses", async () => {
    mockGetAnalysisStatus.mockResolvedValue({
      job_id: "job-dup",
      status: "processing",
      progress: 50,
      current_step: "Working",
      error_message: null,
    });

    let trackFn: (jobId: string, label: string) => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
    });

    await act(async () => {
      trackFn("job-dup", "First");
    });
    await act(async () => {
      trackFn("job-dup", "Duplicate");
    });

    expect(screen.getByTestId("analyses-count").textContent).toBe("1");
    expect(screen.getByTestId("label-job-dup").textContent).toBe("First");
  });

  it("handles poll errors gracefully", async () => {
    mockGetAnalysisStatus.mockRejectedValue(new Error("Network timeout"));

    let trackFn: (jobId: string, label: string) => void = () => {};

    renderWithProvider((ctx) => {
      trackFn = ctx.track;
    });

    await act(async () => {
      trackFn("job-err", "Error Job");
    });

    // Should still be tracked, just with an error
    await waitFor(() => {
      expect(screen.getByTestId("analyses-count").textContent).toBe("1");
    });

    // Active count still 1 because it hasn't reached terminal state
    expect(screen.getByTestId("active-count").textContent).toBe("1");
  });
});
