import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { importRows, importWorkbook } from "../__fixtures__/import-pipeline";
import { RS_CONTACT_ROWS, RS_SAMPLE_PATH, rsSheet, SAMPLE_PATH } from "../__fixtures__/records";
import type { TranslatorRecord } from "../import/fields";
import { fieldOptions } from "../normalize/field-options";
import { normalizeRecord } from "../normalize/normalize";
import { buildFileSummary, fileSummarySchema, MAX_SUMMARY_VALUES, type FileSummary } from "./summary";

const toArrayBuffer = (bytes: Uint8Array) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

/** Imports a workbook on disk the way the wizard does and returns its grouped records and layout id. */
async function importFile(path: string) {
  const { workbook, grouping } = await importWorkbook(toArrayBuffer(readFileSync(path)));
  return { records: grouping.records, layout: workbook.layout.id };
}

/** An invented record in memory: blank fields except these. `n` sets the row number and ID. */
function record(n: number, changes: Partial<TranslatorRecord> = {}) {
  const base: TranslatorRecord = {
    recordId: `TST-${String(n).padStart(5, "0")}`,
    idGenerated: false,
    otherExecutives: [],
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
  };
  return { sourceRow: n + 1, normalized: normalizeRecord({ ...base, ...changes }) };
}

/** `count` invented records with this title, numbered from `from`. */
const withTitle = (title: string, count: number, from: number) =>
  Array.from({ length: count }, (_, i) => record(from + i, { title }));

describe("buildFileSummary: the synthetic sample", () => {
  let records: Awaited<ReturnType<typeof importFile>>["records"];
  let summary: FileSummary;

  beforeAll(async () => {
    const file = await importFile(SAMPLE_PATH);
    records = file.records;
    summary = buildFileSummary(records, file.layout);
  });

  it("names the layout and counts the unique records", () => {
    expect(summary.layout).toBe("synthetic");
    expect(summary.uniqueRecords).toBe(499);
  });

  it("lists cities, states, industries and titles by count, then A to Z", () => {
    expect(summary.cities).toEqual([
      { value: "Glendale", count: 100 },
      { value: "Mesa", count: 100 },
      { value: "Phoenix", count: 100 },
      { value: "Tempe", count: 100 },
      { value: "Scottsdale", count: 99 },
    ]);
    expect(summary.states).toEqual([{ value: "AZ", count: 499 }]);
    expect(summary.industries).toEqual([
      { value: "Business Services", count: 100 },
      { value: "Fabrication", count: 100 },
      { value: "Logistics", count: 100 },
      { value: "Technology", count: 100 },
      { value: "Retail", count: 99 },
    ]);
    expect(summary.titles).toEqual([
      { value: "Operations Manager", count: 126 },
      { value: "General Manager", count: 124 },
      { value: "Owner", count: 124 },
    ]);
  });

  it("matches the Phase 1 city picker for Phoenix and Tempe", () => {
    const picker = fieldOptions(records, "city");
    for (const city of ["Phoenix", "Tempe"]) {
      const fromPicker = picker.find((option) => option.label === city)?.count;
      expect(fromPicker).toBe(100);
      expect(summary.cities.find((entry) => entry.value === city)?.count).toBe(fromPicker);
    }
  });

  it("summarizes employee sizes", () => {
    expect(summary.employees).toEqual({ min: 8, max: 120, withValue: 375, blank: 124 });
  });

  it("cuts no list", () => {
    expect(summary.truncated).toEqual({ cities: false, states: false, industries: false, titles: false });
  });

  it("passes the strict schema", () => {
    expect(fileSummarySchema.parse(summary)).toEqual(summary);
  });
});

describe("buildFileSummary: Reference Solutions records", () => {
  // Invented rows in the full 396-column layout (`RS_CONTACT_ROWS`). Business 3 fills every contact column.
  const rows = RS_CONTACT_ROWS;
  let summary: FileSummary;

  beforeAll(async () => {
    const { workbook, grouping } = await importRows(rsSheet(rows));
    summary = buildFileSummary(grouping.records, workbook.layout.id);
  });

  it("names the layout and lists the values", () => {
    expect(summary.layout).toBe("reference-solutions");
    expect(summary.uniqueRecords).toBe(4);
    expect(summary.cities).toEqual([
      { value: "Tempe", count: 3 },
      { value: "Mesa", count: 1 },
    ]);
    expect(summary.titles).toEqual([{ value: "Operations Manager", count: 4 }]);
  });

  it("counts an open range and a range-only row, with a finite max", () => {
    // Actual 40 (business 3), 20 to 49 (business 2), 10,000+ (business 1, its lower bound only).
    expect(summary.employees).toEqual({ min: 20, max: 10_000, withValue: 3, blank: 1 });
    expect(Number.isFinite(summary.employees.max)).toBe(true);
  });

  it("round-trips through JSON with no null where a number is expected", () => {
    const roundTripped = JSON.parse(JSON.stringify(summary));
    expect(roundTripped).toEqual(summary);
    expect(roundTripped.employees.min).toBe(20);
    expect(roundTripped.employees.max).toBe(10_000);
    expect(fileSummarySchema.parse(roundTripped)).toEqual(summary);
  });

  it("passes the strict schema for the Reference Solutions sample too", async () => {
    const file = await importFile(RS_SAMPLE_PATH);
    const rsSummary = buildFileSummary(file.records, file.layout);
    expect(rsSummary.layout).toBe("reference-solutions");
    expect(fileSummarySchema.parse(rsSummary)).toEqual(rsSummary);
    expect(Number.isFinite(rsSummary.employees.max ?? 0)).toBe(true);
  });
});

