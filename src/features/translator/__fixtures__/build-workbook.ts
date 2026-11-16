import ExcelJS from "exceljs";

/**
 * Builds small .xlsx workbooks in memory for tests, so no fixture workbook is committed as a
 * binary: every test file says exactly what its workbook holds, and a change is a readable diff.
 *
 * Tests hand the bytes straight to `parseWorkbook()`, past the file gate, which is why these
 * workbooks never need (and must never get) an allowlist entry.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */

/** One cell: a plain value, or one of the cell objects below. `null` or `undefined` leaves the cell empty. */
export type FixtureCell = ExcelJS.CellValue | undefined;

/** One row of cells from column A. An empty array is a completely empty row. */
export type FixtureRow = readonly FixtureCell[];

export type FixtureSheet = { name: string; rows: readonly FixtureRow[] };

/** Text with formatting runs; a reader should get the runs' text joined. */
export function richText(...runs: readonly (string | { text: string; bold: true })[]): ExcelJS.CellRichTextValue {
  return {
    richText: runs.map((run) => (typeof run === "string" ? { text: run } : { text: run.text, font: { bold: true } })),
  };
}

/**
 * A formula cell. With `result`, the file stores it as the last calculated value, as Excel does
 * when it saves. Without it, the file has the formula only (as some tools write it).
 */
export function formula(text: string, result?: string | number | boolean): ExcelJS.CellFormulaValue {
  return result === undefined ? { formula: text, date1904: false } : { formula: text, result, date1904: false };
}

/** A link cell showing `text`. */
export function hyperlink(text: string, url: string): ExcelJS.CellHyperlinkValue {
  return { text, hyperlink: url };
}

/** An error cell, such as "#N/A" or "#DIV/0!". */
export function errorCell(error: ExcelJS.CellErrorValue["error"]): ExcelJS.CellErrorValue {
  return { error };
}

/** A date cell for a calendar day, at midnight UTC, so the result doesn't depend on the machine's time zone. */
export function dateCell(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * The bytes of a workbook with these sheets, in this order. Row 1 of each sheet is `rows[0]`.
 * Empty rows are left out of the file, as Excel does, so later rows keep their row numbers.
 */
export async function buildXlsx({ sheets }: { sheets: readonly FixtureSheet[] }): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  // Fixed dates, so the same sheets always give the same workbook contents.
  workbook.created = new Date(Date.UTC(2026, 0, 1));
  workbook.modified = new Date(Date.UTC(2026, 0, 1));

  for (const { name, rows } of sheets) {
    const sheet = workbook.addWorksheet(name);
    rows.forEach((cells, index) => {
      cells.forEach((value, column) => {
        if (value != null) sheet.getRow(index + 1).getCell(column + 1).value = value;
      });
    });
  }

  const written = await workbook.xlsx.writeBuffer();
  // ExcelJS returns a Node Buffer here; copy it into a plain ArrayBuffer like the browser hands over.
  const bytes = new Uint8Array(written as ArrayBuffer);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

/** A file's bytes as a plain ArrayBuffer (for reading the committed sample with `fs`). */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
