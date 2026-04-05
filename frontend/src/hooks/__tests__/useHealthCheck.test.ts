import { renderHook, act, waitFor } from "@testing-library/react";
import { useHealthCheck } from "@/hooks/useHealthCheck";

const mockGetHealthReady = jest.fn();

jest.mock("@/lib/api", () => ({
  getHealthReady: () => mockGetHealthReady(),
}));

describe("useHealthCheck", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetHealthReady.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts with unknown status and isLoading=true", () => {
    mockGetHealthReady.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useHealthCheck(0));
    expect(result.current.status).toBe("unknown");
    expect(result.current.isLoading).toBe(true);
    expect(result.current.checks).toBeNull();
    expect(result.current.lastChecked).toBeNull();
  });

  it("updates to healthy status on successful poll", async () => {
    mockGetHealthReady.mockResolvedValue({
      status: "healthy",
      checks: { database: "ok", redis: "ok" },
    });

    const { result } = renderHook(() => useHealthCheck(0));

    await waitFor(() => {
      expect(result.current.status).toBe("healthy");
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.checks).toEqual({ database: "ok", redis: "ok" });
    expect(result.current.lastChecked).toBeInstanceOf(Date);
  });

  it("updates to degraded status", async () => {
    mockGetHealthReady.mockResolvedValue({
      status: "degraded",
      checks: { database: "ok", celery: "no_workers" },
    });

    const { result } = renderHook(() => useHealthCheck(0));

    await waitFor(() => {
      expect(result.current.status).toBe("degraded");
    });
  });

  it("updates to unhealthy status", async () => {
    mockGetHealthReady.mockResolvedValue({
      status: "unhealthy",
      checks: { database: "error" },
    });

    const { result } = renderHook(() => useHealthCheck(0));

    await waitFor(() => {
      expect(result.current.status).toBe("unhealthy");
    });
  });

  it("sets status to unknown on network error", async () => {
    mockGetHealthReady.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useHealthCheck(0));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.status).toBe("unknown");
    expect(result.current.lastChecked).toBeInstanceOf(Date);
  });

  it("sets up polling interval when intervalMs > 0", async () => {
    mockGetHealthReady.mockResolvedValue({
      status: "healthy",
      checks: {},
    });

    const { result } = renderHook(() => useHealthCheck(5000));

    await waitFor(() => {
      expect(result.current.status).toBe("healthy");
    });

    const callsBefore = mockGetHealthReady.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(mockGetHealthReady.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("does not poll when intervalMs is 0", async () => {
    mockGetHealthReady.mockResolvedValue({
      status: "healthy",
      checks: {},
    });

    const { result } = renderHook(() => useHealthCheck(0));

    await waitFor(() => {
      expect(result.current.status).toBe("healthy");
    });

    const callsAfterMount = mockGetHealthReady.mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(30000);
    });

    expect(mockGetHealthReady.mock.calls.length).toBe(callsAfterMount);
  });

  it("clears interval on unmount", async () => {
    mockGetHealthReady.mockResolvedValue({ status: "healthy", checks: {} });

    const { unmount } = renderHook(() => useHealthCheck(1000));

    await waitFor(() => expect(mockGetHealthReady).toHaveBeenCalled());

    const callCount = mockGetHealthReady.mock.calls.length;
    unmount();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockGetHealthReady.mock.calls.length).toBe(callCount);
  });
});
