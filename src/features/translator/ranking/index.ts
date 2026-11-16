import { SCORING_VERSION, type SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { filterRecords, type FilterResult } from "./filter";
import type { WithRank } from "./limit";
import { applyOverrides, NO_OVERRIDES, type Overrides, unpin, type WithOverride } from "./overrides";
import { explain, type RowReasons } from "./reasons";
import { scoreRecords, type DimensionWeight, type ScoredRecord } from "./score";
import { sortScored } from "./sort";

/**
 * Ranking: turns the grouped records, a confirmed SearchBrief and the user's pins and omits into
 * the shortlist. Plain, deterministic code with no AI: the same records, brief and overrides
 * always give the same rows in the same order.
 *
 * Steps: filter by exclusions and must-haves (TR-17, `filter.ts`), score the preferences (TR-18,
 * `score.ts`), sort by score then Record ID (TR-19, `sort.ts`), explain each row (TR-20,
 * `reasons.ts`), then apply pins and omits and cut to the list size (TR-21, `overrides.ts`,
 * numbering with TR-19's `limit.ts`). Every comparison goes through `matchCriterion()`
 * (`match.ts`).
 *
 * Pure: no React, no I/O, no logging.
 */

/**
 * One eligible row: the record, its unrounded `score` (0 to 100), the rounded `displayScore`,
 * the per-dimension `breakdown`, and its `reasons` and `reasonText` (TR-20). The results table
 * (TR-22) and the export (TR-25) show the reasons as they are.
 */
export type RankedRow = ScoredRecord & RowReasons;

/**
 * A row in the shortlist: a `RankedRow` with its `rank`, 1 for the first, and its `override`:
 * `"pinned"` for a row the user pinned (whose first reason is then `Pinned by user`), otherwise
 * null.
 */
export type ShortlistRow = WithRank<WithOverride<RankedRow>>;

/** What filtering found: the totals, the rows each criterion removed and every record's status. */
export type FilterSummary = Omit<FilterResult, "eligible">;

/**
 * What a ranking run gives back. `brief` is the exact brief the rows were ranked against, so
 * whatever shows the results (the criteria summary, the export's Criteria sheet) describes
 * that brief and can never drift from it. `filter` explains which rows were removed and why
 * (counts summary TR-23, no-results helper TR-24, pin and omit TR-21). `weights` are the active
 * dimensions' weights and `scoringVersion` the rules that produced the scores (export, TR-25).
 *
 * - `ranked`: every eligible row, sorted, before pins and omits.
 * - `shortlist`: what the user sees (TR-21, `applyOverrides()`): omitted rows taken out, then
 *   every pinned row, then the best of the rest until there are `brief.listSize` rows (all of
 *   them when there are fewer), numbered 1 to N. Pins take slots within the list size; with
 *   more pins than that, only the pins are shown.
 * - `overrides`: the pins and omits the shortlist was made with: the ones given, minus
 *   `droppedPins`.
 * - `droppedPins`: pinned Record IDs that aren't eligible under this brief. Whoever holds the
 *   overrides removes them and tells the user.
 * - `omittedRows`: the omitted rows that are still eligible, with their score and reasons, for
 *   the "Omitted by you" list and the export (TR-25).
 *
 * So the export can show exactly what is on screen: `shortlist`, `omittedRows` and `overrides`.
 */
export type RankResult = {
  brief: SearchBrief;
  scoringVersion: string;
  weights: DimensionWeight[];
  filter: FilterSummary;
  ranked: RankedRow[];
  shortlist: ShortlistRow[];
  overrides: Overrides;
  droppedPins: string[];
  omittedRows: RankedRow[];
};

/** Ranks `records` against `brief`, with the user's pins and omits. */
export function rank(
  records: readonly GroupedRecord[],
  brief: SearchBrief,
  overrides: Overrides = NO_OVERRIDES,
): RankResult {
  const { eligible, counts, byCriterion, statusById } = filterRecords(records, brief);
  const { weights, rows } = scoreRecords(eligible, brief);
  // Every ranked row gets its reasons, not only the shortlist, because pins can come from anywhere in `ranked`.
  const ranked: RankedRow[] = sortScored(rows).map((row) => ({ ...row, ...explain(row, brief) }));
  const { shortlist, droppedPins, omittedRows } = applyOverrides(ranked, overrides, brief.listSize);
  return {
    brief,
    scoringVersion: SCORING_VERSION,
    weights,
    filter: { counts, byCriterion, statusById },
    ranked,
    shortlist,
    overrides: droppedPins.reduce(unpin, overrides),
    droppedPins,
    omittedRows,
  };
}
