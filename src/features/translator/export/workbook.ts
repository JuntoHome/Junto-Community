import ExcelJS from "exceljs";
import type { MappingRow } from "../import/describe-mapping";
import type { RankResult } from "../ranking";
import type { Counts } from "../ranking/counts";
import { setTextCell } from "./cells";
import { type CriteriaSection, criteriaTable, type ExportBriefOrigin, type ExportSource } from "./criteria-rows";
import { type ExportIntroDraft, type IntroDraftColumnKey, type IntroDraftsTable, introDraftsTable } from "./intro-drafts-rows";
import { SYNTHETIC_NOTE, WORKBOOK_SUBJECT, WORKBOOK_TITLE } from "./labels";
import { type ShortlistColumnKey, shortlistTable } from "./shortlist-rows";

/**
 * Builds the Excel file the user downloads (TR-25), in the browser, with ExcelJS. Load this
 * module with `await import()` (as the wizard loads `import/parse.ts`), so the workbook library
 * isn't part of the page's first download.
 *
 * Nothing is sent, stored or logged, and the uploaded workbook's bytes are never read or
 * changed here: the sheets are built from the ranking result, the counts and the file's
 * allowlist details only. The result is always a new file; nothing is saved over the upload.
 *
 * Formula safety (TR-27): every text cell is written by `setTextCell()` (`cells.ts`), and
 * `assertNoFormulas()` checks the whole workbook right before it is written out.
 *
 * No React. The only I/O is writing the new file's bytes in memory.
 */

/** Shown in the file's properties. */
export const WORKBOOK_CREATOR = "JCA Data Axle Translator";

export const SHORTLIST_SHEET_NAME = "Shortlist";
export const CRITERIA_SHEET_NAME = "Criteria";
export const INTRO_DRAFTS_SHEET_NAME = "Intro drafts";

/**
 * The Shortlist sheet's layout (TR-28): row 1 is the synthetic note, row 2 is blank, the table
 * header is row 3 and the first shortlist row is row 4.
 */
export const SHORTLIST_NOTE_ROW = 1;
export const SHORTLIST_HEADER_ROW = 3;

/**
 * The Intro drafts sheet (TR-52) has the Shortlist sheet's layout: the note in row 1, row 2
 * blank, the header in row 3, the first draft in row 4.
 */
export const INTRO_DRAFTS_NOTE_ROW = SHORTLIST_NOTE_ROW;
export const INTRO_DRAFTS_HEADER_ROW = SHORTLIST_HEADER_ROW;

/** Intro drafts column widths in characters. Only Draft wraps. */
const INTRO_DRAFT_WIDTHS: Record<IntroDraftColumnKey, number> = { rank: 8, recordId: 14, company: 30, draft: 90 };

/** The Criteria sheet's two columns. */
const CRITERIA_COLUMNS = [
  { header: "Item", width: 28 },
  { header: "Details", width: 90 },
] as const;

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

/** Why `buildWorkbook()` refused to write the file. The Export step shows its own generic message. */
export const FORMULA_BLOCKED_MESSAGE = "Export blocked: a cell would contain a formula.";

/**
 * Throws `FORMULA_BLOCKED_MESSAGE` if any cell of any sheet holds a formula: its type is
 * Formula, or its value is an object with `formula` or `sharedFormula`. Today nothing in the
 * export writes one; this makes a later mistake fail loudly instead of shipping a file that
 * calculates. The error never quotes the cell, because its value could be row data.
 */
export function assertNoFormulas(workbook: ExcelJS.Workbook): void {
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const value: unknown = cell.value;
        const isFormulaObject =
          typeof value === "object" && value !== null && ("formula" in value || "sharedFormula" in value);
        if (cell.type === ExcelJS.ValueType.Formula || isFormulaObject) {
          throw new Error(FORMULA_BLOCKED_MESSAGE);
        }
      });
    });
  });
}

/** The bytes ExcelJS wrote, as a plain ArrayBuffer of exactly the file's length. */
function toArrayBuffer(data: ExcelJS.Buffer): ArrayBuffer {
  // In the browser this is a Uint8Array (a Buffer polyfill); copy just its bytes.
  const view: Uint8Array = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
  return view.slice().buffer;
}

