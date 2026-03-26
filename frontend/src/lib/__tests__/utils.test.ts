import { cn, formatPercent, formatDate } from "@/lib/utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("handles undefined and null", () => {
    expect(cn("base", undefined, null)).toBe("base");
  });

  it("deduplicates Tailwind classes", () => {
    const result = cn("px-4", "px-6");
    expect(result).toBe("px-6");
  });
});

describe("formatPercent", () => {
  it("formats a number as percentage", () => {
    expect(formatPercent(75)).toBe("75%");
  });

  it("rounds to nearest integer", () => {
    expect(formatPercent(75.6)).toBe("76%");
  });

  it("handles null", () => {
    expect(formatPercent(null)).toBe("--");
  });

  it("handles undefined", () => {
    expect(formatPercent(undefined)).toBe("--");
  });

  it("handles zero", () => {
    expect(formatPercent(0)).toBe("0%");
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2024-03-15T10:30:00Z");
    expect(result).toMatch(/Mar 15, 2024/);
  });

  it("handles different date formats", () => {
    const result = formatDate("2024-01-01");
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/2024/);
  });
});
