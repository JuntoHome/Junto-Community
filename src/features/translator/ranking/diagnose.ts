import { type BriefItemId, criterionText, summaryItemFor } from "../criteria/describe";
import type { BriefCriterion, BriefField, SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { criterionLabel, FIELD_NAMES } from "./counts";
import type { RankResult } from "./index";
import { matchCriterion, prepareCriterion } from "./match";

/**
 * The no-results helper (TR-24): when the shortlist is empty, says why and points at the
 * filter to change, so the Results step can offer an Edit button for it.
 *
 * Every count is over `records`, the grouped records ranking used (499 for the sample), so the
 * numbers agree with the counts summary (TR-23). Hints only name values from the brief and
 * counts from the records: never a guess at a "similar" value.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/**
 * Why the shortlist is empty:
 *
 * - `"no-value"`: at least one must-have matches no record at all, on its own.
 * - `"combination"`: every must-have matches some records on its own, but no record matches
 *   all of them.
 * - `"excluded"`: some records meet every must-have, but Leave out rules removed all of them.
 * - `"all-omitted"`: records are eligible, but the user omitted every one.
 */
export type EmptyKind = "no-value" | "combination" | "excluded" | "all-omitted";

/**
 * One line of the explanation. `itemId` is the criteria summary item to change (null when no
 * single criterion is to blame). `removed` is how many records the hint's filter removes: for
 * a must-have, the records it fails on its own; for a Leave out rule, the records it removed
 * among those that met every must-have; for a blank data note, the records it is about; for
 * "all-omitted", the records omitted. 0 for the combination's opening line.
 */
export type EmptyHint = { text: string; itemId: BriefItemId | null; removed: number };

export type EmptyDiagnosis = { kind: EmptyKind; hints: EmptyHint[] };

/** At most this many hints name a filter. The combination's opening line and blank data notes come on top. */
export const MAX_FILTER_HINTS = 3;

const formatCount = (n: number) => n.toLocaleString("en-US");
const records = (n: number) => `${formatCount(n)} ${n === 1 ? "record" : "records"}`;

// Every hint's wording. Plain text, no em-dashes.
const TEXT = {
  noValue: {
    city: (values: string) => `No records are in ${values}. Try another city.`,
    state: (values: string) => `No records are in ${values}. Try another state.`,
    industry: (values: string) => `No records are in the ${values} industry. Try another industry.`,
    title: (values: string) => `No records have the title ${values}. Try another title.`,
    employees: (values: string) => `No records have ${values}. Try a wider range.`,
  } satisfies Record<BriefField, (values: string) => string>,
  combination: "Each must-have matches some records, but no record matches all of them.",
  /** "Must-have Title (Owner): 124 records on its own." */
  solo: (label: string, values: string, n: number) => `${label} (${values}): ${records(n)} on its own.`,
  /** "Your Leave out rule for Industry removed 20 records." */
  excluded: (field: BriefField, n: number) => `Your Leave out rule for ${FIELD_NAMES[field]} removed ${records(n)}.`,
  /** "25 records have a blank Title, so they can't meet that must-have." */
  blank: (field: BriefField, n: number) =>
    `${records(n)} ${n === 1 ? "has" : "have"} a blank ${FIELD_NAMES[field]}, so ${n === 1 ? "it" : "they"} can't meet that must-have.`,
  allOmitted: "You omitted every match. Restore some below.",
} as const;

/** A hint about one criterion, with its place in the brief to break ties. */
type Ranked = EmptyHint & { order: number };

/** The `MAX_FILTER_HINTS` that removed the most, ties in brief order. */
function top(hints: readonly Ranked[]): EmptyHint[] {
  return [...hints]
    .sort((a, b) => b.removed - a.removed || a.order - b.order)
    .slice(0, MAX_FILTER_HINTS)
    .map(({ text, itemId, removed }) => ({ text, itemId, removed }));
}

/**
 * One note per must-have field that some records fail only because the value is blank: records
 * that weren't excluded and whose every failed must-have was a blank (`failedOnlyMissing` in the
 * filter counts), counted under each field they are blank on. In brief order, one per field.
 */
function blankNotes(rows: readonly GroupedRecord[], brief: SearchBrief, rankResult: RankResult): EmptyHint[] {
  if (rankResult.filter.counts.failedOnlyMissing === 0) return [];
  const mustHaves = brief.mustHaves.map(prepareCriterion);
  const blanks = new Map<BriefField, number>(brief.mustHaves.map((criterion) => [criterion.field, 0]));
  for (const record of rows) {
    const row = record.normalized;
    if (rankResult.filter.statusById.get(row.recordId) !== "failed-must-have") continue;
    const results = mustHaves.map((criterion) => matchCriterion(row, criterion));
    if (results.includes("no-match")) continue;
    const fields = new Set(brief.mustHaves.filter((_, index) => results[index] === "unknown").map((c) => c.field));
    for (const field of fields) blanks.set(field, (blanks.get(field) ?? 0) + 1);
  }
  return [...blanks].flatMap(([field, n]) =>
    n === 0 ? [] : [{ text: TEXT.blank(field, n), itemId: summaryItemFor("mustHaves", field), removed: n }],
  );
}

/**
 * Explains an empty shortlist. `records` are the grouped records `rank()` got, `brief` the brief
 * it ranked against and `rankResult` its result. Call it only when `rankResult.shortlist` is
 * empty: with eligible records left, it reports `"all-omitted"`.
 *
 * The kind is decided in this order:
 *
 * 1. Eligible records, all omitted: `"all-omitted"`, with "You omitted every match. Restore
 *    some below."
 * 2. A must-have that matches 0 records on its own (`matchCriterion()` on every record):
 *    `"no-value"`, one hint per such must-have, for example "No records are in Flagstaff. Try
 *    another city."
 * 3. No record meets every must-have together: `"combination"`, "Each must-have matches some
 *    records, but no record matches all of them.", then one hint per must-have, fewest matches
 *    first: "Must-have Title (Owner): 124 records on its own."
 * 4. Otherwise Leave out rules removed every record that met the must-haves: `"excluded"`, one
 *    hint per rule that removed any of them: "Your Leave out rule for Industry removed 20
 *    records."
 *
 * At most `MAX_FILTER_HINTS` hints name a filter, the ones that removed the most first, ties in
 * brief order. When some records failed only because a must-have value was blank, a note per
 * field follows ("25 records have a blank Title, so they can't meet that must-have.").
 */
export function diagnoseEmpty(
  records: readonly GroupedRecord[],
  brief: SearchBrief,
  rankResult: RankResult,
): EmptyDiagnosis {
  const notes = blankNotes(records, brief, rankResult);

  if (rankResult.filter.counts.eligible > 0) {
    return {
      kind: "all-omitted",
      hints: [{ text: TEXT.allOmitted, itemId: null, removed: rankResult.omittedRows.length }, ...notes],
    };
  }

  // One pass: each must-have's matches on its own, and which records meet all of them.
  const mustHaves = brief.mustHaves.map(prepareCriterion);
  const exclusions = brief.exclusions.map(prepareCriterion);
  const solo = mustHaves.map(() => 0);
  const removedFromPassing = exclusions.map(() => 0);
  let passing = 0;
  for (const record of records) {
    const row = record.normalized;
    let meetsAll = true;
    mustHaves.forEach((criterion, index) => {
      if (matchCriterion(row, criterion) === "match") solo[index] += 1;
      else meetsAll = false;
    });
    if (!meetsAll) continue;
    passing += 1;
    exclusions.forEach((criterion, index) => {
      if (matchCriterion(row, criterion) === "match") removedFromPassing[index] += 1;
    });
  }

  const mustHave = (criterion: BriefCriterion, order: number, text: string): Ranked => ({
    text,
    itemId: summaryItemFor("mustHaves", criterion.field),
    removed: records.length - solo[order],
    order,
  });

  const unmatched = brief.mustHaves.flatMap((criterion, index) =>
    solo[index] === 0 ? [mustHave(criterion, index, TEXT.noValue[criterion.field](criterionText(criterion)))] : [],
  );
  if (unmatched.length > 0) return { kind: "no-value", hints: [...top(unmatched), ...notes] };

  if (passing === 0) {
    const each = brief.mustHaves.map((criterion, index) =>
      mustHave(
        criterion,
        index,
        TEXT.solo(criterionLabel({ stage: "mustHaves", field: criterion.field }), criterionText(criterion), solo[index]),
      ),
    );
    return {
      kind: "combination",
      hints: [{ text: TEXT.combination, itemId: null, removed: 0 }, ...top(each), ...notes],
    };
  }

  const rules = brief.exclusions.flatMap((criterion, index): Ranked[] =>
    removedFromPassing[index] === 0
      ? []
      : [
          {
            text: TEXT.excluded(criterion.field, removedFromPassing[index]),
            itemId: summaryItemFor("exclusions", criterion.field),
            removed: removedFromPassing[index],
            order: index,
          },
        ],
  );
  return { kind: "excluded", hints: [...top(rules), ...notes] };
}
