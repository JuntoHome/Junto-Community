import type { GroupedRecord } from "../normalize/duplicates";
import { matchKey } from "../normalize/match-key";
import type { NormalizedRow } from "../normalize/normalize";
import { quote } from "../normalize/validate-rows";
import { compareRecordIds } from "./compare-ids";
import type { FilterStatus } from "./filter";
import { takeShortlist, type WithRank } from "./limit";
import { type RowReasons, withPinReason } from "./reasons";
import type { ScoredRecord } from "./score";

/**
 * Pin and omit (TR-21), the step between sorting and the cut: the user keeps a record in the
 * shortlist (pin) or takes one out (omit).
 *
 * Pure and deterministic: no React, no I/O, no logging. The overrides are two lists of Record
 * IDs, kept sorted, so the same choices always give the same value, and the same records, brief
 * and overrides always give the same shortlist. Record IDs are compared with `matchKey()`, as
 * in the row checks (TR-11), so " syn-0001 " and "SYN-0001" are the same record.
 */

/**
 * The user's overrides: the Record IDs they pinned and the ones they omitted, each list sorted
 * with `compareRecordIds()` and without repeats. An ID is never in both: pinning an omitted
 * record un-omits it, and omitting a pinned one unpins it. Change it only with `pin()`,
 * `unpin()`, `omit()` and `restore()`, which keep those rules.
 */
export type Overrides = { pinned: string[]; omitted: string[] };

export const NO_OVERRIDES: Overrides = { pinned: [], omitted: [] };

/** How the user changed a row. Only pins are marked: omitted rows aren't in the shortlist. */
export type Override = "pinned";

/** A row with its override, or null when the user didn't change it. */
export type WithOverride<T> = T & { override: Override | null };

/** `ids` without any ID that matches `id`, plus `id` when `add` is true, sorted. */
function withId(ids: readonly string[], id: string, add: boolean): string[] {
  const key = matchKey(id);
  const kept = ids.filter((other) => matchKey(other) !== key);
  return (add ? [...kept, id] : kept).sort(compareRecordIds);
}

/** Pins `recordId` and takes it off the omitted list. Check it with `checkPin()` first. */
export function pin(overrides: Overrides, recordId: string): Overrides {
  return { pinned: withId(overrides.pinned, recordId, true), omitted: withId(overrides.omitted, recordId, false) };
}

/** Unpins `recordId`. */
export function unpin(overrides: Overrides, recordId: string): Overrides {
  return { pinned: withId(overrides.pinned, recordId, false), omitted: overrides.omitted };
}

/** Omits `recordId` and unpins it. */
export function omit(overrides: Overrides, recordId: string): Overrides {
  return { pinned: withId(overrides.pinned, recordId, false), omitted: withId(overrides.omitted, recordId, true) };
}

/** Takes `recordId` off the omitted list, so it is ranked like any other row again. */
export function restore(overrides: Overrides, recordId: string): Overrides {
  return { pinned: overrides.pinned, omitted: withId(overrides.omitted, recordId, false) };
}

/** Whether `ids` has an ID that matches `recordId`. */
export function hasId(ids: readonly string[], recordId: string): boolean {
  const key = matchKey(recordId);
  return ids.some((id) => matchKey(id) === key);
}

/**
 * What `checkPin()` needs to know about the file and the brief.
 *
 * - `statusById`: every grouped record's filter status (TR-17), by Record ID.
 * - `duplicateOf`: each exact duplicate's Record ID, to the Record ID of the row it was folded
 *   into (TR-12).
 * - `leftOut`: the Record IDs of the rows the row checks left out (TR-11).
 */
export type PinContext = {
  statusById: ReadonlyMap<string, FilterStatus>;
  duplicateOf: ReadonlyMap<string, string>;
  leftOut: readonly string[];
};

/** Builds a `PinContext` from the grouped records, the rows TR-11 left out, and a ranking's `statusById`. */
export function pinContext(
  records: readonly GroupedRecord[],
  leftOutRows: readonly NormalizedRow[],
  statusById: ReadonlyMap<string, FilterStatus>,
): PinContext {
  const duplicateOf = new Map<string, string>();
  for (const record of records) {
    for (const id of record.duplicateIds) duplicateOf.set(id, record.normalized.recordId);
  }
  return { statusById, duplicateOf, leftOut: leftOutRows.map((row) => row.normalized.recordId) };
}

export const PIN_MESSAGES = {
  /** The box was empty. */
  blank: "Type a Record ID to pin.",
  notFound: (typed: string) => `No record with ID ${quote(typed)} in this file.`,
  leftOut: (id: string) => `${id} was left out when the file was checked, so it can't be pinned.`,
  duplicate: (id: string, keptId: string) => `${id} is a duplicate of ${keptId}. Pin ${keptId} instead.`,
  excluded: (id: string) => `${id} can't be pinned because it matches your Leave out rule.`,
  failedMustHave: (id: string) => `${id} can't be pinned because it doesn't meet your must-haves.`,
} as const;

