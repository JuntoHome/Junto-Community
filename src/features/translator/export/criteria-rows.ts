import { type BriefSection, DIMENSION_NAMES, describeLines } from "../criteria/describe";
import type { AllowedWorkbook } from "../import/allowlist";
import type { RankResult } from "../ranking";
import { type Counts, describeCounts } from "../ranking/counts";

/**
 * The Criteria sheet as plain data (TR-26): how the list was made, so it can be explained and
 * repeated later. Sections of `[label, value]` rows; `workbook.ts` turns them into the sheet, and
 * this file knows nothing about ExcelJS.
 *
 * Everything about the run comes from `rankResult`, the result the Shortlist sheet was made
 * from: the brief it was ranked with (never the form), the scoring version recorded at ranking
 * time, its weights and its overrides. The count lines are `describeCounts()`, the same lines as
 * the Results step (TR-23).
 *
 * Pure and deterministic: no React, no I/O, no logging. The time is passed in as `now`.
 */

/** The file the rows came from, as the Translator accepted it. */
export type ExportSource = {
  /** The uploaded file's name. */
  fileName: string;
  /** The layout detected from the headers: "Synthetic", "Reference Solutions". */
  layout: string;
  /** The sheet the rows were read from. */
  sheetName: string;
  /** The SHA-256 the file gate matched in the allowlist (TR-07). */
  sha256: AllowedWorkbook["sha256"];
};

/** One row: what it is, and the details. Either can be "". */
export type CriteriaRow = readonly [label: string, value: string];

/** A titled group of rows. The first section has no heading. */
export type CriteriaSection = { heading: string | null; rows: CriteriaRow[] };

