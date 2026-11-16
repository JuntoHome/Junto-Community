import ExcelJS from "exceljs";
import type { MappingRow } from "../import/describe-mapping";
import type { RankResult } from "../ranking";
import { textCell } from "./cells";
import { type ShortlistColumnKey, shortlistTable } from "./shortlist-rows";

/**
 * Builds the Excel file the user downloads (TR-25), in the browser, with ExcelJS. Load this
 * module with `await import()` (as the wizard loads `import/parse.ts`), so the workbook library
 * isn't part of the page's first download.
 *
 * Nothing is sent, stored or logged, and the uploaded workbook's bytes are never read or
 * changed here: the sheet is built from the ranking result only.
 *
 * No React. The only I/O is writing the new file's bytes in memory.
 */

/** Shown in the file's properties. */
export const WORKBOOK_CREATOR = "JCA Data Axle Translator";

export const SHORTLIST_SHEET_NAME = "Shortlist";

/** Column widths in characters. */
const WIDTHS: Record<ShortlistColumnKey, number> = {
  rank: 7,
  recordId: 14,
  duplicateIds: 16,
  sourceRow: 11,
  company: 28,
  name: 22,
  title: 22,
  city: 14,
  state: 8,
  industry: 20,
  employees: 11,
  employeeRange: 16,
  email: 30,
  phone: 16,
  website: 28,
  otherExecutives: 40,
  score: 8,
  reasons: 60,
  missing: 18,
  override: 10,
};

/** Long text that wraps inside its cell instead of running across the next ones. */
const WRAPPED: ReadonlySet<ShortlistColumnKey> = new Set(["otherExecutives", "reasons"]);

/** Excel's "Text" number format, so an ID or phone number typed over later also stays text. */
const TEXT_FORMAT = "@";

/** The bytes ExcelJS wrote, as a plain ArrayBuffer of exactly the file's length. */
function toArrayBuffer(data: ExcelJS.Buffer): ArrayBuffer {
  // In the browser this is a Uint8Array (a Buffer polyfill); copy just its bytes.
  const view: Uint8Array = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
  return view.slice().buffer;
}

/**
 * The export workbook for one ranking run, as the bytes of an .xlsx file. `mapping` is
 * `describeMapping()` for the loaded file, for the Missing column.
 *
 * Sheet `Shortlist`: a bold, frozen header row with a filter, then one row per shortlist row
 * (`shortlistTable()`). Text columns are stored as text, so long IUSA numbers and phone numbers
 * never turn into numbers or scientific notation; only Rank, Source row, Employees and Score are
 * numbers. Values the row doesn't have are left as truly empty cells.
 */
export async function buildWorkbook(rankResult: RankResult, mapping: readonly MappingRow[]): Promise<ArrayBuffer> {
  const { columns, rows } = shortlistTable(rankResult, mapping);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = WORKBOOK_CREATOR;

  const sheet = workbook.addWorksheet(SHORTLIST_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = columns.map(({ key }) => ({ key, width: WIDTHS[key] }));

  const header = sheet.getRow(1);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = textCell(column.header);
    cell.font = { bold: true };
    cell.alignment = { vertical: "top", wrapText: true };
  });

  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(rowIndex + 2);
    columns.forEach((column, index) => {
      const value = values[index];
      // A value the row doesn't have stays a truly empty cell.
      if (value === null) return;
      const cell = row.getCell(index + 1);
      // `shortlistTable()` gives numbers only in the number columns. Every string goes through textCell().
      if (typeof value === "number") {
        cell.value = value;
      } else {
        cell.value = textCell(value);
        cell.numFmt = TEXT_FORMAT;
      }
      cell.alignment = WRAPPED.has(column.key) ? { vertical: "top", wrapText: true } : { vertical: "top" };
    });
  });

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: columns.length },
  };

  return toArrayBuffer(await workbook.xlsx.writeBuffer());
}
