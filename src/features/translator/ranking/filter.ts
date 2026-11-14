import type { BriefField, SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { matchCriterion, prepareCriterion, type PreparedCriterion } from "./match";

/**
 * Filtering (TR-17), the first two ranking steps: remove rows that match an exclusion, then rows
 * that don't meet every must-have, and count why rows were removed.
 *
 * Pure and deterministic: no React, no I/O, no logging. The same records and brief always give
 * the same result, with rows in input order.
 */

/** Where a record ended up. Excluded rows can't be pinned (TR-21). */
export type FilterStatus = "eligible" | "excluded" | "failed-must-have";

/** The brief list a criterion comes from, so `brief[stage][index]` is that criterion. */
export type FilterStage = "exclusions" | "mustHaves";

/**
 * How many rows one exclusion or must-have removed. A row counts under every criterion it
 * failed, so these can add up to more than the stage's total.
 *
 * - Exclusion: `removed` is the rows it matched. `removedMissing` is always 0, because a
 *   missing value never matches an exclusion.
 * - Must-have: `removed` is the rows (not excluded) whose value didn't meet it, including
 *   missing values; `removedMissing` is how many of those had no value.
 */
export type CriterionCount = {
  stage: FilterStage;
  index: number;
  field: BriefField;
  removed: number;
  removedMissing: number;
};

/**
 * The totals. Every record is in exactly one of excluded, failedMustHave and eligible, so
 * `input = excluded + failedMustHave + eligible`.
 */
export type FilterCounts = {
  /** Records given to the filter (after duplicate grouping, so 499 for the sample). */
  input: number;
  /** Matched at least one exclusion. These were never checked against the must-haves. */
  excluded: number;
  /** Not excluded, but failed at least one must-have, through a mismatch or a missing value. */
  failedMustHave: number;
  /**
   * Of `failedMustHave`, the rows whose every failed must-have was a missing value, with no real
   * mismatch: the rows that might qualify if the data were complete. A row outside the required
   * city with a blank title fails on city anyway, so it isn't counted here.
   */
  failedOnlyMissing: number;
  /** Passed: no exclusion matched and every must-have matched. */
  eligible: number;
};

export type FilterResult = {
  /** Records that passed, in input order. */
  eligible: GroupedRecord[];
  /** Every input record's status, by Record ID, in input order. */
  statusById: Map<string, FilterStatus>;
  counts: FilterCounts;
  /** One entry per exclusion, then one per must-have, each in brief order. */
  byCriterion: CriterionCount[];
};

type Stage = { stage: FilterStage; prepared: PreparedCriterion[]; counts: CriterionCount[] };

function prepareStage(stage: FilterStage, brief: SearchBrief): Stage {
  const criteria = brief[stage];
  return {
    stage,
    prepared: criteria.map(prepareCriterion),
    counts: criteria.map((criterion, index) => ({
      stage,
      index,
      field: criterion.field,
      removed: 0,
      removedMissing: 0,
    })),
  };
}

/**
 * Splits `records` by `brief`:
 *
 * 1. Exclusions: a record is excluded when any exclusion gives `"match"`. `"no-match"` and
 *    `"unknown"` don't exclude, so a blank value is never left out.
 * 2. Must-haves, only for records not excluded: a record fails when any must-have gives
 *    `"no-match"` or `"unknown"`, so a missing value fails.
 *
 * Every criterion of a stage is tested, so `byCriterion` counts each one a record failed.
 * A brief with no exclusions and no must-haves keeps every record.
 */
export function filterRecords(records: readonly GroupedRecord[], brief: SearchBrief): FilterResult {
  const exclusions = prepareStage("exclusions", brief);
  const mustHaves = prepareStage("mustHaves", brief);

  const eligible: GroupedRecord[] = [];
  const statusById = new Map<string, FilterStatus>();
  const counts: FilterCounts = { input: records.length, excluded: 0, failedMustHave: 0, failedOnlyMissing: 0, eligible: 0 };

  for (const record of records) {
    const row = record.normalized;

    let excluded = false;
    for (let index = 0; index < exclusions.prepared.length; index += 1) {
      if (matchCriterion(row, exclusions.prepared[index]) === "match") {
        excluded = true;
        exclusions.counts[index].removed += 1;
      }
    }
    if (excluded) {
      counts.excluded += 1;
      statusById.set(row.recordId, "excluded");
      continue;
    }

    let mismatched = false;
    let missing = false;
    for (let index = 0; index < mustHaves.prepared.length; index += 1) {
      const result = matchCriterion(row, mustHaves.prepared[index]);
      if (result === "match") continue;
      mustHaves.counts[index].removed += 1;
      if (result === "unknown") {
        missing = true;
        mustHaves.counts[index].removedMissing += 1;
      } else {
        mismatched = true;
      }
    }
    if (mismatched || missing) {
      counts.failedMustHave += 1;
      if (!mismatched) counts.failedOnlyMissing += 1;
      statusById.set(row.recordId, "failed-must-have");
      continue;
    }

    counts.eligible += 1;
    statusById.set(row.recordId, "eligible");
    eligible.push(record);
  }

  return { eligible, statusById, counts, byCriterion: [...exclusions.counts, ...mustHaves.counts] };
}