// Every string the Criteria sheet shows. Plain language, no em-dashes.
export const CRITERIA_TEXT = {
  title: "JCA Data Axle Translator: how this list was made",
  synthetic: "Synthetic demonstration. All companies and people are fictional.",
  created: "Created",
  dateTime: "Date and time",
  source: "Source file",
  fileName: "File name",
  layout: "Layout",
  sheet: "Sheet",
  sha256: "SHA-256",
  criteria: "Criteria",
  scoring: "Scoring",
  scoringVersion: "Scoring version",
  weightsMode: "Weights mode",
  defaultWeights: "Default weights",
  orderedWeights: "Ordered by importance",
  weights: "Weights",
  noPreferences: "No preferences, so all scores are 0.",
  counts: "Counts",
  overrides: "Overrides",
  pinned: "Pinned",
  omitted: "Omitted",
  none: "None",
  /** "1 record", "2 records": how many omitted rows are listed below. */
  omittedCount: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "record" : "records"}`,
  /** "Synthetic Company 0001, score 100". */
  omittedRow: (company: string | null, score: number) => `${company ?? "No company name"}, score ${score}`,
  technical: "Technical",
  briefJson: "Brief (JSON)",
} as const;

/** What each part of the brief is called in the Item column. */
const SECTION_NAMES: Record<BriefSection, string> = {
  intent: "Goal",
  mustHaves: "Must-haves",
  preferences: "Preferences",
  exclusions: "Leave out",
  listSize: "List size",
  assumptions: "Assumptions",
};

const pad = (n: number) => String(Math.trunc(n)).padStart(2, "0");

/** "2026-11-16 11:24 (UTC+05:30)": `now` in local time, with the time zone's offset from UTC. */
export function localDateTime(now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  // getTimezoneOffset() is minutes behind UTC, so UTC+05:30 is -330.
  const offset = -now.getTimezoneOffset();
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `${date} ${time} (UTC${sign}${pad(abs / 60)}:${pad(abs % 60)})`;
}

/** "50", "35.7": a share as a percentage rounded to 1 decimal, without a trailing ".0". */
function percent(part: number, total: number): string {
  return String(Math.round((part / total) * 1000) / 10);
}

function scoringRows(rankResult: RankResult): CriteriaRow[] {
  const ordered = (rankResult.brief.priorityOrder ?? []).length > 0;
  const rows: CriteriaRow[] = [
    [CRITERIA_TEXT.scoringVersion, rankResult.scoringVersion],
    [CRITERIA_TEXT.weightsMode, ordered ? CRITERIA_TEXT.orderedWeights : CRITERIA_TEXT.defaultWeights],
  ];
  const total = rankResult.weights.reduce((sum, { weight }) => sum + weight, 0);
  if (total === 0) return [...rows, [CRITERIA_TEXT.weights, CRITERIA_TEXT.noPreferences]];
  // Heaviest first, so an ordered brief reads in its importance order. The sort is stable and
  // `weights` is in the fixed dimension order, so equal weights keep that order.
  const byWeight = [...rankResult.weights].sort((a, b) => b.weight - a.weight);
  return [
    ...rows,
    ...byWeight.map(({ dimension, weight }): CriteriaRow => [
      DIMENSION_NAMES[dimension],
      `${weight} (${percent(weight, total)}%)`,
    ]),
  ];
}

function overrideRows(rankResult: RankResult): CriteriaRow[] {
  const { pinned } = rankResult.overrides;
  const omitted = rankResult.omittedRows;
  const rows: CriteriaRow[] = [[CRITERIA_TEXT.pinned, pinned.length > 0 ? pinned.join(", ") : CRITERIA_TEXT.none]];
  if (omitted.length === 0) return [...rows, [CRITERIA_TEXT.omitted, CRITERIA_TEXT.none]];
  return [
    ...rows,
    [CRITERIA_TEXT.omitted, CRITERIA_TEXT.omittedCount(omitted.length)],
    ...omitted.map(({ record, displayScore }): CriteriaRow => {
      const { company, recordId } = record.normalized;
      return [recordId, CRITERIA_TEXT.omittedRow(company.known ? company.value : null, displayScore)];
    }),
  ];
}

/**
 * The Criteria sheet's sections for one ranking run, in order: title and synthetic note, Created,
 * Source file, Criteria, Scoring, Counts, Overrides, Technical.
 *
 * - `counts`: `buildCounts()` for the same `rankResult`.
 * - `source`: the file the rows came from.
 * - `now`: when the file is made, shown in local time with its offset.
 *
 * Criteria are the brief's summary lines (`describeLines()`, as on screen). Weights show each
 * active dimension's points and its share of the total. The brief is also written out as JSON,
 * so the run can be repeated exactly.
 */
export function criteriaTable({
  rankResult,
  counts,
  source,
  now,
}: {
  rankResult: RankResult;
  counts: Counts;
  source: ExportSource;
  now: Date;
}): CriteriaSection[] {
  return [
    {
      heading: null,
      rows: [
        [CRITERIA_TEXT.title, ""],
        [CRITERIA_TEXT.synthetic, ""],
      ],
    },
    { heading: CRITERIA_TEXT.created, rows: [[CRITERIA_TEXT.dateTime, localDateTime(now)]] },
    {
      heading: CRITERIA_TEXT.source,
      rows: [
        [CRITERIA_TEXT.fileName, source.fileName],
        [CRITERIA_TEXT.layout, source.layout],
        [CRITERIA_TEXT.sheet, source.sheetName],
        [CRITERIA_TEXT.sha256, source.sha256],
      ],
    },
    {
      heading: CRITERIA_TEXT.criteria,
      rows: describeLines(rankResult.brief).map((line): CriteriaRow => [SECTION_NAMES[line.section], line.text]),
    },
    { heading: CRITERIA_TEXT.scoring, rows: scoringRows(rankResult) },
    { heading: CRITERIA_TEXT.counts, rows: describeCounts(counts).map((line): CriteriaRow => ["", line.text]) },
    { heading: CRITERIA_TEXT.overrides, rows: overrideRows(rankResult) },
    { heading: CRITERIA_TEXT.technical, rows: [[CRITERIA_TEXT.briefJson, JSON.stringify(rankResult.brief)]] },
  ];
}
