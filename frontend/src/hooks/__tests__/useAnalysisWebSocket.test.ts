import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnalysisWebSocket } from "@/hooks/useAnalysisWebSocket";

// ── Mock WebSocket ─────────────────────────────────────────

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  close = jest.fn((_code?: number) => {
    this.readyState = MockWebSocket.CLOSED;
  });

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  simulateRawMessage(raw: string) {
    this.onmessage?.(new MessageEvent("message", { data: raw }));
  }

  simulateError() {
    this.onerror?.(new Event("error"));
  }

  simulateClose(code: number = 1000) {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code }));
  }
}

const latestWs = () => MockWebSocket.instances[MockWebSocket.instances.length - 1];

// ── Setup ──────────────────────────────────────────────────

beforeAll(() => {
  (global as any).WebSocket = MockWebSocket;
});

beforeEach(() => {
  MockWebSocket.instances = [];
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

const defaultOptions = {
  analysisId: "analysis-123",
  token: "jwt-token",
  enabled: true,
};

// ── Tests ──────────────────────────────────────────────────

describe("useAnalysisWebSocket", () => {
  it("returns initial disconnected state", () => {
    const { result } = renderHook(() =>
      useAnalysisWebSocket({ ...defaultOptions, enabled: false })
    );
    expect(result.current.status).toBeNull();
    expect(result.current.connectionStatus).toBe("disconnected");
    expect(result.current.isConnected).toBe(false);
  });

  it("does not connect when enabled=false", () => {
    renderHook(() => useAnalysisWebSocket({ ...defaultOptions, enabled: false }));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("does not connect when token is null", () => {
    renderHook(() => useAnalysisWebSocket({ ...defaultOptions, token: null }));
    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it("creates a WebSocket connection when enabled with token", () => {
    renderHook(() => useAnalysisWebSocket(defaultOptions));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(latestWs().url).toContain("/ws/analysis/analysis-123");
    expect(latestWs().url).toContain("token=jwt-token");
  });

  it("sets connectionStatus to connecting initially", () => {
    const { result } = renderHook(() => useAnalysisWebSocket(defaultOptions));
    expect(result.current.connectionStatus).toBe("connecting");
  });

  it("sets connectionStatus to connected on open", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket(defaultOptions));
    act(() => latestWs().simulateOpen());
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("connected");
      expect(result.current.isConnected).toBe(true);
    });
  });

  it("updates status on progress message", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket(defaultOptions));
    act(() => latestWs().simulateOpen());
    act(() =>
      latestWs().simulateMessage({
        status: "processing",
        progress: 50,
        current_step: "Parsing resume",
        error_message: null,
      })
    );
    await waitFor(() => {
      expect(result.current.status).toMatchObject({
        job_id: "analysis-123",
        status: "processing",
        progress: 50,
        current_step: "Parsing resume",
        error_message: null,
      });
    });
  });

  it("calls onProgress callback with status update", async () => {
    const onProgress = jest.fn();
    renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onProgress }));
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateMessage({ status: "processing", progress: 30 }));
    await waitFor(() => {
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({ status: "processing", progress: 30 })
      );
    });
  });

  it("ignores ping messages", async () => {
    const onProgress = jest.fn();
    const { result } = renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onProgress }));
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateMessage({ type: "ping" }));
    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  it("handles completed terminal state", async () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onComplete }));
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateMessage({ status: "completed", progress: 100 }));
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
      expect(result.current.connectionStatus).toBe("disconnected");
    });
  });

  it("handles failed terminal state", async () => {
    const onComplete = jest.fn();
    const { result } = renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onComplete }));
    act(() => latestWs().simulateOpen());
    act(() =>
      latestWs().simulateMessage({
        status: "failed",
        error_message: "Worker crashed",
      })
    );
    await waitFor(() => {
      expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ status: "failed" }));
      expect(result.current.connectionStatus).toBe("disconnected");
    });
  });

  it("handles error status in message (Redis unavailable)", async () => {
    const onFallbackToPolling = jest.fn();
    const { result } = renderHook(() =>
      useAnalysisWebSocket({ ...defaultOptions, onFallbackToPolling })
    );
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateMessage({ status: "error" }));
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("error");
      expect(onFallbackToPolling).toHaveBeenCalled();
    });
  });

  it("sets connectionStatus to error on ws.onerror", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket(defaultOptions));
    act(() => latestWs().simulateError());
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("error");
    });
  });

  it("sets disconnected on normal close (code 1000)", async () => {
    const { result } = renderHook(() => useAnalysisWebSocket(defaultOptions));
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateClose(1000));
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("disconnected");
    });
  });

  it("calls onFallback and sets error on auth failure (code 4001)", async () => {
    const onFallbackToPolling = jest.fn();
    const { result } = renderHook(() =>
      useAnalysisWebSocket({ ...defaultOptions, onFallbackToPolling })
    );
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateClose(4001));
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("error");
      expect(onFallbackToPolling).toHaveBeenCalled();
    });
  });

  it("calls onFallback on code 4003 (auth boundary)", async () => {
    const onFallbackToPolling = jest.fn();
    renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onFallbackToPolling }));
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateClose(4003));
    await waitFor(() => {
      expect(onFallbackToPolling).toHaveBeenCalled();
    });
  });

  it("attempts reconnect on abnormal close (code 1006)", async () => {
    renderHook(() => useAnalysisWebSocket(defaultOptions));
    const firstWs = latestWs();
    act(() => firstWs.simulateOpen());
    act(() => firstWs.simulateClose(1006));

    // Advance past the first reconnect delay (1000ms)
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it("uses exponential backoff for reconnects", async () => {
    renderHook(() => useAnalysisWebSocket(defaultOptions));

    // First disconnect
    act(() => latestWs().simulateClose(1006));
    await act(async () => jest.advanceTimersByTime(1100));
    expect(MockWebSocket.instances).toHaveLength(2);

    // Second disconnect
    act(() => latestWs().simulateClose(1006));
    // Second delay is 2000ms
    await act(async () => jest.advanceTimersByTime(2100));
    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it("calls onFallback after max reconnect attempts", async () => {
    const onFallbackToPolling = jest.fn();
    const { result } = renderHook(() =>
      useAnalysisWebSocket({ ...defaultOptions, onFallbackToPolling })
    );

    // Exhaust 3 reconnect attempts
    for (let i = 0; i < 3; i++) {
      act(() => latestWs().simulateClose(1006));
      await act(async () => jest.advanceTimersByTime(10000));
    }

    // On 4th close (no more reconnects allowed)
    act(() => latestWs().simulateClose(1006));
    await waitFor(() => {
      expect(onFallbackToPolling).toHaveBeenCalled();
      expect(result.current.connectionStatus).toBe("error");
    });
  });

  it("ignores malformed JSON messages", async () => {
    const onProgress = jest.fn();
    const { result } = renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onProgress }));
    act(() => latestWs().simulateOpen());
    act(() => latestWs().simulateRawMessage("not-valid-json{{{"));
    await waitFor(() => {
      expect(result.current.status).toBeNull();
      expect(onProgress).not.toHaveBeenCalled();
    });
  });

  it("cleans up WebSocket on unmount", () => {
    const { unmount } = renderHook(() => useAnalysisWebSocket(defaultOptions));
    const ws = latestWs();
    act(() => ws.simulateOpen());
    unmount();
    expect(ws.close).toHaveBeenCalled();
  });

  it("handles WebSocket constructor throwing (invalid URL)", async () => {
    const onFallbackToPolling = jest.fn();
    // Make the constructor throw once
    const OriginalWS = (global as any).WebSocket;
    (global as any).WebSocket = jest.fn(() => {
      throw new Error("Invalid URL");
    });

    const { result } = renderHook(() =>
      useAnalysisWebSocket({ ...defaultOptions, onFallbackToPolling })
    );
    await waitFor(() => {
      expect(result.current.connectionStatus).toBe("error");
      expect(onFallbackToPolling).toHaveBeenCalled();
    });

    (global as any).WebSocket = OriginalWS;
  });

  it("does not update state after unmount", async () => {
    const onProgress = jest.fn();
    const { unmount } = renderHook(() => useAnalysisWebSocket({ ...defaultOptions, onProgress }));
    const ws = latestWs();
    act(() => ws.simulateOpen());
    unmount();
    // Fire message after unmount — should not throw or update
    act(() => ws.simulateMessage({ status: "processing", progress: 50 }));
    expect(onProgress).not.toHaveBeenCalled();
  });
});
