/**
 * The single place text goes into a spreadsheet cell (TR-25). Every text value the export
 * writes, headers included, goes through `textCell()`, so TR-27 can add formula safety here
 * once and have it cover every sheet.
 *
 * Pure: no React, no I/O, no logging.
 */

/** The text to store in a cell. For now it returns `value` unchanged. */
export function textCell(value: string): string {
  return value;
}
