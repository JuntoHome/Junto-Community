import type { GroupedRecord } from "./duplicates";
import type { NormalizedWorkbook } from "./normalize";
import type { RowIssue, RowValidation } from "./validate-rows";

/**
 * Counts what happened to a workbook's rows between parsing and ranking, for the Preview step
 * (TR-13) and the counts summary (TR-23).
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/** Everything the import keeps about a workbook after parsing, cleaning, row checks and duplicate grouping. */
export type ImportState = {
  /** The parsed workbook, every row normalized (TR-10). */
  parsed: NormalizedWorkbook;
  /** `kept` and `excluded` rows, and the row check issues (TR-11). */
  validation: RowValidation;
  /** `kept` with exact duplicates folded into the earliest row (TR-12). Later steps use only these. */
  records: GroupedRecord[];
  /** Rows folded into another row. */
  duplicateCount: number;
  /** Every issue from the row checks and duplicate grouping, sorted by row then code. */
  issues: RowIssue[];
};

export type ImportSummary = {
  /** Data rows read from the sheet, not counting empty rows. */
  rowsRead: number;
  /** Completely empty rows between the header and the last data row. */
  skippedEmptyRows: number;
  /** Rows folded into an earlier row as exact duplicates. */
  duplicatesGrouped: number;
  /** One per business: the records ranking uses. */
  uniqueRecords: number;
  /** Rows the row checks excluded (the "invalid rows" figure). */
  rowsLeftOut: number;
  /** Rows not left out that have at least one warning. A warning about the whole file counts every such row. */
  rowsWithWarnings: number;
};

/**
 * The import's counts. `rowsRead` = `rowsLeftOut` + `duplicatesGrouped` + `uniqueRecords`.
 *
 * Empty rows are counted from the gaps in the row numbers: the parser skips them, and every row
 * keeps its spreadsheet number, so the rows between the header and the last data row that aren't
 * in `rows` were empty. Blank rows after the last data row aren't counted.
 */
export function summarizeImport(state: ImportState): ImportSummary {
  const { rows } = state.parsed;
  const lastRow = rows.reduce((last, row) => Math.max(last, row.sourceRow), 1);
  const leftOut = new Set(state.validation.excluded.map((row) => row.sourceRow));

  const warnings = state.issues.filter((issue) => issue.severity === "warning");
  const rowsWithWarnings = warnings.some((issue) => issue.sourceRow === null)
    ? rows.length - leftOut.size
    : new Set(
        warnings.flatMap((issue) =>
          issue.sourceRow === null || leftOut.has(issue.sourceRow) ? [] : [issue.sourceRow],
        ),
      ).size;

  return {
    rowsRead: rows.length,
    skippedEmptyRows: lastRow - 1 - rows.length,
    duplicatesGrouped: state.duplicateCount,
    uniqueRecords: state.records.length,
    rowsLeftOut: state.validation.excluded.length,
    rowsWithWarnings,
  };
}
