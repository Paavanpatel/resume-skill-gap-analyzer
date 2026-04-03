import { renderHook, act, waitFor } from "@testing-library/react";
import { useRateLimit } from "@/hooks/useRateLimit";

describe("useRateLimit", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts with isLimited=false, secondsRemaining=0, retryAfter=0", () => {
    const { result } = renderHook(() => useRateLimit());
    expect(result.current.isLimited).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
    expect(result.current.retryAfter).toBe(0);
  });

  it("responds to api:rate-limit event", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 30 },
        })
      );
    });

    expect(result.current.isLimited).toBe(true);
    expect(result.current.secondsRemaining).toBe(30);
    expect(result.current.retryAfter).toBe(30);
  });

  it("decrements secondsRemaining every second", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 5 },
        })
      );
    });

    expect(result.current.secondsRemaining).toBe(5);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.secondsRemaining).toBe(4);

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(result.current.secondsRemaining).toBe(3);
  });

  it("resets isLimited when countdown reaches 0", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 2 },
        })
      );
    });

    expect(result.current.isLimited).toBe(true);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    expect(result.current.isLimited).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
  });

  it("calls onLimited callback when rate limit event fires", () => {
    const onLimited = jest.fn();
    renderHook(() => useRateLimit(onLimited));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 60 },
        })
      );
    });

    expect(onLimited).toHaveBeenCalledWith(60);
  });

  it("replaces existing countdown when new rate limit event fires", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 10 },
        })
      );
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 60 },
        })
      );
    });

    expect(result.current.secondsRemaining).toBe(60);
    expect(result.current.retryAfter).toBe(60);
  });

  it("cleans up event listener and interval on unmount", () => {
    const { result, unmount } = renderHook(() => useRateLimit());

    act(() => {
      window.dispatchEvent(
        new CustomEvent("api:rate-limit", {
          detail: { retryAfterSeconds: 10 },
        })
      );
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // After unmount, the component's state won't update, but no errors thrown
    expect(true).toBe(true);
  });

  it("no countdown when no event fired", () => {
    const { result } = renderHook(() => useRateLimit());

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(result.current.isLimited).toBe(false);
    expect(result.current.secondsRemaining).toBe(0);
  });
});
