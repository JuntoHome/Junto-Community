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

/**
 * How each brief field is named in a filter label: "Must-have City", "Leave out Company size".
 * The no-results helper (TR-24) uses the same names.
 */
export const FIELD_NAMES: Record<BriefField, string> = {
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
  /** The brief's list size, for the "not shown" line. */
  listSize: number;
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
    listSize: rankResult.brief.listSize,
  };
}

const formatCount = (n: number) => n.toLocaleString("en-US");

/** "1 row", "500 rows". */
const rows = (n: number) => `${formatCount(n)} ${n === 1 ? "row" : "rows"}`;

// Every count line's wording. Plain language, no em-dashes.
const TEXT = {
  rowsRead: (n: number) => `${rows(n)} read from your file`,
  skippedEmptyRows: (n: number) => `${formatCount(n)} empty ${n === 1 ? "row" : "rows"} skipped`,
  rowsLeftOut: (n: number) => `${rows(n)} left out because of problems in the file`,
  rowsWithWarnings: (n: number) => `${rows(n)} ${n === 1 ? "has" : "have"} warnings (still included)`,
  duplicatesGrouped: (n: number) => `${formatCount(n)} ${n === 1 ? "duplicate" : "duplicates"} grouped`,
  uniqueRecords: (n: number) => `${formatCount(n)} unique ${n === 1 ? "record" : "records"}`,
  excluded: (n: number) => `${formatCount(n)} removed by your Leave out rules`,
  failedMustHave: (n: number, onlyMissing: number) =>
    `${formatCount(n)} didn't meet your must-haves (${formatCount(onlyMissing)} only because a value was blank)`,
  eligible: (n: number) => `${formatCount(n)} ${n === 1 ? "matches" : "match"} your criteria`,
  omittedByUser: (n: number) => `${formatCount(n)} omitted by you`,
  notShown: (n: number, listSize: number) =>
    `${formatCount(n)} more ${n === 1 ? "match" : "matches"} not shown (list size ${formatCount(listSize)})`,
  exported: (n: number) => `${formatCount(n)} in your shortlist and export`,
} as const;

export type CountLineKey = keyof typeof TEXT;

/** One line of the counts summary: "500 rows read from your file". */
export type CountLine = { key: CountLineKey; text: string };

/**
 * The counts summary as lines, in the order the data flows, from the rows read to the rows in
 * the shortlist and export. Lines that are only sometimes relevant (empty rows, warnings,
 * omitted, not shown) are left out at 0. The Results step (TR-23) and the export's Criteria
 * sheet (TR-26) both show exactly these lines.
 */
export function describeCounts(counts: Counts): CountLine[] {
  const lines: (CountLine & { show: boolean })[] = [
    { key: "rowsRead", text: TEXT.rowsRead(counts.rowsRead), show: true },
    { key: "skippedEmptyRows", text: TEXT.skippedEmptyRows(counts.skippedEmptyRows), show: counts.skippedEmptyRows > 0 },
    { key: "rowsLeftOut", text: TEXT.rowsLeftOut(counts.rowsLeftOut), show: true },
    { key: "rowsWithWarnings", text: TEXT.rowsWithWarnings(counts.rowsWithWarnings), show: counts.rowsWithWarnings > 0 },
    { key: "duplicatesGrouped", text: TEXT.duplicatesGrouped(counts.duplicatesGrouped), show: true },
    { key: "uniqueRecords", text: TEXT.uniqueRecords(counts.uniqueRecords), show: true },
    { key: "excluded", text: TEXT.excluded(counts.excluded), show: true },
    { key: "failedMustHave", text: TEXT.failedMustHave(counts.failedMustHave, counts.failedOnlyMissing), show: true },
    { key: "eligible", text: TEXT.eligible(counts.eligible), show: true },
    { key: "omittedByUser", text: TEXT.omittedByUser(counts.omittedByUser), show: counts.omittedByUser > 0 },
    { key: "notShown", text: TEXT.notShown(counts.notShownListSize, counts.listSize), show: counts.notShownListSize > 0 },
    { key: "exported", text: TEXT.exported(counts.exported), show: true },
  ];
  return lines.filter((line) => line.show).map(({ key, text }) => ({ key, text }));
}

/**
 * One filter's line under "Why rows were filtered out": "Must-have City: 399 rows (0 with a
 * blank value)". A blank value never matches a Leave out rule, so exclusions have no blank count.
 */
export function describeCriterionCount(count: LabelledCriterionCount): string {
  return count.stage === "mustHaves"
    ? `${count.label}: ${rows(count.removed)} (${formatCount(count.removedMissing)} with a blank value)`
    : `${count.label}: ${rows(count.removed)}`;
}
