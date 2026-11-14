import { SCORING_VERSION, type SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { filterRecords, type FilterResult } from "./filter";
import { scoreRecords, type DimensionWeight, type ScoredRecord } from "./score";

/**
 * Ranking: turns the grouped records and a confirmed SearchBrief into the shortlist. Plain,
 * deterministic code with no AI: the same records and brief always give the same rows in the
 * same order.
 *
 * Steps: filter by exclusions and must-haves (TR-17, `filter.ts`), score the preferences (TR-18,
 * `score.ts`), then sort and cut to the list size (TR-19). Every comparison goes through
 * `matchCriterion()` (`match.ts`).
 *
 * Pure: no React, no I/O, no logging.
 */

/**
 * One shortlist row: the record, its unrounded `score` (0 to 100), the rounded `displayScore`
 * and the per-dimension `breakdown`. TR-20 adds its reasons.
 */
export type RankedRow = ScoredRecord;

/** What filtering found: the totals, the rows each criterion removed and every record's status. */
export type FilterSummary = Omit<FilterResult, "eligible">;

/**
 * What a ranking run gives back. `brief` is the exact brief the rows were ranked against, so
 * whatever shows the results (the criteria summary, the export's Criteria sheet) describes
 * that brief and can never drift from it. `filter` explains which rows were removed and why
 * (counts summary TR-23, no-results helper TR-24, pin and omit TR-21). `weights` are the active
 * dimensions' weights and `scoringVersion` the rules that produced the scores (export, TR-25).
 */
export type RankResult = {
  brief: SearchBrief;
  rows: RankedRow[];
  filter: FilterSummary;
  weights: DimensionWeight[];
  scoringVersion: string;
};

/** Ranks `records` against `brief`. */
export function rank(records: readonly GroupedRecord[], brief: SearchBrief): RankResult {
  const { eligible, counts, byCriterion, statusById } = filterRecords(records, brief);
  const { weights, rows } = scoreRecords(eligible, brief);
  // TODO(TR-19): sort by score descending, then Record ID ascending, and cut to brief.listSize.
  // Until then the rows are every eligible record, scored, in input order.
  return { brief, rows, filter: { counts, byCriterion, statusById }, weights, scoringVersion: SCORING_VERSION };
}
