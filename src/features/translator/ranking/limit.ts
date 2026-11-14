/**
 * The list size (TR-19), the cut after sorting: keep the top rows and number them.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/** A row with its place in the shortlist, 1 for the first. */
export type WithRank<T> = T & { rank: number };

/**
 * Returns the first `listSize` rows of `sorted`, or all of them when there are fewer, each with
 * `rank` 1, 2, 3 and so on in order. Rows with the same score still get different ranks, in the
 * order `sortScored()` put them. `sorted` is not changed.
 */
export function takeShortlist<T extends object>(sorted: readonly T[], listSize: number): WithRank<T>[] {
  return sorted.slice(0, listSize).map((row, index) => ({ ...row, rank: index + 1 }));
}