describe("buildFileSummary: caps, order and dropped values", () => {
  it("keeps the 100 most common of 150 titles and flags the cut", () => {
    // Title 001 appears 150 times, Title 002 149 times, down to Title 150 once.
    const records = Array.from({ length: 150 }, (_, i) => i).flatMap((i) =>
      withTitle(`Title ${String(i + 1).padStart(3, "0")}`, 150 - i, i * 1000),
    );
    const summary = buildFileSummary(records, "synthetic");

    expect(summary.titles).toHaveLength(MAX_SUMMARY_VALUES);
    expect(summary.titles[0]).toEqual({ value: "Title 001", count: 150 });
    expect(summary.titles[99]).toEqual({ value: "Title 100", count: 51 });
    expect(summary.truncated).toEqual({ cities: false, states: false, industries: false, titles: true });
    expect(() => fileSummarySchema.parse(summary)).not.toThrow();
  });

  it("drops contact-looking values and leaves out a value it would have to cut or change", () => {
    const long = `Senior\nOperations Lead ${"A".repeat(200)}`;
    const records = [
      record(1, { title: "jane@example.invalid" }),
      record(2, { title: "602 555 0100" }),
      record(3, { title: "www.example.invalid" }),
      record(4, { title: long }),
      record(5, { title: "Owner" }),
    ];
    const summary = buildFileSummary(records, "synthetic");

    // The long title would have to be cut to 80 characters, which is a value no record has, so
    // it is left out like the contact-looking ones (fix B): the AI can't propose it.
    expect(summary.titles).toEqual([{ value: "Owner", count: 1 }]);
    // Values left out are not a cut.
    expect(summary.truncated.titles).toBe(false);
    const json = JSON.stringify(summary);
    for (const text of ["@", "555", "www.", "example.invalid", "\\n"]) expect(json).not.toContain(text);
  });

  it("gives null min and max when no record has a size", () => {
    const summary = buildFileSummary([record(1), record(2, { employees: "about 20" })], "synthetic");
    expect(summary.employees).toEqual({ min: null, max: null, withValue: 0, blank: 2 });
    expect(summary.cities).toEqual([]);
    expect(() => fileSummarySchema.parse(summary)).not.toThrow();
  });
});

describe("fileSummarySchema", () => {
  const valid = (): FileSummary => ({
    layout: "synthetic",
    uniqueRecords: 1,
    cities: [{ value: "Phoenix", count: 1 }],
    states: [{ value: "AZ", count: 1 }],
    industries: [{ value: "Fabrication", count: 1 }],
    titles: [{ value: "Owner", count: 1 }],
    employees: { min: 25, max: 25, withValue: 1, blank: 0 },
    truncated: { cities: false, states: false, industries: false, titles: false },
  });

  it("accepts a valid summary", () => {
    expect(fileSummarySchema.safeParse(valid()).success).toBe(true);
  });

  it("accepts a value with 6 digits", () => {
    const summary = { ...valid(), titles: [{ value: "Route 66 Team 2024", count: 1 }] };
    expect(fileSummarySchema.safeParse(summary).success).toBe(true);
  });

  it.each([
    ["an extra rows key", { ...valid(), rows: [] }],
    ["an extra key in a list item", { ...valid(), titles: [{ value: "Owner", count: 1, company: "X" }] }],
    ["an extra key in employees", { ...valid(), employees: { ...valid().employees, names: [] } }],
    ["a missing list", Object.fromEntries(Object.entries(valid()).filter(([key]) => key !== "titles"))],
    ["a missing states flag", { ...valid(), truncated: { cities: false, industries: false, titles: false } }],
    ["101 values", { ...valid(), cities: Array.from({ length: 101 }, (_, i) => ({ value: `City ${i}`, count: 1 })) }],
    ["an 81-character value", { ...valid(), titles: [{ value: "a".repeat(81), count: 1 }] }],
    ["an empty value", { ...valid(), titles: [{ value: "", count: 1 }] }],
    ["an email value", { ...valid(), titles: [{ value: "jane@example.invalid", count: 1 }] }],
    ["a phone value", { ...valid(), cities: [{ value: "602 555 0100", count: 1 }] }],
    ["a website value", { ...valid(), industries: [{ value: "WWW.example.invalid", count: 1 }] }],
    ["a URL value", { ...valid(), states: [{ value: "https://example.invalid", count: 1 }] }],
    ["a value with 7 digits", { ...valid(), titles: [{ value: "Unit 12 Suite 34 Box 567", count: 1 }] }],
    ["a count of 0", { ...valid(), titles: [{ value: "Owner", count: 0 }] }],
    ["a fractional count", { ...valid(), titles: [{ value: "Owner", count: 1.5 }] }],
    ["an unknown layout", { ...valid(), layout: "other" }],
    ["a negative uniqueRecords", { ...valid(), uniqueRecords: -1 }],
    ["an infinite max", { ...valid(), employees: { ...valid().employees, max: Infinity } }],
  ])("refuses %s", (_, summary) => {
    expect(fileSummarySchema.safeParse(summary).success).toBe(false);
  });
});
