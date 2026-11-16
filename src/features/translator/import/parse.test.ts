import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildXlsx, toArrayBuffer, type FixtureRow } from "../__fixtures__/build-workbook";
import {
  SAMPLE_PATH,
  rsBusiness,
  rsSheet,
  seededBytes,
  syntheticRow,
  syntheticSheet,
} from "../__fixtures__/records";
import { MAX_DATA_ROWS, PARSE_MESSAGES, parseWorkbook, type ParseResult } from "./parse";

/** A one-sheet workbook named "Contacts". */
const oneSheet = (rows: readonly FixtureRow[]) => buildXlsx({ sheets: [{ name: "Contacts", rows }] });

/** The parsed workbook, or a failed test naming the problem. */
function parsed(result: ParseResult) {
  if (!result.ok) throw new Error(`Expected the workbook to parse, got ${result.code}`);
  return result.workbook;
}

/** A sheet of instructions with no known headers, like the sample's "Guide" sheet. */
const GUIDE_ROWS: FixtureRow[] = [
  ["About this workbook", null],
  ["Purpose", "Invented test data"],
];

describe("parseWorkbook: the synthetic sample", () => {
  it("reads 500 rows from sheet Contacts in the Synthetic layout, rows 2 to 501", async () => {
    const workbook = parsed(await parseWorkbook(toArrayBuffer(readFileSync(SAMPLE_PATH))));
    expect(workbook.layout.id).toBe("synthetic");
    expect(workbook.layout.label).toBe("Synthetic");
    expect(workbook.sheetName).toBe("Contacts");
    expect(workbook.rows).toHaveLength(500);
    expect(workbook.rows.map((row) => row.sourceRow)).toEqual(Array.from({ length: 500 }, (_, i) => i + 2));
    expect(workbook.rows[0].record.recordId).toBe("SYN-0001");
    expect(workbook.missingOptional).toEqual([]);
  });
});

describe("parseWorkbook: choosing the sheet", () => {
  it("skips a Guide sheet and uses the first sheet in a known layout", async () => {
    const buffer = await buildXlsx({
      sheets: [
        { name: "Guide", rows: GUIDE_ROWS },
        { name: "Export", rows: syntheticSheet([syntheticRow(1)]) },
      ],
    });
    const workbook = parsed(await parseWorkbook(buffer));
    expect(workbook.sheetName).toBe("Export");
    expect(workbook.rows).toHaveLength(1);
  });

  it("prefers a sheet named Contacts over an earlier sheet in a known layout", async () => {
    const buffer = await buildXlsx({
      sheets: [
        { name: "Guide", rows: GUIDE_ROWS },
        { name: "Older", rows: syntheticSheet([syntheticRow(1), syntheticRow(2)]) },
        { name: " contacts ", rows: syntheticSheet([syntheticRow(3)]) },
      ],
    });
    const workbook = parsed(await parseWorkbook(buffer));
    expect(workbook.sheetName).toBe(" contacts ");
    expect(workbook.rows.map((row) => row.record.recordId)).toEqual(["TST-0003"]);
  });
});

describe("parseWorkbook: layout detection", () => {
  it("detects the 396 Reference Solutions headers plus 2 rows as Reference Solutions", async () => {
    const workbook = parsed(await parseWorkbook(await oneSheet(rsSheet([rsBusiness(1), rsBusiness(2)]))));
    expect(workbook.layout.id).toBe("reference-solutions");
    expect(workbook.layout.label).toBe("Reference Solutions");
    expect(workbook.headers).toHaveLength(395); // The unnamed 396th column is empty, so the row ends at 395.
    expect(workbook.rows).toHaveLength(2);
    expect(workbook.rows[0].record).toMatchObject({
      recordId: "TST-9001",
      company: "Test Company 01",
      city: "Tempe",
      state: "AZ",
      industry: "Logistics",
      employees: "40",
      title: "Operations Manager",
      name: "Test Person 01",
      email: null,
    });
  });

  it("refuses an unrelated sheet with the couldn't recognize message", async () => {
    const buffer = await oneSheet([
      ["Item", "Quantity", "Price"],
      ["Test item 01", 2, 3.5],
    ]);
    expect(await parseWorkbook(buffer)).toEqual({
      ok: false,
      code: "unrecognized",
      message: PARSE_MESSAGES.unrecognized,
    });
  });
});

describe("parseWorkbook: rows", () => {
  it("skips a blank row, and generated IDs still match the spreadsheet rows", async () => {
    const blankId = { "Record ID": null };
    const sheet = syntheticSheet([syntheticRow(1, blankId), [], syntheticRow(3, blankId)]);
    const workbook = parsed(await parseWorkbook(await oneSheet(sheet)));
    expect(workbook.rows.map((row) => row.sourceRow)).toEqual([2, 4]);
    // Row 2 is ROW-0001 and row 4 is ROW-0003: the skipped row 3 still counts.
    expect(workbook.rows.map((row) => row.record.recordId)).toEqual(["ROW-0001", "ROW-0003"]);
  });

  it("also skips a row whose cells are only spaces", async () => {
    const spaces = syntheticRow(2).map(() => "   ");
    const workbook = parsed(await parseWorkbook(await oneSheet(syntheticSheet([syntheticRow(1), spaces]))));
    expect(workbook.rows.map((row) => row.sourceRow)).toEqual([2]);
  });

  it("accepts 1,000 rows and refuses 1,001 with the limit message", async () => {
    expect(MAX_DATA_ROWS).toBe(1000);
    const rows = Array.from({ length: 1001 }, (_, i) => syntheticRow(1, { "Record ID": `TST-${i + 1}` }));

    const atLimit = parsed(await parseWorkbook(await oneSheet(syntheticSheet(rows.slice(0, 1000)))));
    expect(atLimit.rows).toHaveLength(1000);

    expect(await parseWorkbook(await oneSheet(syntheticSheet(rows)))).toEqual({
      ok: false,
      code: "tooManyRows",
      message: PARSE_MESSAGES.tooManyRows,
    });
  });

  it("refuses a sheet with headers only: no contact rows", async () => {
    expect(await parseWorkbook(await oneSheet(syntheticSheet([])))).toEqual({
      ok: false,
      code: "noRows",
      message: PARSE_MESSAGES.noRows,
    });
  });
});

describe("parseWorkbook: files that aren't workbooks", () => {
  it("returns couldn't open, without throwing, for random bytes", async () => {
    const bytes = seededBytes(29, 4096);
    await expect(parseWorkbook(toArrayBuffer(bytes))).resolves.toEqual({
      ok: false,
      code: "unreadable",
      message: PARSE_MESSAGES.unreadable,
    });
  });

  it("returns couldn't open for random bytes behind a ZIP signature", async () => {
    const bytes = seededBytes(35, 4096);
    bytes.set([0x50, 0x4b, 0x03, 0x04]);
    await expect(parseWorkbook(toArrayBuffer(bytes))).resolves.toMatchObject({ ok: false, code: "unreadable" });
  });

  it("returns couldn't open for an empty buffer", async () => {
    await expect(parseWorkbook(new ArrayBuffer(0))).resolves.toMatchObject({ ok: false, code: "unreadable" });
  });
});
