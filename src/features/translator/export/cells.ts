import type ExcelJS from "exceljs";

/**
 * The only way text goes into an export cell (TR-25, made formula-safe in TR-27). Every text
 * value the export writes, headers included, goes through `setTextCell()`.
 *
 * Why this is enough to stop formula injection in an .xlsx file:
 *
 * - The value is always a plain string, so ExcelJS writes a string cell (`t="s"`). A string
 *   cell is never calculated, even when it starts with `=`, `+`, `-` or `@`. Formulas only come
 *   from a `{ formula }` value, which this function never writes.
 * - The cell gets Excel's Text format (`@`), so if someone later opens the cell in Excel and
 *   presses Enter, it stays text instead of turning into a formula.
 * - The value is kept exactly as it is: no leading `'`, space or tab. That old fix is for CSV
 *   files; in .xlsx it isn't needed and a visible `'` would change the data.
 *
 * `assertNoFormulas()` in `workbook.ts` checks the finished workbook before it is saved, as a
 * backstop in case a later change writes a formula some other way.
 *
 * Type-only import of ExcelJS, so the library is still loaded with `await import()` at runtime.
 * Pure apart from writing to `cell`: no React, no I/O, no logging.
 */

/** Excel's "Text" number format. */
export const TEXT_FORMAT = "@";

/** Writes `value` into `cell` as a literal text cell with the Text format. */
export function setTextCell(cell: ExcelJS.Cell, value: string): void {
  cell.value = value;
  cell.numFmt = TEXT_FORMAT;
}
