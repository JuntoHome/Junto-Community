import type { BriefCriterion } from "../criteria/schema";
import { matchKey } from "../normalize/match-key";
import type { CategoryField, Employees, NormalizedRecord } from "../normalize/types";

/**
 * Tests one record value against one criterion. This is the only place ranking compares a
 * record with a brief: the filter (TR-17) uses it for exclusions and must-haves, and the
 * scoring (TR-18) for preferences, so every stage compares values the same way.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/**
 * What one criterion makes of one record:
 *
 * - `"match"`: the record's value meets the criterion.
 * - `"no-match"`: the record has a value and it doesn't meet the criterion.
 * - `"unknown"`: the record has no value for the field (blank or invalid), so it can't be tested.
 *   Each stage decides what that means: it fails a must-have, isn't a match for an exclusion and
 *   scores 0 as a preference.
 */
export type MatchResult = "match" | "no-match" | "unknown";

/**
 * A criterion ready to test, made once per brief by `prepareCriterion()` so the brief's values
 * are turned into match keys once, not once per row.
 *
 * - `keys`: `equals` and `in` on a text field. The match keys of the criterion's values.
 * - `range`: `range` on employees. The inclusive user range.
 */
export type PreparedCriterion =
  | { kind: "keys"; field: CategoryField; keys: ReadonlySet<string> }
  | { kind: "range"; field: "employees"; min: number; max: number };

/** Turns a brief criterion into a `PreparedCriterion`, with its text values as match keys. */
export function prepareCriterion(criterion: BriefCriterion): PreparedCriterion {
  switch (criterion.operator) {
    case "equals":
      return { kind: "keys", field: criterion.field, keys: new Set([matchKey(criterion.value)]) };
    case "in":
      return { kind: "keys", field: criterion.field, keys: new Set(criterion.value.map(matchKey)) };
    case "range":
      return { kind: "range", field: criterion.field, min: criterion.value.min, max: criterion.value.max };
  }
}

/**
 * An employee count against an inclusive user range.
 *
 * - An actual count matches when `min <= count <= max`.
 * - A count read from a size range (`source: "range"`) matches only when the whole range fits
 *   inside the user range: `row.min >= min` and `row.max <= max`. So "10 to 19" matches 10 to 99,
 *   but "10 to 249" doesn't, because the business may have more than 99 people.
 * - An open size range such as "10,000+" (`max` is Infinity) never matches: a user range always
 *   has a whole-number max, so it can't hold an open range.
 */
function matchEmployees(employees: Employees, min: number, max: number): MatchResult {
  if (!employees.known) return "unknown";
  if (employees.source === "actual") return employees.count >= min && employees.count <= max ? "match" : "no-match";
  return employees.min >= min && employees.max <= max ? "match" : "no-match";
}

/**
 * Tests `record` against one prepared criterion.
 *
 * - `equals` and `in`: the record's match key is one of the criterion's keys. Both sides went
 *   through `matchKey()`, so " phoenix " and "Phoenix" are the same value.
 * - `range`: see `matchEmployees()`.
 * - A value the record doesn't have gives `"unknown"`.
 */
export function matchCriterion(record: NormalizedRecord, criterion: PreparedCriterion): MatchResult {
  if (criterion.kind === "range") return matchEmployees(record.employees, criterion.min, criterion.max);
  const value = record[criterion.field];
  if (!value.known) return "unknown";
  return criterion.keys.has(value.key) ? "match" : "no-match";
}
