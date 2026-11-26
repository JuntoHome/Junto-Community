import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanAiText,
  CONTACT_PLACEHOLDER,
  cutText,
  MAX_SUMMARY_VALUE_CHARS,
  sanitizeSummaryValue,
  stripInventedContacts,
  withTimeout,
} from "./guardrails";

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

describe("sanitizeSummaryValue", () => {
  it("keeps a plain value as it is", () => {
    expect(sanitizeSummaryValue("Operations Manager")).toBe("Operations Manager");
  });

  it("cuts to 80 characters by default, or to the cap given (120 for the intro fields, TR-48)", () => {
    const long = "x".repeat(200);
    expect(sanitizeSummaryValue(long)).toHaveLength(MAX_SUMMARY_VALUE_CHARS);
    expect(sanitizeSummaryValue(long, 120)).toHaveLength(120);
    expect(sanitizeSummaryValue("jane@example.invalid", 120)).toBeNull();
  });

  it("turns control characters and line breaks into single spaces and trims", () => {
    expect(sanitizeSummaryValue("  Head\nof\r\n\tSales\u0000Team Lead\u0085  ")).toBe("Head of Sales Team Lead");
  });

  it.each([
    ["an email", "jane@example.invalid"],
    ["a bare @", "Sales @ HQ"],
    ["a website", "www.example.invalid"],
    ["a website in capitals", "WWW.EXAMPLE.INVALID"],
    ["a URL", "HTTPS://example.invalid/page"],
    ["a phone with spaces", "602 555 0100"],
    ["a phone with punctuation", "(602) 555-0100"],
    ["7 digits in all", "Unit 12 Suite 34 Box 567"],
  ])("drops %s", (_, text) => {
    expect(sanitizeSummaryValue(text)).toBeNull();
  });

  it("keeps a value with 6 digits", () => {
    expect(sanitizeSummaryValue("Route 66 Team 2024")).toBe("Route 66 Team 2024");
  });

  it("drops a value with nothing left", () => {
    expect(sanitizeSummaryValue(" \n\t\u0001 ")).toBeNull();
  });

  it("checks the whole value before cutting it", () => {
    expect(sanitizeSummaryValue(`${"a".repeat(100)} jane@example.invalid`)).toBeNull();
  });

  it("cuts to 80 characters and trims what is left", () => {
    expect(sanitizeSummaryValue("b".repeat(200))).toBe("b".repeat(MAX_SUMMARY_VALUE_CHARS));
    expect(sanitizeSummaryValue(`${"c".repeat(79)} more`)).toBe("c".repeat(79));
  });

  it("never splits a two-unit character at the cut", () => {
    const value = sanitizeSummaryValue(`${"d".repeat(79)}\u{1F600}tail`);
    expect(value).toBe("d".repeat(79));
  });
});

describe("cutText", () => {
  it("keeps short text and cuts long text to the limit, trimmed", () => {
    expect(cutText("short", 10)).toBe("short");
    expect(cutText(`${"e".repeat(9)} tail`, 10)).toBe("e".repeat(9));
  });

  it("never splits a two-unit character at the cut", () => {
    expect(cutText(`${"f".repeat(9)}\u{1F600}`, 10)).toBe("f".repeat(9));
  });
});

// Dashes are written as escapes (\u2014 em-dash, \u2013 en-dash) so the source has none.
describe("cleanAiText", () => {
  it("replaces an em-dash or en-dash, and the spaces around it, with a comma and a space", () => {
    expect(cleanAiText("Phoenix \u2014 owners only")).toBe("Phoenix, owners only");
    expect(cleanAiText("Phoenix\u2014owners")).toBe("Phoenix, owners");
    expect(cleanAiText("10\u201399 people")).toBe("10, 99 people");
  });

  it("collapses runs of spaces, keeps line breaks and trims the ends", () => {
    expect(cleanAiText("  Two   spaces\tand a tab.\nNext line.  ")).toBe("Two spaces and a tab.\nNext line.");
  });

  it("leaves clean text as it is", () => {
    expect(cleanAiText("Phoenix only, or also Tempe?")).toBe("Phoenix only, or also Tempe?");
  });
});

describe("stripInventedContacts", () => {
  const P = CONTACT_PLACEHOLDER;

  it.each([
    ["an email", "Write to jane@example.invalid today.", `Write to ${P} today.`],
    ["an email in capitals", "Write to JANE.DOE@Example.COM.", `Write to ${P}.`],
    ["a phone with brackets", "Call (602) 555-0100.", `Call ${P}.`],
    ["a phone with dots", "Call 602.555.0100 now.", `Call ${P} now.`],
    ["an international phone", "Call +1 602 555 0100.", `Call ${P}.`],
    ["a 7-digit phone", "Call 555-0100 now.", `Call ${P} now.`],
    ["a www address", "See www.example.invalid.", `See ${P}.`],
    ["an https URL with a path", "See https://x.invalid/a today.", `See ${P} today.`],
    ["an http URL in capitals", "See HTTP://Example.org/page?x=1, then call.", `See ${P}, then call.`],
    ["a bare domain", "Visit example.com or shop.example.co.", `Visit ${P} or ${P}.`],
  ])("replaces %s", (_, text, expected) => {
    expect(stripInventedContacts(text)).toBe(expected);
  });

  it.each([
    ["the placeholders", "Hi [Contact name], I'm [Your name] from [Your business]."],
    ["a count range", "Firms of 10 to 99 employees."],
    ["a year", "Since 2026."],
    ["a decimal", "Rated 3.5 out of 5."],
    ["a short number list", "Sizes 10, 20 and 50."],
    ["an ordinary full stop between words", "We weld. Co-owners welcome."],
  ])("leaves %s alone", (_, text) => {
    expect(stripInventedContacts(text)).toBe(text);
  });

  it("keeps line breaks and the subject line", () => {
    expect(stripInventedContacts("Subject: Hello\n\nCall 602-555-0100.")).toBe(`Subject: Hello\n\nCall ${P}.`);
  });
});
