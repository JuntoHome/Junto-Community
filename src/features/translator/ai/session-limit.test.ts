import { describe, expect, it } from "vitest";
import { remaining, SESSION_LIMIT_TEXT } from "./session-limit";

describe("session limit (TR-51)", () => {
  it("counts what is left, never below 0", () => {
    expect(remaining(0)).toBe(40);
    expect(remaining(35)).toBe(5);
    expect(remaining(40)).toBe(0);
    expect(remaining(45)).toBe(0);
  });

  it("has no em-dashes", () => {
    for (const text of [SESSION_LIMIT_TEXT.left(3), SESSION_LIMIT_TEXT.reached]) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
