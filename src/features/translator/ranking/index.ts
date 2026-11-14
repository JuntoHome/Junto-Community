import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { filterRecords, type FilterResult } from "./filter";

/**
 * Ranking: turns the grouped records and a confirmed SearchBrief into the shortlist. Plain,
 * deterministic code with no AI: the same records and brief always give the same rows in the
 * same order.
 *
 * Steps: filter by exclusions and must-haves (TR-17, `filter.ts`), score the preferences (TR-18),
 * then sort and cut to the list size (TR-19). Every comparison goes through `matchCriterion()`
 * (`match.ts`).
 *
 * Pure: no React, no I/O, no logging.
 */

/** One shortlist row. TR-18 adds its score and TR-20 its reasons. */
export type RankedRow = { record: GroupedRecord };

/** What filtering found: the totals, the rows each criterion removed and every record's status. */
export type FilterSummary = Omit<FilterResult, "eligible">;

/**
 * What a ranking run gives back. `brief` is the exact brief the rows were ranked against, so
 * whatever shows the results (the criteria summary, the export's Criteria sheet) describes
 * that brief and can never drift from it. `filter` explains which rows were removed and why
 * (counts summary TR-23, no-results helper TR-24, pin and omit TR-21).
 */
export type RankResult = { brief: SearchBrief; rows: RankedRow[]; filter: FilterSummary };

/** Ranks `records` against `brief`. */
export function rank(records: readonly GroupedRecord[], brief: SearchBrief): RankResult {
  const { eligible, counts, byCriterion, statusById } = filterRecords(records, brief);
  // TODO(TR-18, TR-19): score the preferences, then sort and cut to brief.listSize. Until then
  // the rows are every eligible record, unscored, in input order.
  return { brief, rows: eligible.map((record) => ({ record })), filter: { counts, byCriterion, statusById } };
}
