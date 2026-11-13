import ExcelJS from "exceljs";
import type { TranslatorRecord } from "./fields";
import { mapRow, normalizeHeader, type SourceCell } from "./map-row";
import { LAYOUT_MAPPINGS } from "./mappings";
import type { LayoutMapping } from "./mappings/types";
import { HEADER_MESSAGES, validateHeaders, type HeaderProblem } from "./validate-headers";
import { makeExcelJsCompatible } from "./xlsx-compat";

/**
 * Reads a workbook that passed the file gate into rows the rest of the Translator works with.
 * It finds the sheet, recognises its layout from the row 1 headers, checks the required columns
 * are there (`validateHeaders()`), and only then maps every data row with `mapRow()`, keeping
 * each row's original row number and raw cells.
 *
 * Runs in the browser on the bytes the file gate already read (`GatedWorkbook.buffer`). Nothing
 * is sent, stored or logged. The layout is detected from the headers, never from the allowlist.
 *
 * Pure: no React, no network, no logging.
 */

// Messages. They name the problem and say how to fix it.
export const PARSE_MESSAGES = {
  unreadable:
    "This file couldn't be opened as an Excel workbook. It may be damaged. Open it in Excel, save it as .xlsx and try again.",
  unrecognized: "We couldn't recognize this file. It should be a Data Axle Reference Solutions export.",
  noRows: "This file has no contact rows below the header row. Choose a workbook that contains contacts.",
  tooManyRows:
    "This file has more than 1,000 contact rows. Remove rows in Excel (or split the file) so it has 1,000 or fewer, then upload it again.",
} as const;

export type ParseProblem = keyof typeof PARSE_MESSAGES;

/** Most data rows the Translator reads from one workbook. */
export const MAX_DATA_ROWS = 1000;

/** The sheet to use when a workbook has more than one, compared ignoring case and outer spaces. */
const PREFERRED_SHEET = "contacts";

/** One data row: where it came from and the record it maps to. */
export type ParsedRow = {
  /** The row's number in the spreadsheet (the header is row 1, so the first data row is 2). */
  sourceRow: number;
  /** The row's cells as read, in column order (column A first). Blank cells are null. */
  sourceValues: SourceCell[];
  record: TranslatorRecord;
};

export type ParsedWorkbook = {
  /** The detected layout. `layout.label` ("Synthetic", "Reference Solutions") is shown on the Preview step. */
  layout: LayoutMapping;
  /** The sheet the rows came from. */
  sheetName: string;
  /** Row 1, in column order. Blank header cells are null. */
  headers: SourceCell[];
  /** Optional mapped columns the file doesn't have, as the mapping names them. Their values are unknown (null). */
  missingOptional: string[];
  /** Data rows in sheet order, completely empty rows skipped. Between 1 and MAX_DATA_ROWS. */
  rows: ParsedRow[];
};

export type ParseResult =
  | { ok: true; workbook: ParsedWorkbook }
  | {
      ok: false;
      code: ParseProblem | HeaderProblem;
      message: string;
      /** What to do next, shown as its own line under the message. Only some problems have one. */
      hint?: string;
      /** For "missingRequired": the missing columns, as the mapping names them. */
      missing?: string[];
    };

const fail = (code: ParseProblem): ParseResult => ({ ok: false, code, message: PARSE_MESSAGES[code] });

/** A layout is recognised only when it has at least this many of its signature headers in row 1. */
const MIN_SIGNATURE_HEADERS = 2;

/** A date cell as text: "2026-11-13", or the full ISO time when it has one. */
function dateText(date: Date): string {
  const iso = date.toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso;
}

/**
 * An ExcelJS cell value as a plain SourceCell: text, number and true/false stay as they are;
 * rich text and links become their text, formulas their last calculated result, errors their
 * code ("#N/A") and dates ISO text. Anything else is treated as blank.
 */
export function toSourceCell(value: ExcelJS.CellValue): SourceCell {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return dateText(value);
  if ("richText" in value) return value.richText.map((run) => run.text).join("");
  if ("hyperlink" in value) {
    // ExcelJS types `text` as a string, but a styled link comes back as rich text.
    const text: unknown = value.text;
    return typeof text === "string" ? text : toSourceCell(text as ExcelJS.CellValue);
  }
  if ("formula" in value || "sharedFormula" in value) return toSourceCell(value.result);
  if ("error" in value) return value.error;
  return null;
}

