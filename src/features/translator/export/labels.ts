/**
 * The synthetic-demonstration labels every export carries (TR-28): the note on both sheets and
 * on the Export step, and the file's properties. Kept apart from `workbook.ts`, so the Export
 * step can show the note without loading ExcelJS.
 *
 * Pure: no React, no I/O, no logging. Plain language, no em-dashes.
 */

/** Row 1 of the Shortlist sheet, the Criteria sheet's note, and the line next to Download. */
export const SYNTHETIC_NOTE = "Synthetic demonstration. All companies and people are fictional.";

/** The file's Title property. */
export const WORKBOOK_TITLE = "JCA Data Axle Translator shortlist (synthetic demonstration)";

/** The file's Subject property. */
export const WORKBOOK_SUBJECT = "Synthetic demonstration";
