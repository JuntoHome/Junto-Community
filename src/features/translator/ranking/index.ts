import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";

/**
 * Ranking: turns the grouped records and a confirmed SearchBrief into the shortlist. Plain,
 * deterministic code with no AI: the same records and brief always give the same rows in the
 * same order.
 *
 * Pure: no React, no I/O, no logging.
 */

/** One shortlist row. TR-18 adds its score and TR-20 its reasons. */
export type RankedRow = { record: GroupedRecord };

/**
 * What a ranking run gives back. `brief` is the exact brief the rows were ranked against, so
 * whatever shows the results (the criteria summary, the export's Criteria sheet) describes
 * that brief and can never drift from it.
 */
export type RankResult = { brief: SearchBrief; rows: RankedRow[] };

/** Ranks `records` against `brief`. */
export function rank(records: readonly GroupedRecord[], brief: SearchBrief): RankResult {
  // TODO(TR-17, TR-18, TR-19): filter by exclusions and must-haves, score the preferences, then
  // sort and cut to brief.listSize. Until then no rows come back.
  return { brief, rows: [] };
}
