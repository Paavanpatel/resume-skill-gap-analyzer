import { renderHook } from "@testing-library/react";
import usePageTitle from "@/hooks/usePageTitle";

describe("usePageTitle", () => {
  const originalTitle = document.title;

  afterEach(() => {
    document.title = originalTitle;
  });

  it("sets the document title with RSGA suffix", () => {
    renderHook(() => usePageTitle("Dashboard"));
    expect(document.title).toBe("Dashboard | RSGA");
  });

  it("updates title when value changes", () => {
    const { rerender } = renderHook(({ title }) => usePageTitle(title), {
      initialProps: { title: "Page A" },
    });
    expect(document.title).toBe("Page A | RSGA");

    rerender({ title: "Page B" });
    expect(document.title).toBe("Page B | RSGA");
  });

  it("restores previous title on unmount", () => {
    document.title = "Original Title";
    const { unmount } = renderHook(() => usePageTitle("Temporary"));
    expect(document.title).toBe("Temporary | RSGA");

    unmount();
    expect(document.title).toBe("Original Title");
  });
});
