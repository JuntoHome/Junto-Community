import { describe, expect, it } from "vitest";
import {
  buildXlsx,
  dateCell,
  errorCell,
  formula,
  hyperlink,
  richText,
} from "../__fixtures__/build-workbook";
import { syntheticRow, syntheticSheet } from "../__fixtures__/records";
import { normalizeRecord } from "../normalize/normalize";
import { parseWorkbook, toSourceCell } from "./parse";

/**
 * Malformed and unusual cells. Each case is checked twice: `toSourceCell()` on the ExcelJS value
 * directly, and end to end, written into a real workbook and read back by `parseWorkbook()`, so
 * a change in how ExcelJS stores a cell type is caught too.
 */

describe("toSourceCell", () => {
  it("joins the runs of rich text", () => {
    expect(toSourceCell(richText("Test ", { text: "Company", bold: true }, " 01"))).toBe("Test Company 01");
  });

  it("uses a formula's cached result", () => {
    expect(toSourceCell(formula('"Own"&"er"', "Owner"))).toBe("Owner");
    expect(toSourceCell(formula("20+5", 25))).toBe(25);
  });

  it("gives null for a formula without a cached result", () => {
    expect(toSourceCell(formula("A1"))).toBeNull();
  });

  it("uses a hyperlink's text, not its address", () => {
    expect(toSourceCell(hyperlink("Test Company 01 site", "https://test-company-01.example.invalid/"))).toBe(
      "Test Company 01 site",
    );
  });

  it("uses the text of a hyperlink whose text is rich text", () => {
    const styled = { text: richText("Test ", { text: "Site", bold: true }), hyperlink: "https://example.invalid/" };
    expect(toSourceCell(styled as unknown as Parameters<typeof toSourceCell>[0])).toBe("Test Site");
  });

  it("writes a date as ISO text: the day alone at midnight UTC, the full time otherwise", () => {
    expect(toSourceCell(dateCell(2026, 1, 2))).toBe("2026-01-02");
    expect(toSourceCell(new Date(Date.UTC(2026, 0, 2, 9, 30)))).toBe("2026-01-02T09:30:00.000Z");
  });

  it("gives null for an error cell", () => {
    expect(toSourceCell(errorCell("#N/A"))).toBeNull();
    expect(toSourceCell(errorCell("#DIV/0!"))).toBeNull();
  });

  it("keeps text, numbers and true/false as they are, and blank as null", () => {
    expect(toSourceCell("   ")).toBe("   ");
    expect(toSourceCell(25)).toBe(25);
    expect(toSourceCell(false)).toBe(false);
    expect(toSourceCell(null)).toBeNull();
  });
});

describe("malformed cells read from a workbook", () => {
  async function readRow(changes: Parameters<typeof syntheticRow>[1]) {
    const buffer = await buildXlsx({ sheets: [{ name: "Contacts", rows: syntheticSheet([syntheticRow(1, changes)]) }] });
    const result = await parseWorkbook(buffer);
    if (!result.ok) throw new Error(`Expected the workbook to parse, got ${result.code}`);
    return result.workbook.rows[0];
  }

  it("rich text becomes its plain text", async () => {
    const row = await readRow({ Company: richText("Test ", { text: "Company", bold: true }, " 01") });
    expect(row.record.company).toBe("Test Company 01");
  });

  it("a formula becomes its cached result", async () => {
    const row = await readRow({ Title: formula('"Own"&"er"', "Owner"), Employees: formula("20+5", 25) });
    expect(row.record.title).toBe("Owner");
    expect(row.record.employees).toBe("25");
  });

  it("a formula without a cached result is null", async () => {
    const row = await readRow({ Title: formula("B2") });
    expect(row.record.title).toBeNull();
    expect(normalizeRecord(row.record).title).toEqual({ known: false, reason: "blank", original: null });
  });

  it("a hyperlink becomes its text", async () => {
    const row = await readRow({ Email: hyperlink("person01@example.invalid", "mailto:person01@example.invalid") });
    expect(row.record.email).toBe("person01@example.invalid");
  });

  it("a date becomes ISO text", async () => {
    const row = await readRow({ Title: dateCell(2026, 1, 2) });
    expect(row.record.title).toBe("2026-01-02");
  });

  it("an error cell is null", async () => {
    const row = await readRow({ Employees: errorCell("#N/A"), Industry: errorCell("#REF!") });
    expect(row.sourceValues[8]).toBeNull();
    expect(row.record.employees).toBeNull();
    expect(row.record.industry).toBeNull();
  });

  it("a whitespace-only cell is null in the record", async () => {
    const row = await readRow({ City: "   ", Title: " \t " });
    expect(row.record.city).toBeNull();
    expect(row.record.title).toBeNull();
    expect(normalizeRecord(row.record).city).toMatchObject({ known: false, reason: "blank" });
  });

  it("a number becomes text in the record, and stays a number in sourceValues", async () => {
    const row = await readRow({ Employees: 1200 });
    expect(row.sourceValues[8]).toBe(1200);
    expect(row.record.employees).toBe("1200");
    expect(normalizeRecord(row.record).employees).toMatchObject({ known: true, count: 1200, source: "actual" });
  });
});
