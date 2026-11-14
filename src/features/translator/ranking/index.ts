import { SCORING_VERSION, type SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { filterRecords, type FilterResult } from "./filter";
import { takeShortlist, type WithRank } from "./limit";
import { scoreRecords, type DimensionWeight, type ScoredRecord } from "./score";
import { sortScored } from "./sort";

/**
 * Ranking: turns the grouped records and a confirmed SearchBrief into the shortlist. Plain,
 * deterministic code with no AI: the same records and brief always give the same rows in the
 * same order.
 *
 * Steps: filter by exclusions and must-haves (TR-17, `filter.ts`), score the preferences (TR-18,
 * `score.ts`), sort by score then Record ID (TR-19, `sort.ts`) and cut to the list size (TR-19,
 * `limit.ts`). Every comparison goes through `matchCriterion()` (`match.ts`).
 *
 * Pure: no React, no I/O, no logging.
 */

/**
 * One eligible row: the record, its unrounded `score` (0 to 100), the rounded `displayScore`
 * and the per-dimension `breakdown`. TR-20 adds its reasons.
 */
export type RankedRow = ScoredRecord;

/** A row in the shortlist: a `RankedRow` with its `rank`, 1 for the first. */
export type ShortlistRow = WithRank<RankedRow>;

/** What filtering found: the totals, the rows each criterion removed and every record's status. */
export type FilterSummary = Omit<FilterResult, "eligible">;

/**
 * What a ranking run gives back. `brief` is the exact brief the rows were ranked against, so
 * whatever shows the results (the criteria summary, the export's Criteria sheet) describes
 * that brief and can never drift from it. `filter` explains which rows were removed and why
 * (counts summary TR-23, no-results helper TR-24, pin and omit TR-21). `weights` are the active
 * dimensions' weights and `scoringVersion` the rules that produced the scores (export, TR-25).
 *
 * - `ranked`: every eligible row, sorted. Pin and omit (TR-21) work on this full list before the
 *   cut, so an omitted row lets the next one move up into the shortlist.
 * - `shortlist`: the first `brief.listSize` rows of `ranked` (all of them when there are fewer),
 *   numbered 1 to N.
 */
export type RankResult = {
  brief: SearchBrief;
  scoringVersion: string;
  weights: DimensionWeight[];
  filter: FilterSummary;
  ranked: RankedRow[];
  shortlist: ShortlistRow[];
};

/** Ranks `records` against `brief`. */
export function rank(records: readonly GroupedRecord[], brief: SearchBrief): RankResult {
  const { eligible, counts, byCriterion, statusById } = filterRecords(records, brief);
  const { weights, rows } = scoreRecords(eligible, brief);
  const ranked = sortScored(rows);
  // TODO(TR-21): apply omit and pin to ranked before takeShortlist
  const shortlist = takeShortlist(ranked, brief.listSize);
  return {
    brief,
    scoringVersion: SCORING_VERSION,
    weights,
    filter: { counts, byCriterion, statusById },
    ranked,
    shortlist,
  };
}
