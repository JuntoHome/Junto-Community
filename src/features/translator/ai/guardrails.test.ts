import { afterEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./guardrails";

afterEach(() => {
  vi.useRealTimers();
});

describe("withTimeout", () => {
  it("returns the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1000, () => "late")).resolves.toBe("done");
  });

  it("returns the fallback once the time is up, not before", async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise<string>(() => {}), 20_000, () => "late");
    let value: string | undefined;
    void result.then((v) => (value = v));

    await vi.advanceTimersByTimeAsync(19_999);
    expect(value).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(value).toBe("late");
  });

  it("passes a rejection on and clears its timer", async () => {
    vi.useFakeTimers();
    await expect(withTimeout(Promise.reject(new Error("no")), 20_000, () => "late")).rejects.toThrow("no");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears its timer when the promise wins", async () => {
    vi.useFakeTimers();
    await withTimeout(Promise.resolve(1), 20_000, () => 0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