export type PinCheck = { ok: true; recordId: string } | { ok: false; message: string };

/** The first entry of `map` whose Record ID matches `key`, or undefined. */
function findEntry<V>(map: ReadonlyMap<string, V>, key: string): [string, V] | undefined {
  for (const entry of map) if (matchKey(entry[0]) === key) return entry;
  return undefined;
}

/**
 * Whether the record with ID `typed` can be pinned. Only eligible records can. On success
 * `recordId` is the ID as the file has it, so " syn-0496 " gives "SYN-0496". Otherwise
 * `message` says why, checked in this order:
 *
 * 1. Nothing typed, or no row in the file has that ID.
 * 2. Only rows the row checks left out have it. A row is left out for repeating an earlier
 *    row's ID, and that earlier row is kept, so its ID resolves to the kept row instead.
 * 3. It is an exact duplicate folded into another row: pin that row instead.
 * 4. It matches a Leave out rule, or 5. it doesn't meet a must-have.
 *
 * An omitted record can be pinned; `pin()` un-omits it.
 */
export function checkPin(typed: string, context: PinContext): PinCheck {
  const key = matchKey(typed);
  if (key === "") return { ok: false, message: PIN_MESSAGES.blank };

  const found = findEntry(context.statusById, key);
  if (found === undefined) {
    const duplicate = findEntry(context.duplicateOf, key);
    if (duplicate !== undefined) return { ok: false, message: PIN_MESSAGES.duplicate(...duplicate) };
    const leftOutId = context.leftOut.find((id) => matchKey(id) === key);
    if (leftOutId !== undefined) return { ok: false, message: PIN_MESSAGES.leftOut(leftOutId) };
    return { ok: false, message: PIN_MESSAGES.notFound(typed) };
  }

  const [recordId, status] = found;
  if (status === "excluded") return { ok: false, message: PIN_MESSAGES.excluded(recordId) };
  if (status === "failed-must-have") return { ok: false, message: PIN_MESSAGES.failedMustHave(recordId) };
  return { ok: true, recordId };
}

/** A row the overrides step works on: a scored, sorted row with its reasons. */
type Rankable = ScoredRecord & RowReasons;

export type AppliedOverrides<T extends Rankable> = {
  /** Pinned rows, then the best of the rest, numbered `rank` 1 to N. */
  shortlist: WithRank<WithOverride<T>>[];
  /** Pinned Record IDs with no eligible row any more, for example after a brief change. Sorted. */
  droppedPins: string[];
  /** The omitted rows that are still eligible, in `ranked` order, with their score and reasons. */
  omittedRows: T[];
};

/**
 * Applies `overrides` to `ranked` (every eligible row, sorted) and cuts the list to `listSize`:
 *
 * 1. Omitted rows are taken out first, so the next row moves up and the list stays at
 *    `listSize`.
 * 2. The rest split into pinned rows and the others, each keeping `ranked` order (score, then
 *    Record ID), so the order never depends on when a row was pinned.
 * 3. The shortlist is every pinned row, then the best others until it has `listSize` rows. Pins
 *    take slots within the list size; when there are more pins than that, every pin is shown and
 *    nothing else.
 * 4. Ranks run 1 to N over the whole shortlist. Pinned rows get `override: "pinned"` and
 *    `Pinned by user` as their first reason; their score is unchanged.
 *
 * `ranked` is not changed.
 */
export function applyOverrides<T extends Rankable>(
  ranked: readonly T[],
  overrides: Overrides,
  listSize: number,
): AppliedOverrides<T> {
  const pinnedKeys = new Set(overrides.pinned.map(matchKey));
  const omittedKeys = new Set(overrides.omitted.map(matchKey));
  const keyOf = (row: T) => matchKey(row.record.normalized.recordId);

  const omittedRows: T[] = [];
  const pinned: WithOverride<T>[] = [];
  const others: WithOverride<T>[] = [];
  for (const row of ranked) {
    const key = keyOf(row);
    if (omittedKeys.has(key)) omittedRows.push(row);
    else if (pinnedKeys.has(key)) pinned.push({ ...row, ...withPinReason(row), override: "pinned" });
    else others.push({ ...row, override: null });
  }

  const eligibleKeys = new Set(ranked.map(keyOf));
  const droppedPins = overrides.pinned.filter((id) => !eligibleKeys.has(matchKey(id)));
  const shortlist = takeShortlist([...pinned, ...others], Math.max(listSize, pinned.length));
  return { shortlist, droppedPins, omittedRows };
}
