import { describe, expect, it } from "vitest";
import type { TranslatorRecord } from "../import/fields";
import { matchKey } from "./match-key";
import { normalizeCategory, normalizeEmployees, normalizeRecord, normalizeText } from "./normalize";

/** A mapped record with every value empty except the ones given. */
function record(values: Partial<TranslatorRecord> = {}): TranslatorRecord {
  return {
    recordId: "TST-0001",
    idGenerated: false,
    company: null,
    city: null,
    state: null,
    industry: null,
    employees: null,
    title: null,
    name: null,
    email: null,
    phone: null,
    website: null,
    address: null,
    zip: null,
    naicsDescription: null,
    employeeRange: null,
    otherExecutives: [],
    ...values,
  };
}

describe("matching keys", () => {
  it('" phoenix " and "Phoenix" share a key', () => {
    const padded = normalizeCategory(" phoenix ");
    const plain = normalizeCategory("Phoenix");
    expect(padded).toEqual({ known: true, original: " phoenix ", value: "phoenix", key: "phoenix" });
    expect(plain).toEqual({ known: true, original: "Phoenix", value: "Phoenix", key: "phoenix" });
  });

  it("collapses inner spaces, including non-breaking ones, but keeps punctuation", () => {
    expect(matchKey("Salt  Lake   City")).toBe("salt lake city");
    expect(matchKey("St. Louis")).not.toBe(matchKey("St Louis"));
  });

  it("gives city, state, industry and title a key, and other text none", () => {
    const normalized = normalizeRecord(
      record({ city: " phoenix ", state: "az", industry: "Fabrication", title: "Owner", company: "Test Company 01" }),
    );
    expect(normalized.city).toMatchObject({ key: "phoenix" });
    expect(normalized.state).toMatchObject({ key: "az" });
    expect(normalized.company).toEqual({ known: true, original: "Test Company 01", value: "Test Company 01" });
  });
});

describe("unknown values", () => {
  it("a blank title is unknown, with the original blank kept", () => {
    expect(normalizeRecord(record({ title: null })).title).toEqual({ known: false, reason: "blank", original: null });
    expect(normalizeCategory("   ")).toEqual({ known: false, reason: "blank", original: "   " });
    expect(normalizeText("")).toEqual({ known: false, reason: "blank", original: "" });
  });

  it("leaves the mapped record untouched, so the original stays available for export", () => {
    const mapped = record({ city: " phoenix ", title: "   " });
    const copy = structuredClone(mapped);
    normalizeRecord(mapped);
    expect(mapped).toEqual(copy);
  });

  it("trims the Record ID and the other executives, dropping empty ones", () => {
    const normalized = normalizeRecord(
      record({
        recordId: "  TST-0001 ",
        otherExecutives: [
          { name: "  Test Person 01 ", title: null },
          { name: "  ", title: " " },
          { name: null, title: " Owner " },
        ],
      }),
    );
    expect(normalized.recordId).toBe("TST-0001");
    expect(normalized.otherExecutives).toEqual([
      { name: "Test Person 01", title: null },
      { name: null, title: "Owner" },
    ]);
  });
});

describe("employee counts", () => {
  it.each([
    ["25", 25],
    ["1,200", 1200],
    [" 40 ", 40],
    ["0", 0],
  ])("reads %j as %i", (text, count) => {
    expect(normalizeEmployees(text, null)).toEqual({ known: true, original: text, count, source: "actual" });
  });

  it.each(["25.5", "-3", "about 20", "N/A", "10 to 19"])("treats %j as invalid", (text) => {
    expect(normalizeEmployees(text, null)).toEqual({ known: false, reason: "invalid", original: text });
  });

  it("treats blank and spaces as blank, not invalid", () => {
    expect(normalizeEmployees(null, null)).toEqual({ known: false, reason: "blank", original: null });
    expect(normalizeEmployees("  ", null)).toEqual({ known: false, reason: "blank", original: "  " });
  });

  it("a number too big to hold exactly is invalid", () => {
    expect(normalizeEmployees("99999999999999999999", null)).toMatchObject({ known: false, reason: "invalid" });
  });
});

describe("employee size range fallback", () => {
  it.each([
    ["10 to 19", 10, 19],
    ["10-19", 10, 19],
    ["10 - 19", 10, 19],
    ["1,000 to 4,999", 1000, 4999],
    ["  20   TO 49 ", 20, 49],
  ])("reads the range %j as %i to %i when the count is blank", (range, min, max) => {
    expect(normalizeEmployees(null, range)).toEqual({ known: true, original: range, min, max, source: "range" });
  });

  it.each(["10,000+", "10,000 or more"])("reads the open range %j with no upper limit", (range) => {
    expect(normalizeEmployees(null, range)).toEqual({
      known: true,
      original: range,
      min: 10000,
      max: Number.POSITIVE_INFINITY,
      source: "range",
    });
  });

  it("uses the actual count when it is a whole number, even with a range", () => {
    expect(normalizeEmployees("25", "20 to 49")).toMatchObject({ count: 25, source: "actual" });
  });

  it("uses the range when the count is invalid, and drops the invalid reason", () => {
    expect(normalizeEmployees("N/A", "20 to 49")).toEqual({
      known: true,
      original: "20 to 49",
      min: 20,
      max: 49,
      source: "range",
    });
  });

  it("keeps the count's own reason when the range can't be read", () => {
    expect(normalizeEmployees("N/A", "Unknown")).toEqual({ known: false, reason: "invalid", original: "N/A" });
    expect(normalizeEmployees(null, "Unknown")).toEqual({ known: false, reason: "blank", original: null });
    expect(normalizeEmployees(null, "50 to 10")).toMatchObject({ known: false, reason: "blank" });
  });

  it("normalizeRecord takes the range from employeeRange", () => {
    expect(normalizeRecord(record({ employees: null, employeeRange: "10 to 19" })).employees).toMatchObject({
      min: 10,
      max: 19,
      source: "range",
    });
  });
});
