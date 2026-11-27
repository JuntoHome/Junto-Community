import { describe, expect, it } from "vitest";
import { isRateLimited } from "./rate-limit";

const MINUTE = 60 * 1000;
const WINDOW = 10 * MINUTE;

describe("isRateLimited", () => {
  it("allows maxAttempts per 10 minutes, then refuses", () => {
    const key = "test:allows";
    expect(isRateLimited(key, 2, 0)).toBe(false);
    expect(isRateLimited(key, 2, 1)).toBe(false);
    expect(isRateLimited(key, 2, 2)).toBe(true);
  });

  it("counts a refused attempt by default, so someone who keeps trying stays locked out", () => {
    const key = "test:default";
    isRateLimited(key, 2, 0);
    isRateLimited(key, 2, 1);
    expect(isRateLimited(key, 2, 5 * MINUTE)).toBe(true);
    expect(isRateLimited(key, 2, 6 * MINUTE)).toBe(true);
    // The first two have left the window, but the refused ones at 5 and 6 minutes still count.
    expect(isRateLimited(key, 2, WINDOW + 1)).toBe(true);
  });

  it("with countRefused false, counts only attempts that went through, so the limit lifts as the window moves", () => {
    const key = "test:not-refused";
    const opts = { countRefused: false };
    isRateLimited(key, 2, 0, opts);
    isRateLimited(key, 2, 1, opts);
    expect(isRateLimited(key, 2, 5 * MINUTE, opts)).toBe(true);
    expect(isRateLimited(key, 2, 6 * MINUTE, opts)).toBe(true);
    // The two that went through have left the window; the refused ones never counted.
    expect(isRateLimited(key, 2, WINDOW + 1, opts)).toBe(false);
  });
});
