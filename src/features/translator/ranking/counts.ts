import type { BriefField } from "../criteria/schema";
import type { ImportSummary } from "../normalize/summary";
import type { CriterionCount } from "./filter";
import type { RankResult } from "./index";

/**
 * The counts summary (TR-23): what happened to the rows from upload to shortlist, in the order
 * the data flows (read, clean, group, filter, override, cut), so each figure follows from the
 * one above it. The Results step shows it, and the export (TR-26) uses the same function, so the
 * screen and the Excel file always give the same numbers.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/** How each brief field is named in a filter label: "Must-have City", "Leave out Company size". */
const FIELD_NAMES: Record<BriefField, string> = {
  city: "City",
  state: "State",
  industry: "Industry",
  title: "Title",
  employees: "Company size",
};

const STAGE_NAMES: Record<CriterionCount["stage"], string> = {
  exclusions: "Leave out",
  mustHaves: "Must-have",
};

/** A `CriterionCount` (TR-17) with a plain label for the filter it counts. */
export type LabelledCriterionCount = CriterionCount & { label: string };

export type Counts = {
  /** Data rows read from the sheet, not counting empty rows. */
  rowsRead: number;
  /** Completely empty rows between the header and the last data row. */
  skippedEmptyRows: number;
  /** Rows the row checks left out because of problems in the file (TR-11). */
  rowsLeftOut: number;
  /** Rows kept despite a warning. Warnings don't reduce any other count. */
  rowsWithWarnings: number;
  /** Rows folded into an earlier row as exact duplicates (TR-12). */
  duplicatesGrouped: number;
  /** One per business: the records ranking uses. */
  uniqueRecords: number;
  /** Removed by a Leave out rule. */
  excluded: number;
  /** Not excluded, but failed at least one must-have. */
  failedMustHave: number;
  /** Of `failedMustHave`, the rows that failed only because a value was blank. */
  failedOnlyMissing: number;
  /** Passed every filter. */
  eligible: number;
  /** Eligible rows the user omitted. */
  omittedByUser: number;
  /** Rows the user pinned that are in the shortlist. */
  pinned: number;
  /** Eligible rows not omitted that the list size left out. */
  notShownListSize: number;
  /** Rows in the shortlist: exactly what the Excel file will contain. */
  exported: number;
  /** One entry per exclusion, then per must-have, in brief order, each with its label. */
  byCriterion: LabelledCriterionCount[];
};

/** "Must-have City", "Leave out Industry". */
export function criterionLabel(count: Pick<CriterionCount, "stage" | "field">): string {
  return `${STAGE_NAMES[count.stage]} ${FIELD_NAMES[count.field]}`;
}

/** Thrown when the counts don't add up, so a bug shows up instead of wrong numbers. */
function check(holds: boolean, message: string) {
  if (!holds) throw new Error(`The counts summary doesn't add up: ${message}`);
}

/**
 * The counts for one import and one ranking run. `importSummary` is `summarizeImport()` for the
 * loaded workbook and `rankResult` the current `rank()` result, so the numbers change with every
 * brief or override change.
 *
 * - `exported` is the shortlist length, after pins and omits.
 * - `notShownListSize` is `eligible - omittedByUser - exported`, never below 0.
 *
 * Throws when any of these fails:
 *
 * - `rowsRead = rowsLeftOut + duplicatesGrouped + uniqueRecords`
 * - `uniqueRecords = excluded + failedMustHave + eligible`
 * - `exported <= eligible - omittedByUser`, or `exported = pinned` when there are more pins than
 *   the list size
 */
export function buildCounts(importSummary: ImportSummary, rankResult: RankResult): Counts {
  const { rowsRead, skippedEmptyRows, rowsLeftOut, rowsWithWarnings, duplicatesGrouped, uniqueRecords } = importSummary;
  const { excluded, failedMustHave, failedOnlyMissing, eligible } = rankResult.filter.counts;
  const omittedByUser = rankResult.omittedRows.length;
  const pinned = rankResult.shortlist.filter((row) => row.override === "pinned").length;
  const exported = rankResult.shortlist.length;

  check(
    rowsRead === rowsLeftOut + duplicatesGrouped + uniqueRecords,
    `${rowsRead} rows read, but ${rowsLeftOut} left out + ${duplicatesGrouped} duplicates + ${uniqueRecords} unique records = ${rowsLeftOut + duplicatesGrouped + uniqueRecords}.`,
  );
  check(
    uniqueRecords === excluded + failedMustHave + eligible,
    `${uniqueRecords} unique records, but ${excluded} excluded + ${failedMustHave} failed must-haves + ${eligible} eligible = ${excluded + failedMustHave + eligible}.`,
  );
  check(
    exported <= eligible - omittedByUser || exported === pinned,
    `${exported} in the shortlist, more than ${eligible} eligible - ${omittedByUser} omitted, and not just the ${pinned} pins.`,
  );

  return {
    rowsRead,
    skippedEmptyRows,
    rowsLeftOut,
    rowsWithWarnings,
    duplicatesGrouped,
    uniqueRecords,
    excluded,
    failedMustHave,
    failedOnlyMissing,
    eligible,
    omittedByUser,
    pinned,
    notShownListSize: Math.max(0, eligible - omittedByUser - exported),
    exported,
    byCriterion: rankResult.filter.byCriterion.map((count) => ({ ...count, label: criterionLabel(count) })),
  };
}