/**
 * Adds the Criteria sheet (TR-26): a bold, frozen `Item` / `Details` header, then each section
 * of `criteriaTable()` with its heading in bold on its own row and a blank row between sections.
 * The first section (title and synthetic note) has no heading; its rows span both columns, and
 * the title is bold. Every cell is text, through `setTextCell()`, so "1.0" stays "1.0". Empty
 * strings are left as truly empty cells.
 */
function addCriteriaSheet(workbook: ExcelJS.Workbook, sections: readonly CriteriaSection[]) {
  const sheet = workbook.addWorksheet(CRITERIA_SHEET_NAME, { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = CRITERIA_COLUMNS.map(({ width }) => ({ width }));

  const write = (cell: ExcelJS.Cell, text: string, bold = false) => {
    cell.alignment = { vertical: "top", wrapText: true };
    if (text === "") return;
    setTextCell(cell, text);
    if (bold) cell.font = { bold: true };
  };

  const header = sheet.getRow(1);
  CRITERIA_COLUMNS.forEach((column, index) => write(header.getCell(index + 1), column.header, true));

  let rowNumber = 2;
  sections.forEach((section, sectionIndex) => {
    // A blank row between sections.
    if (sectionIndex > 0) rowNumber++;
    if (section.heading !== null) write(sheet.getRow(rowNumber++).getCell(1), section.heading, true);
    section.rows.forEach(([label, value], rowIndex) => {
      const row = sheet.getRow(rowNumber);
      if (section.heading === null) {
        // Title and note: one cell across both columns, so the wrap uses the full width.
        sheet.mergeCells(rowNumber, 1, rowNumber, CRITERIA_COLUMNS.length);
        write(row.getCell(1), label, rowIndex === 0);
      } else {
        write(row.getCell(1), label);
        write(row.getCell(2), value);
      }
      rowNumber++;
    });
  });
}

/**
 * Adds the Intro drafts sheet (TR-52), laid out like Shortlist: the synthetic note in bold in row
 * 1, row 2 blank, a bold header in row 3 with a filter, frozen with everything above it, then one
 * row per draft (`introDraftsTable()`). Rank is a number for a shortlisted record; every other
 * value is text through `setTextCell()`, so a draft that starts with `=` or `@` stays text.
 */
function addIntroDraftsSheet(workbook: ExcelJS.Workbook, { columns, rows }: IntroDraftsTable) {
  const sheet = workbook.addWorksheet(INTRO_DRAFTS_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: INTRO_DRAFTS_HEADER_ROW }],
  });
  sheet.columns = columns.map(({ key }) => ({ key, width: INTRO_DRAFT_WIDTHS[key] }));

  const note = sheet.getRow(INTRO_DRAFTS_NOTE_ROW).getCell(1);
  setTextCell(note, SYNTHETIC_NOTE);
  note.font = { bold: true };

  const header = sheet.getRow(INTRO_DRAFTS_HEADER_ROW);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    setTextCell(cell, column.header);
    cell.font = { bold: true };
    cell.alignment = { vertical: "top", wrapText: true };
  });

  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(INTRO_DRAFTS_HEADER_ROW + 1 + rowIndex);
    columns.forEach((column, index) => {
      const value = values[index];
      const cell = row.getCell(index + 1);
      // Only Rank can be a number. Every string goes through setTextCell().
      if (typeof value === "number") {
        cell.value = value;
      } else {
        setTextCell(cell, value);
      }
      cell.alignment = column.key === "draft" ? { vertical: "top", wrapText: true } : { vertical: "top" };
    });
  });

  sheet.autoFilter = {
    from: { row: INTRO_DRAFTS_HEADER_ROW, column: 1 },
    to: { row: INTRO_DRAFTS_HEADER_ROW + rows.length, column: columns.length },
  };
}