/** A row's cells from column A to its last used cell. A missing row is an empty list. */
function rowCells(row: ExcelJS.Row | undefined): SourceCell[] {
  if (!row) return [];
  const cells: SourceCell[] = [];
  for (let column = 1; column <= row.cellCount; column++) cells.push(toSourceCell(row.getCell(column).value));
  return cells;
}

/** True when every cell is blank or only spaces. */
function isEmptyRow(cells: readonly SourceCell[]): boolean {
  return cells.every((cell) => cell == null || String(cell).trim() === "");
}

/**
 * The layout with the most of its signature headers in `headers`, if it has at least
 * MIN_SIGNATURE_HEADERS of them. A tie for the most, or too few, is null. Extra and blank
 * headers don't matter, and required headers don't count: a file missing one is still
 * recognised, so `validateHeaders()` can say which column is missing.
 */
export function detectLayout(headers: readonly SourceCell[]): LayoutMapping | null {
  const present = new Set(headers.map(normalizeHeader).filter((header) => header !== ""));
  const scored = LAYOUT_MAPPINGS.map((mapping) => ({
    mapping,
    score: mapping.signatureHeaders.filter((header) => present.has(normalizeHeader(header))).length,
  })).sort((a, b) => b.score - a.score);
  const [best, runnerUp] = scored;
  if (!best || best.score < MIN_SIGNATURE_HEADERS) return null;
  if (runnerUp && runnerUp.score === best.score) return null;
  return best.mapping;
}

/**
 * The sheet to read and its layout: the "Contacts" sheet if its row 1 is a known layout,
 * otherwise the first sheet (in workbook order) whose row 1 is. Null when no sheet matches.
 */
function findSheet(
  workbook: ExcelJS.Workbook,
): { sheet: ExcelJS.Worksheet; headers: SourceCell[]; layout: LayoutMapping } | null {
  const sheets = workbook.worksheets;
  const preferred = sheets.filter((sheet) => sheet.name.trim().toLowerCase() === PREFERRED_SHEET);
  for (const sheet of [...preferred, ...sheets.filter((sheet) => !preferred.includes(sheet))]) {
    const headers = rowCells(sheet.findRow(1));
    const layout = detectLayout(headers);
    if (layout) return { sheet, headers, layout };
  }
  return null;
}

/**
 * Parses a workbook's bytes. Never throws: a file that isn't a readable workbook, has no sheet
 * in a known layout, is missing a required column (or has one twice), has no data rows or has
 * more than MAX_DATA_ROWS comes back as a problem with a message for the user.
 *
 * A data row's generated ID ("ROW-0001" when the layout's ID cell is blank) comes from its
 * position below the header, counting skipped empty rows, so it always points at the same row:
 * spreadsheet row 2 is ROW-0001, row 10 is ROW-0009.
 */
export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(await makeExcelJsCompatible(buffer));
  } catch {
    // Not a ZIP, a ZIP that isn't a workbook, or a damaged workbook. The error isn't logged: it may quote cell data.
    return fail("unreadable");
  }
  // A ZIP with no worksheets (for example a Word file renamed .xlsx) can load without an error.
  if (workbook.worksheets.length === 0) return fail("unreadable");

  const found = findSheet(workbook);
  if (!found) return fail("unrecognized");
  const { sheet, headers, layout } = found;

  // Checked before any data row is read.
  const check = validateHeaders(layout, headers);
  if (!check.ok) {
    const { code, message, missing } = check;
    return code === "missingRequired"
      ? { ok: false, code, message, hint: HEADER_MESSAGES.missingRequiredHint, missing }
      : { ok: false, code, message };
  }

  const rows: ParsedRow[] = [];
  // rowCount is the last row in use; missing rows in between are skipped by findRow.
  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const cells = rowCells(sheet.findRow(rowNumber));
    if (isEmptyRow(cells)) continue;
    if (rows.length === MAX_DATA_ROWS) return fail("tooManyRows");
    rows.push({ sourceRow: rowNumber, sourceValues: cells, record: mapRow(layout, headers, cells, rowNumber - 1) });
  }
  if (rows.length === 0) return fail("noRows");

  return {
    ok: true,
    workbook: { layout, sheetName: sheet.name, headers, missingOptional: check.missingOptional, rows },
  };
}
