import type { BriefDimension, BriefField, SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import type { NormalizedRecord } from "../normalize/types";
import { matchCriterion, prepareCriterion, type MatchResult, type PreparedCriterion } from "./match";
import { DEFAULT_WEIGHTS, DIMENSIONS, FIELD_TO_DIMENSION, ORDERED_WEIGHTS } from "./weights";

/**
 * Scoring (TR-18), the third ranking step: give each eligible record a score from 0 to 100 for how
 * well it matches the brief's preferences.
 *
 * - Each active dimension (one with at least one preference) earns its full weight on a match and
 *   0 otherwise, including when the record has no value for it.
 * - score = earned total / active weight total * 100, kept unrounded so sorting (TR-19) and the
 *   export (TR-25) are exact. `displayScore` is the rounded figure for the screen.
 * - No preferences: every record scores 0 with an empty breakdown.
 *
 * Pure and deterministic: no React, no I/O, no logging, no randomness. Everything runs in the
 * fixed `DIMENSIONS` order with plain arithmetic, so the same records and brief always give the
 * same scores, to the last bit.
 */

/** One dimension's weight for a brief. */
export type DimensionWeight = { dimension: BriefDimension; weight: number };

/** What one preference made of a record. `index` is its position in `brief.preferences`. */
export type CriterionResult = { index: number; field: BriefField; result: MatchResult };

/**
 * How a record did on one active dimension. TR-20 builds the reasons from this.
 *
 * - `result`: `"match"` earns the weight. `"unknown"` means the record had no value to test, so
 *   it might have matched; it still earns 0. `"no-match"` is a real mismatch.
 * - `criteria`: every preference in the dimension, in brief order.
 */
export type DimensionScore = {
  dimension: BriefDimension;
  weight: number;
  earned: number;
  result: MatchResult;
  criteria: CriterionResult[];
};

/** A record's score. `score` is unrounded (0 to 100); `displayScore` is `Math.round(score)`. */
export type RecordScore = { score: number; displayScore: number; breakdown: DimensionScore[] };

/** An eligible record with its score. */
export type ScoredRecord = { record: GroupedRecord } & RecordScore;

/** The brief's preferences, made ready once per brief, grouped by dimension in `DIMENSIONS` order. */
type PreparedDimension = {
  dimension: BriefDimension;
  criteria: { index: number; field: BriefField; prepared: PreparedCriterion }[];
};

function prepareDimensions(brief: SearchBrief): PreparedDimension[] {
  return DIMENSIONS.map((dimension) => ({
    dimension,
    criteria: brief.preferences.flatMap((criterion, index) =>
      FIELD_TO_DIMENSION[criterion.field] === dimension
        ? [{ index, field: criterion.field, prepared: prepareCriterion(criterion) }]
        : [],
    ),
  })).filter((group) => group.criteria.length > 0);
}

/** The dimensions with at least one preference, in `DIMENSIONS` order. */
export function activeDimensions(brief: SearchBrief): BriefDimension[] {
  const preferred = new Set(brief.preferences.map((criterion) => FIELD_TO_DIMENSION[criterion.field]));
  return DIMENSIONS.filter((dimension) => preferred.has(dimension));
}

/**
 * The weight of each active dimension, in `DIMENSIONS` order.
 *
 * - No `priorityOrder` (or an empty one): `DEFAULT_WEIGHTS`.
 * - With `priorityOrder`: its dimensions first, in its order (a repeat counts at its first place),
 *   then any active dimension it leaves out, in `DIMENSIONS` order. These get 4, 3, 2, 1 by
 *   position. The form always lists every active preference; the Phase 2 AI may not, and an
 *   unlisted preference still counts, just less than every listed one.
 *
 * `priorityOrder` holds dimensions, not fields (the schema rejects "city" and "state"), so city
 * and state preferences share the one geography weight either way. A listed dimension with no
 * preference is skipped (the schema rejects it too).
 */
export function weightsFor(brief: SearchBrief): DimensionWeight[] {
  const active = activeDimensions(brief);
  const listed = brief.priorityOrder ?? [];
  if (listed.length === 0) {
    return active.map((dimension) => ({ dimension, weight: DEFAULT_WEIGHTS[dimension] }));
  }
  // A Set keeps first appearances in insertion order: listed dimensions, then the unlisted ones.
  const order = [...new Set([...listed.filter((dimension) => active.includes(dimension)), ...active])];
  const weightOf = new Map(order.map((dimension, position) => [dimension, ORDERED_WEIGHTS[position]]));
  return active.map((dimension) => ({ dimension, weight: weightOf.get(dimension) ?? 0 }));
}

/** Several criteria on one field: a match if any matches, else unknown if any was, else no match. */
function anyOf(results: readonly MatchResult[]): MatchResult {
  if (results.includes("match")) return "match";
  return results.includes("unknown") ? "unknown" : "no-match";
}

/**
 * Fields of one dimension, each already combined with `anyOf()`: a match only if every field
 * matches. Any real mismatch makes it a no match; otherwise a missing value makes it unknown.
 *
 * Only geography has two fields. With city Phoenix and state AZ preferred, Mesa, AZ is a no match,
 * because a Phoenix, AZ preference means that city in that state, not either one.
 */
function allOf(results: readonly MatchResult[]): MatchResult {
  if (results.every((result) => result === "match")) return "match";
  return results.includes("no-match") ? "no-match" : "unknown";
}

/** Tests `record` against every preference in one dimension, in brief order. */
function testCriteria(record: NormalizedRecord, group: PreparedDimension): CriterionResult[] {
  return group.criteria.map(({ index, field, prepared }) => ({ index, field, result: matchCriterion(record, prepared) }));
}

/** A dimension's result: `anyOf()` within each field, then `allOf()` across its fields. */
function dimensionResult(criteria: readonly CriterionResult[]): MatchResult {
  const fields = [...new Set(criteria.map((criterion) => criterion.field))];
  return allOf(
    fields.map((field) =>
      anyOf(criteria.filter((criterion) => criterion.field === field).map((criterion) => criterion.result)),
    ),
  );
}

function scorePrepared(
  record: NormalizedRecord,
  groups: readonly PreparedDimension[],
  weights: readonly DimensionWeight[],
): RecordScore {
  const weightOf = new Map(weights.map(({ dimension, weight }) => [dimension, weight]));
  let earnedTotal = 0;
  let weightTotal = 0;
  const breakdown: DimensionScore[] = [];
  for (const group of groups) {
    const weight = weightOf.get(group.dimension) ?? 0;
    const criteria = testCriteria(record, group);
    const result = dimensionResult(criteria);
    const earned = result === "match" ? weight : 0;
    earnedTotal += earned;
    weightTotal += weight;
    breakdown.push({ dimension: group.dimension, weight, earned, result, criteria });
  }
  // Weights are whole numbers, so both totals are exact; the one division happens here.
  const score = weightTotal === 0 ? 0 : (earnedTotal / weightTotal) * 100;
  return { score, displayScore: Math.round(score), breakdown };
}

/**
 * Scores one record against the brief's preferences with the given weights (from `weightsFor()`).
 * `breakdown` has one entry per active dimension, in `DIMENSIONS` order.
 */
export function scoreRecord(record: NormalizedRecord, brief: SearchBrief, weights: readonly DimensionWeight[]): RecordScore {
  return scorePrepared(record, prepareDimensions(brief), weights);
}

/**
 * Scores every eligible record, keeping input order (sorting is TR-19). The weights and the
 * prepared preferences are worked out once for the whole list.
 */
export function scoreRecords(
  eligible: readonly GroupedRecord[],
  brief: SearchBrief,
): { weights: DimensionWeight[]; rows: ScoredRecord[] } {
  const weights = weightsFor(brief);
  const groups = prepareDimensions(brief);
  const rows = eligible.map((record) => ({ record, ...scorePrepared(record.normalized, groups, weights) }));
  return { weights, rows };
}
