import { describe, expect, it } from "vitest";
import { AI_SESSION_LIMIT, canUseAi, limitNotice, remaining, SESSION_LIMIT_TEXT, SHOW_REMAINING_FROM } from "./session-limit";

describe("session limit (TR-51)", () => {
  it("allows 40 requests per session", () => {
    expect(AI_SESSION_LIMIT).toBe(40);
    expect(canUseAi(0)).toBe(true);
    expect(canUseAi(39)).toBe(true);
    expect(canUseAi(40)).toBe(false);
    expect(canUseAi(41)).toBe(false);
  });

  it("counts what is left, never below 0", () => {
    expect(remaining(0)).toBe(40);
    expect(remaining(35)).toBe(5);
    expect(remaining(40)).toBe(0);
    expect(remaining(45)).toBe(0);
  });

  it("says nothing until 5 or fewer are left, then the count, then the limit message", () => {
    expect(SHOW_REMAINING_FROM).toBe(5);
    expect(limitNotice(0)).toBeNull();
    expect(limitNotice(34)).toBeNull();
    expect(limitNotice(35)).toBe("5 AI requests left in this session.");
    expect(limitNotice(39)).toBe("1 AI request left in this session.");
    expect(limitNotice(40)).toBe("You've reached the AI limit for this session. Use the form, or start over to reset.");
    expect(limitNotice(41)).toBe(SESSION_LIMIT_TEXT.reached);
  });

  it("has no em-dashes", () => {
    for (const text of [SESSION_LIMIT_TEXT.left(3), SESSION_LIMIT_TEXT.reached]) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