/** What the Criteria and Intro drafts sheets need besides the ranking result. */
export type CriteriaInput = {
  /** `buildCounts()` for the same ranking result. */
  counts: Counts;
  /** The file the rows came from. */
  source: ExportSource;
  /** When the file is made. */
  now: Date;
  /** How the brief was made (TR-52), for the Criteria sheet. */
  origin: ExportBriefOrigin;
  /** The intro drafts by Record ID (TR-49), for the Intro drafts sheet. `{}` when there are none. */
  introDrafts: Readonly<Record<string, ExportIntroDraft>>;
};

/**
 * The export workbook for one ranking run, as the bytes of an .xlsx file. `mapping` is
 * `describeMapping()` for the loaded file, for the Missing column.
 *
 * Sheet `Shortlist`: row 1 is the synthetic note in bold, row 2 is blank, row 3 is a bold header
 * with a filter, frozen with everything above it, then one row per shortlist row
 * (`shortlistTable()`) from row 4. Text columns are stored as text, so long IUSA numbers and phone numbers
 * never turn into numbers or scientific notation; only Rank, Source row, Employees and Score are
 * numbers. Values the row doesn't have are left as truly empty cells.
 *
 * Sheet `Criteria`, after it: how the list was made (`criteriaTable()`), see `addCriteriaSheet()`.
 *
 * Sheet `Intro drafts`, last, only when the user kept at least one non-empty draft
 * (`introDraftsTable()`), see `addIntroDraftsSheet()`.
 *
 * Every text cell is a literal string with the Text format (`setTextCell()`), so a value such as
 * `=SUM(1,1)` shows as that text, never as 2. Throws `FORMULA_BLOCKED_MESSAGE` if a cell would
 * hold a formula (`assertNoFormulas()`).
 */
export async function buildWorkbook(
  rankResult: RankResult,
  mapping: readonly MappingRow[],
  { counts, source, now, origin, introDrafts }: CriteriaInput,
): Promise<ArrayBuffer> {
  const { columns, rows } = shortlistTable(rankResult, mapping);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = WORKBOOK_CREATOR;
  // The file's properties say it is a synthetic demonstration too (TR-28).
  workbook.title = WORKBOOK_TITLE;
  workbook.subject = WORKBOOK_SUBJECT;

  const sheet = workbook.addWorksheet(SHORTLIST_SHEET_NAME, {
    views: [{ state: "frozen", ySplit: SHORTLIST_HEADER_ROW }],
  });
  sheet.columns = columns.map(({ key }) => ({ key, width: WIDTHS[key] }));

  // The note: one bold cell that runs across the empty cells next to it. Row 2 stays blank.
  const note = sheet.getRow(SHORTLIST_NOTE_ROW).getCell(1);
  setTextCell(note, SYNTHETIC_NOTE);
  note.font = { bold: true };

  const header = sheet.getRow(SHORTLIST_HEADER_ROW);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    setTextCell(cell, column.header);
    cell.font = { bold: true };
    cell.alignment = { vertical: "top", wrapText: true };
  });

  rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(SHORTLIST_HEADER_ROW + 1 + rowIndex);
    columns.forEach((column, index) => {
      const value = values[index];
      // A value the row doesn't have stays a truly empty cell.
      if (value === null) return;
      const cell = row.getCell(index + 1);
      // `shortlistTable()` gives numbers only in the number columns. Every string goes through setTextCell().
      if (typeof value === "number") {
        cell.value = value;
      } else {
        setTextCell(cell, value);
      }
      cell.alignment = WRAPPED.has(column.key) ? { vertical: "top", wrapText: true } : { vertical: "top" };
    });
  });

  sheet.autoFilter = {
    from: { row: SHORTLIST_HEADER_ROW, column: 1 },
    to: { row: SHORTLIST_HEADER_ROW + rows.length, column: columns.length },
  };

  addCriteriaSheet(workbook, criteriaTable({ rankResult, counts, source, now, origin }));

  const drafts = introDraftsTable(introDrafts, rankResult);
  if (drafts) addIntroDraftsSheet(workbook, drafts);

  // The backstop: no formula ever leaves this function.
  assertNoFormulas(workbook);
  return toArrayBuffer(await workbook.xlsx.writeBuffer());
}
