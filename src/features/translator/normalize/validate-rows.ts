import { generatedRecordId } from "../import/map-row";
import type { LayoutMapping } from "../import/mappings/types";
import { matchKey } from "./match-key";
import { normalizeEmployees, type NormalizedRow } from "./normalize";

/**
 * Flags rows with problems after the normalize step (TR-11), so the user can see what was
 * skipped and why. Runs in the browser right after `normalizeWorkbook()`.
 *
 * Pure and deterministic: no React, no I/O, no logging. The same rows always give the same result.
 */

/** What kind of problem a row has. `possible-duplicate` comes from duplicate grouping (TR-12, duplicates.ts). */
export type RowIssueCode = "invalid-employees" | "duplicate-id" | "generated-id" | "possible-duplicate";

/** "warning": the row is kept and ranked. "excluded": the row is left out of everything after this step. */
export type RowIssueSeverity = "warning" | "excluded";

export type RowIssue = {
  /** The row's spreadsheet number. Null for an issue about the whole file (one summary instead of one per row). */
  sourceRow: number | null;
  /** The row's Record ID, as normalized. Null for an issue about the whole file. */
  recordId: string | null;
  code: RowIssueCode;
  severity: RowIssueSeverity;
  /** A plain-language sentence for the user. It may quote a cell value: show it, never log it. */
  reason: string;
};

export type RowValidation = {
  /** Rows that go forward to ranking and export. Every Record ID here is unique, ignoring case and spacing. */
  kept: NormalizedRow[];
  /** Rows left out. Their count is the "invalid rows" figure in the counts summary (TR-23). */
  excluded: NormalizedRow[];
  /** Sorted by sourceRow (whole-file issues first), then code. */
  issues: RowIssue[];
};

/** Longest cell value quoted in a reason. */
const MAX_QUOTED = 40;

/** Trimmed, inner whitespace collapsed, and cut to MAX_QUOTED characters ("..." when cut). */
export function quote(text: string): string {
  const characters = Array.from(text.trim().replace(/\s+/g, " "));
  return characters.length > MAX_QUOTED ? `${characters.slice(0, MAX_QUOTED).join("")}...` : characters.join("");
}

// Reasons. Each says what is wrong and what the Translator does about it.
export const ROW_ISSUE_REASONS = {
  invalidEmployees: (value: string, range: string | null) =>
    `Employees value "${quote(value)}" isn't a whole number, so company size is treated as unknown.` +
    (range === null ? "" : ` Using the size range ${quote(range)} instead.`),
  duplicateId: (recordId: string, firstRow: number) =>
    `Record ID ${quote(recordId)} is also used on row ${firstRow}. Row ${firstRow} is used and this row is left out.`,
  generatedId: (idColumn: string, recordId: string) =>
    `${idColumn} is blank, so this row was given the ID ${recordId}.`,
  generatedIdEveryRow: (idColumn: string) =>
    `No row has an ${idColumn}, so every row was given an ID from its row number (row 2 is ROW-0001).`,
} as const;

/**
 * Whether the parser generated this row's ID because the ID cell was blank or the column was
 * missing. `parseWorkbook()` gives spreadsheet row N the ID of data position N - 1 (row 2 is
 * ROW-0001), so a generated ID is exactly that one.
 */
function hasGeneratedId(row: NormalizedRow): boolean {
  return row.record.recordId === generatedRecordId(row.sourceRow - 1);
}

/**
 * An `invalid-employees` issue when the employees cell isn't blank but isn't a whole number.
 * TR-10 drops the "invalid" reason once a size range is read instead, so the employees value is
 * checked on its own here, with TR-10's own rule.
 */
function employeesIssue(row: NormalizedRow): RowIssue | null {
  const actual = normalizeEmployees(row.record.employees, null);
  if (actual.known || actual.reason !== "invalid" || actual.original === null) return null;
  const used = row.normalized.employees;
  const range = used.known && used.source === "range" ? used.original : null;
  return {
    sourceRow: row.sourceRow,
    recordId: row.normalized.recordId,
    code: "invalid-employees",
    severity: "warning",
    reason: ROW_ISSUE_REASONS.invalidEmployees(actual.original, range),
  };
}

/** Whole-file issues (sourceRow null) first, then by row number, then by code. */
export function compareIssues(a: RowIssue, b: RowIssue): number {
  const rowA = a.sourceRow ?? 0;
  const rowB = b.sourceRow ?? 0;
  if (rowA !== rowB) return rowA - rowB;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

/**
 * Splits normalized rows into kept and excluded, and lists every issue found.
 *
 * - **Invalid employees** (warning): the employees cell has text that isn't a whole number
 *   ("25.5", "-3", "N/A"). Blank cells are not flagged. The row is kept with an unknown size
 *   (or the size range, when TR-10 could read one).
 * - **Duplicate Record ID** (excluded): IDs are compared with `matchKey()`, so "SYN-0007" and
 *   " syn-0007 " are the same. The row with the lowest `sourceRow` is kept; every later one is excluded.
 * - **Generated ID** (warning): the ID cell was blank, so the parser gave the row a `ROW-0001`
 *   style ID. For the Reference Solutions layout, when no row has an IUSA Number (expected: the
 *   column is optional), this is one whole-file issue instead of one per row.
 *
 * Invariant: every row in `kept` has a unique Record ID, compared with `matchKey()`. Later steps
 * (duplicate grouping, ranking, pin and omit, export) may rely on it.
 *
 * `kept` and `excluded` are in `sourceRow` order. A row can have more than one issue.
 */
export function validateRows(rows: readonly NormalizedRow[], layout: LayoutMapping): RowValidation {
  const ordered = [...rows].sort((a, b) => a.sourceRow - b.sourceRow);
  const idColumn = layout.fields.recordId.header;
  const kept: NormalizedRow[] = [];
  const excluded: NormalizedRow[] = [];
  const issues: RowIssue[] = [];

  const everyIdGenerated = ordered.length > 0 && ordered.every(hasGeneratedId);
  const summarizeGeneratedIds = layout.id === "reference-solutions" && everyIdGenerated;
  if (summarizeGeneratedIds) {
    issues.push({
      sourceRow: null,
      recordId: null,
      code: "generated-id",
      severity: "warning",
      reason: ROW_ISSUE_REASONS.generatedIdEveryRow(idColumn),
    });
  }

  // The first row seen for each ID key.
  const firstRowById = new Map<string, number>();

  for (const row of ordered) {
    const { recordId } = row.normalized;

    const employees = employeesIssue(row);
    if (employees) issues.push(employees);

    if (!summarizeGeneratedIds && hasGeneratedId(row)) {
      issues.push({
        sourceRow: row.sourceRow,
        recordId,
        code: "generated-id",
        severity: "warning",
        reason: ROW_ISSUE_REASONS.generatedId(idColumn, recordId),
      });
    }

    const key = matchKey(recordId);
    const firstRow = firstRowById.get(key);
    if (firstRow === undefined) {
      firstRowById.set(key, row.sourceRow);
      kept.push(row);
    } else {
      excluded.push(row);
      issues.push({
        sourceRow: row.sourceRow,
        recordId,
        code: "duplicate-id",
        severity: "excluded",
        reason: ROW_ISSUE_REASONS.duplicateId(recordId, firstRow),
      });
    }
  }

  issues.sort(compareIssues);
  return { kept, excluded, issues };
}
