import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findByProperty, generateId, formatDate, truncate, escapeHtml, debounce } from "../src/utils";

describe("findByProperty", () => {
  const items = [
    { id: "a", name: "Alice" },
    { id: "b", name: "Bob" },
  ];

  it("returns the first item whose key matches value", () => {
    expect(findByProperty(items, "id", "b")).toEqual({ id: "b", name: "Bob" });
  });

  it("returns undefined when no item matches", () => {
    expect(findByProperty(items, "id", "z")).toBeUndefined();
  });

  it("returns undefined for an empty list", () => {
    expect(findByProperty([], "id", "a")).toBeUndefined();
  });
});

describe("generateId", () => {
  it("returns a non-empty string", () => {
    expect(typeof generateId()).toBe("string");
    expect(generateId().length).toBeGreaterThan(0);
  });

  it("generates different ids on successive calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateId()));
    expect(ids.size).toBe(20);
  });
});

describe("formatDate", () => {
  it("formats a timestamp into a non-empty human-readable string", () => {
    const result = formatDate(Date.UTC(2024, 0, 15, 10, 30));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces different output for different timestamps", () => {
    const a = formatDate(Date.UTC(2024, 0, 1));
    const b = formatDate(Date.UTC(2025, 5, 20));
    expect(a).not.toBe(b);
  });
});

describe("truncate", () => {
  it("returns the original text when shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns the original text when exactly maxLength", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates and appends an ellipsis when longer than maxLength", () => {
    expect(truncate("hello world", 5)).toBe("hello…");
  });

  it("trims trailing whitespace before adding the ellipsis", () => {
    expect(truncate("hello   world", 8)).toBe("hello…");
  });
});

describe("escapeHtml", () => {
  it("escapes HTML-significant characters", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert('x')&lt;/script&gt;"
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("leaves plain text unchanged", () => {
    expect(escapeHtml("just plain text")).toBe("just plain text");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not call the function before the delay elapses", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    vi.advanceTimersByTime(150);
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls the function once the delay elapses", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("collapses rapid successive calls into a single invocation", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("forwards the latest arguments to the underlying function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 200);
    debounced("first");
    debounced("second");
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledWith("second");
  });
});
