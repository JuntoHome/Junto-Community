/**
 * Capability: why the list moved after a change (TR-47). After a chat revision is confirmed
 * (TR-46), the Results chat shows these sentences as one note.
 * Input: the full `rank()` results before and after the change, and the change itself from
 * `diffBriefs()`.
 * Output: one to three plain sentences. Never AI-written: the record's own `reasons` (TR-20) are
 * quoted as they are, so the wording matches the table and the export.
 * Privacy: reads only the two results and the changes. Nothing is sent, stored or logged.
 * This module is pure (no React, no I/O).
 */
import { FIELD_DIMENSION, type BriefDimension } from "../criteria/schema";
import type { RankResult, ShortlistRow } from "../ranking";
import { hasId } from "../ranking/overrides";
import { REASON_SEPARATOR, type Reason } from "../ranking/reasons";
import type { BriefChange } from "./diff-brief";

// The explanation's sentences. Plain language, no em-dashes.
export const EXPLAIN_TEXT = {
  /** "Synthetic Company 0006 (SYN-0006) is now #1 with score 100: Title: Operations Manager (preferred)." */
  nowAt: (name: string, rank: number, score: number, reasons: string) =>
    `${name} is now #${rank} with score ${score}${reasons === "" ? "" : `: ${reasons}`}.`,
  /** Added after the new top record's sentence when other rows have exactly its score. */
  tied: (others: number, score: number) =>
    ` It's tied with ${others} ${others === 1 ? "other" : "others"} at ${score}; ties are ordered by Record ID.`,
  /** The old top record still matches, but its place is past the list size. */
  outside: (name: string, rank: number, listSize: number) => `${name} is now #${rank}, outside your list of ${listSize}.`,
  noLongerMatches: (name: string) => `${name} no longer matches your criteria.`,
  /** "The top record is the same. 12 records changed position." */
  sameTop: (moved: number) =>
    `The top record is the same. ${moved === 0 ? "No records" : moved === 1 ? "1 record" : `${moved} records`} changed position.`,
  /** Added after the same-top sentence when rows entered the list. */
  entered: (count: number) => ` ${count} ${count === 1 ? "is" : "are"} new in the list.`,
  listShows: (count: number) => `Your list now shows ${count} ${count === 1 ? "record" : "records"}.`,
  noMatches: "No records match now.",
  pinned: "Pinned rows stay at the top.",
} as const;

export type ExplainInput = {
  before: RankResult;
  after: RankResult;
  changes: readonly BriefChange[];
};

const idOf = (row: ShortlistRow) => row.record.normalized.recordId;

/** "Synthetic Company 0006 (SYN-0006)", or just "SYN-0006" when the record has no company name. */
function nameOf(row: Pick<ShortlistRow, "record">): string {
  const { company, recordId } = row.record.normalized;
  return company.known ? `${company.value} (${recordId})` : recordId;
}

/** The first row the user didn't pin: pinned rows stay on top by design (TR-21), so they never "move to #1". */
const firstUnpinned = (result: RankResult) => result.shortlist.find((row) => row.override !== "pinned");

/** The dimensions the changes are about. The goal, list size and importance order have none. */
function changedDimensions(changes: readonly BriefChange[]): Set<BriefDimension> {
  return new Set(changes.flatMap((change) => (change.field === null ? [] : [FIELD_DIMENSION[change.field]])));
}

/** The row's own reason texts on the changed dimensions, joined as in `reasonText`. "" when none relate to the change. */
function relatedReasons(reasons: readonly Reason[], dimensions: ReadonlySet<BriefDimension>): string {
  return reasons
    .filter((reason) => reason.dimension !== null && dimensions.has(reason.dimension))
    .map((reason) => reason.text)
    .join(REASON_SEPARATOR);
}

/**
 * The record's place in `result` as if the list had no size limit: eligible pinned rows first,
 * then the others in `ranked` order, omitted rows left out. The same numbering as the shortlist,
 * so a row in the list gets its `rank`.
 */
