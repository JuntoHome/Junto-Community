/**
 * The download's name and type (TR-25). Kept apart from `workbook.ts`, so the Export step can
 * use them without loading ExcelJS.
 *
 * Pure: no React, no I/O, no logging. The date is passed in.
 */

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "JCA_Shortlist_Synthetic_Demo_2026-11-16.xlsx", from `date`'s local calendar date. The name
 * says the file is a synthetic demonstration (TR-28).
 */
export function shortlistFileName(date: Date): string {
  return `JCA_Shortlist_Synthetic_Demo_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.xlsx`;
}
