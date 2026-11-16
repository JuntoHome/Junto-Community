import { describe, expect, it } from "vitest";
import { RS_HEADERS } from "../__fixtures__/rs-headers";
import { RS_FIXTURE_EXPECTED, RS_FIXTURE_HEADERS, RS_FIXTURE_POSITION, RS_FIXTURE_ROW } from "../__fixtures__/rs-row";
import { SYNTHETIC_HEADERS, syntheticRow as fixtureRow } from "../__fixtures__/records";
import { RECORD_FIELDS, TEXT_FIELDS } from "./fields";
import { generatedRecordId, mapRow, normalizeHeader, type SourceCell } from "./map-row";
import { REFERENCE_SOLUTIONS_MAPPING } from "./mappings/reference-solutions";
import { SYNTHETIC_MAPPING } from "./mappings/synthetic";

/** A synthetic fixture row as plain cells. Its default values are all text or numbers. */
const syntheticRow = (n: number) => fixtureRow(n) as SourceCell[];

describe("mapRow: Reference Solutions fixture row (TR-04 deferred test)", () => {
  const record = mapRow(REFERENCE_SOLUTIONS_MAPPING, RS_FIXTURE_HEADERS, RS_FIXTURE_ROW, RS_FIXTURE_POSITION);

  it("maps the fixture row to the expected TranslatorRecord", () => {
    expect(record).toEqual(RS_FIXTURE_EXPECTED);
  });

  it("generates a ROW- ID from the row position when IUSA Number is blank", () => {
    expect(record.recordId).toBe("ROW-0007");
  });

  it("falls back to Professional Title when Executive Title is only spaces", () => {
    expect(record.title).toBe("Owner");
  });

  it("skips the empty middle executive slot and keeps the others in order", () => {
    expect(record.otherExecutives).toEqual([
      { name: "Demo Person 001", title: "Owner" },
      { name: "Demo Person 002", title: null },
    ]);
  });

  it("leaves email null, because the layout has no email column", () => {
    expect(record.email).toBeNull();
  });
});

describe("mapRow: synthetic layout", () => {
  it("fills all 9 fields from the 9 columns, and leaves every other field empty", () => {
    const row = syntheticRow(1);
    const record = mapRow(SYNTHETIC_MAPPING, SYNTHETIC_HEADERS, row, 1);

    expect(record).toEqual({
      recordId: "TST-0001",
      company: "Test Company 01",
      name: "Test Person 01",
      title: "Owner",
      city: "Phoenix",
      state: "AZ",
      industry: "Fabrication",
      email: "person01@example.invalid",
      employees: "25",
      phone: null,
      website: null,
      address: null,
      zip: null,
      naicsDescription: null,
      employeeRange: null,
      otherExecutives: [],
    });
    const filled = RECORD_FIELDS.filter((field) => field !== "otherExecutives" && record[field] !== null);
    expect(filled).toHaveLength(9);
  });

  it("reads columns by header name, not position", () => {
    const headers = [...SYNTHETIC_HEADERS].reverse();
    const row = syntheticRow(2).reverse();
    expect(mapRow(SYNTHETIC_MAPPING, headers, row, 1)).toEqual(
      mapRow(SYNTHETIC_MAPPING, SYNTHETIC_HEADERS, syntheticRow(2), 1),
    );
  });
});

describe("generatedRecordId", () => {
  it("pads to 4 digits and grows past 9999", () => {
    expect(generatedRecordId(1)).toBe("ROW-0001");
    expect(generatedRecordId(9999)).toBe("ROW-9999");
    expect(generatedRecordId(12345)).toBe("ROW-12345");
  });
});

describe("normalizeHeader", () => {
  it("trims the ends and ignores case", () => {
    expect(normalizeHeader("  City ")).toBe(normalizeHeader("city"));
  });

  it("keeps inner spacing, so Advertising  Expenses (two spaces) stays distinct", () => {
    expect(normalizeHeader("Advertising  Expenses")).toBe("advertising  expenses");
    expect(normalizeHeader("Advertising  Expenses")).not.toBe(normalizeHeader("Advertising Expenses"));
  });

  it("turns a blank header into an empty string", () => {
    expect(normalizeHeader(null)).toBe("");
    expect(normalizeHeader(undefined)).toBe("");
  });
});

describe("Reference Solutions mapping against the real header list", () => {
  it("has the 396 headers, with the unnamed last column and the double-spaced header", () => {
    expect(RS_HEADERS).toHaveLength(396);
    expect(RS_HEADERS[395]).toBeNull();
    expect(RS_HEADERS).toContain("Advertising  Expenses");
  });

  it("reads only columns that exist in a real export, executive slots 1 to 50 included", () => {
    const present = new Set(RS_HEADERS.map(normalizeHeader));
    const { fields } = REFERENCE_SOLUTIONS_MAPPING;
    const read: string[] = [fields.recordId.header];
    for (const field of TEXT_FIELDS) {
      const rule = fields[field];
      if (rule.kind === "column") read.push(rule.header);
      if (rule.kind === "join" || rule.kind === "firstNonBlank") read.push(...rule.headers);
    }
    const executives = fields.otherExecutives;
    if (executives.kind === "repeated") {
      for (let slot = 1; slot <= executives.slots; slot++) {
        for (const header of [...executives.nameHeaders, executives.titleHeader]) read.push(`${header} ${slot}`);
      }
    }
    expect(read.filter((header) => !present.has(normalizeHeader(header)))).toEqual([]);
  });
});