function placeOf(result: RankResult, recordId: string): number | null {
  const { pinned, omitted } = result.overrides;
  const order = [
    ...result.ranked.filter((row) => hasId(pinned, row.record.normalized.recordId)),
    ...result.ranked.filter((row) => !hasId(pinned, row.record.normalized.recordId) && !hasId(omitted, row.record.normalized.recordId)),
  ];
  const index = order.findIndex((row) => row.record.normalized.recordId === recordId);
  return index === -1 ? null : index + 1;
}

/** How many other unpinned, not omitted rows have exactly `top`'s score. `sortScored()` orders them by Record ID. */
function tiedWith(result: RankResult, top: ShortlistRow): number {
  const { pinned, omitted } = result.overrides;
  return result.ranked.filter((row) => {
    const id = row.record.normalized.recordId;
    return row.score === top.score && id !== idOf(top) && !hasId(pinned, id) && !hasId(omitted, id);
  }).length;
}

/** The sentence about the old top record, wherever it is now. */
function oldTopSentence(after: RankResult, oldTop: ShortlistRow, dimensions: ReadonlySet<BriefDimension>): string {
  const id = idOf(oldTop);
  const name = nameOf(oldTop);
  const inList = after.shortlist.find((row) => idOf(row) === id);
  if (inList) return EXPLAIN_TEXT.nowAt(name, inList.rank, inList.displayScore, relatedReasons(inList.reasons, dimensions));
  const place = after.filter.statusById.get(id) === "eligible" ? placeOf(after, id) : null;
  if (place !== null) return EXPLAIN_TEXT.outside(name, place, after.brief.listSize);
  return EXPLAIN_TEXT.noLongerMatches(name);
}

/** The same-top sentence: how many rows in both lists changed rank, and how many entered. */
function sameTopSentence(before: RankResult, after: RankResult): string {
  const rankBefore = new Map(before.shortlist.map((row) => [idOf(row), row.rank]));
  let moved = 0;
  let entered = 0;
  for (const row of after.shortlist) {
    const old = rankBefore.get(idOf(row));
    if (old === undefined) entered += 1;
    else if (old !== row.rank) moved += 1;
  }
  return EXPLAIN_TEXT.sameTop(moved) + (entered > 0 ? EXPLAIN_TEXT.entered(entered) : "");
}

/**
 * Explains how the list moved from `before` to `after`, in one to three sentences:
 *
 * - No rows now: `No records match now.` only (the no-results help shows the details).
 * - The same first unpinned record: the list size line when the list size changed, then the
 *   same-top line with how many rows changed position and how many are new.
 * - A new first unpinned record: it is #1 with its score and its reasons on the changed fields
 *   (and the tie rule when others have its exact score), then where the old one went: its new
 *   place and reasons, outside the list, or no longer matching.
 * - `Pinned rows stay at the top.` last when either list has pins.
 *
 * Reasons are the rows' own `reasons`, quoted, never reworded. Deterministic: the same inputs
 * always give the same text.
 */
export function explainChange({ before, after, changes }: ExplainInput): string[] {
  if (after.shortlist.length === 0) return [EXPLAIN_TEXT.noMatches];

  const dimensions = changedDimensions(changes);
  const oldTop = firstUnpinned(before);
  const newTop = firstUnpinned(after);
  const lines: string[] = [];

  if (oldTop && newTop && idOf(oldTop) === idOf(newTop)) {
    if (changes.some((change) => change.part === "listSize")) lines.push(EXPLAIN_TEXT.listShows(after.shortlist.length));
    lines.push(sameTopSentence(before, after));
  } else {
    if (newTop) {
      const ties = tiedWith(after, newTop);
      lines.push(
        EXPLAIN_TEXT.nowAt(nameOf(newTop), newTop.rank, newTop.displayScore, relatedReasons(newTop.reasons, dimensions)) +
          (ties > 0 ? EXPLAIN_TEXT.tied(ties, newTop.displayScore) : ""),
      );
    }
    if (oldTop) lines.push(oldTopSentence(after, oldTop, dimensions));
  }

  const hasPins = (result: RankResult) => result.shortlist.some((row) => row.override === "pinned");
  if (hasPins(before) || hasPins(after)) lines.push(EXPLAIN_TEXT.pinned);
  return lines;
}
