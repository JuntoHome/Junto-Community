import { compareRecordIds } from "./compare-ids";
import type { ScoredRecord } from "./score";

/**
 * Sorting (TR-19), the fourth ranking step: put the scored records in their final order.
 *
 * Pure and deterministic: no React, no I/O, no logging. The order depends only on each record's
 * score and Record ID, never on input order, so the same records and brief always give the same
 * order.
 */

/**
 * Returns a new array of `rows`, sorted by:
 *
 * 1. `score` descending, unrounded, so 85.71 comes before 85.69 even though both show as 86.
 *    Scores are equal only when they are exactly `===`. There is no tolerance: equal matches go
 *    through the same arithmetic with the same weights, so they give identical numbers, and a
 *    tolerance would make the order depend on a tuning value.
 * 2. Record ID ascending (`compareRecordIds()`), when scores are equal.
 *
 * Record IDs are unique (TR-11), so no two rows tie on both. `rows` is not changed.
 */
export function sortScored<T extends ScoredRecord>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.score !== b.score) return a.score > b.score ? -1 : 1;
    return compareRecordIds(a.record.normalized.recordId, b.record.normalized.recordId);
  });
}
