import { DIMENSION_NAMES } from "../criteria/describe";
import { BRIEF_FIELDS, FIELD_DIMENSION, type BriefDimension, type BriefField, type SearchBrief } from "../criteria/schema";
import { FIELD_LABELS } from "../import/fields";
import type { NormalizedRecord } from "../normalize/types";
import type { MatchResult } from "./match";
import type { DimensionScore, ScoredRecord } from "./score";

/**
 * Match reasons (TR-20): why each result is in the list, in plain words built from the record's
 * own values. The reasons are made once, here, and the results table (TR-22) and the export
 * (TR-25) show `reasons` and `reasonText` as they are. Never rebuild this text anywhere else.
 *
 * Pure and deterministic: no React, no I/O, no logging. Every match decision comes from the
 * row's scoring `breakdown` (TR-18) or from it having passed the must-haves (TR-17); nothing is
 * compared again here.
 */

/**
 * What a reason says about the row.
 *
 * - `required`: a must-have it met.
 * - `preferred`: a preference it matched.
 * - `not-preferred`: a preference its value didn't match.
 * - `unknown`: a preference it had no value for.
 * - `info`: a note about the whole row, not one value. Pins (TR-21) add theirs with this kind.
 */
export type ReasonKind = "required" | "preferred" | "not-preferred" | "unknown" | "info";

/** One reason. `dimension` is the scoring dimension it is about, or null for `info`. */
export type Reason = { kind: ReasonKind; dimension: BriefDimension | null; text: string };

/** A row's reasons, and the same texts joined into one string for the export (TR-25). */
export type RowReasons = { reasons: Reason[]; reasonText: string };

/** Joins the reason texts into `reasonText`. */
export const REASON_SEPARATOR = "; ";

/** Longest value shown in a reason, in characters, including the "…" that ends a cut value. */
export const MAX_REASON_VALUE_LENGTH = 60;

export const REASON_TEXT = {
  /** A brief with no must-haves and no preferences. */
  noCriteria: "Matches your criteria. No preferences were set.",
  /** A brief with must-haves but no preferences, after the required lines. */
  noPreferences: "No preferences were set, so all matches score 0.",
} as const;

/** `value`, cut to `MAX_REASON_VALUE_LENGTH` characters with "…". Counts code points, so no emoji is split. */
function shown(value: string): string {
  const characters = Array.from(value);
  if (characters.length <= MAX_REASON_VALUE_LENGTH) return value;
  return `${characters.slice(0, MAX_REASON_VALUE_LENGTH - 1).join("")}…`;
}

/** "1,200". Plain code, not `toLocaleString()`, so every browser gives the same text. */
function withCommas(count: number): string {
  return String(count).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** "25 employees", "1 employee", "10 to 19 employees", "10,000 or more employees". */
function employeesText(employees: NormalizedRecord["employees"]): string | null {
  if (!employees.known) return null;
  if (employees.source === "range" && employees.max === Number.POSITIVE_INFINITY) {
    return `${withCommas(employees.min)} or more employees`;
  }
  if (employees.source === "range" && employees.min !== employees.max) {
    return `${withCommas(employees.min)} to ${withCommas(employees.max)} employees`;
  }
  const count = employees.source === "actual" ? employees.count : employees.min;
  return `${withCommas(count)} ${count === 1 ? "employee" : "employees"}`;
}

/** The record's display value for `field`, cut to length, or null when the record doesn't have one. */
function valueOf(record: NormalizedRecord, field: BriefField): string | null {
  if (field === "employees") return employeesText(record.employees);
  const value = record[field];
  return value.known ? shown(value.value) : null;
}

/** What a field is called in a reason. Employees is "Company size", as in the criteria summary. */
function labelOf(field: BriefField): string {
  return field === "employees" ? DIMENSION_NAMES.employees : FIELD_LABELS[field];
}

/**
 * The label for one or more fields of a dimension: the field's own label for one field, and the
 * dimension's name ("Location") for city and state together.
 */
function labelFor(fields: readonly BriefField[]): string {
  return fields.length === 1 ? labelOf(fields[0]) : DIMENSION_NAMES[FIELD_DIMENSION[fields[0]]];
}

/** The fields in `BRIEF_FIELDS` order (city before state), each once. */
function inFieldOrder(fields: Iterable<BriefField>): BriefField[] {
  const set = new Set(fields);
  return BRIEF_FIELDS.filter((field) => set.has(field));
}

/**
 * The record's values for `fields` as one "Label: value" text, from the fields it has values
 * for: "Location: Phoenix, AZ" for both, "City: Phoenix" when only the city is known.
 * Null when it has none of them.
 */
function valuesText(record: NormalizedRecord, fields: readonly BriefField[]): string | null {
  const known = fields.flatMap((field) => {
    const value = valueOf(record, field);
    return value === null ? [] : [{ field, value }];
  });
  if (known.length === 0) return null;
  return `${labelFor(known.map(({ field }) => field))}: ${known.map(({ value }) => value).join(", ")}`;
}

/** "Title unknown", "Location unknown": the fields of `fields` the record has no value for. */
function unknownText(record: NormalizedRecord, fields: readonly BriefField[]): string {
  const missing = fields.filter((field) => valueOf(record, field) === null);
  return `${labelFor(missing.length > 0 ? missing : fields)} unknown`;
}

/**
 * One line per must-have dimension, in the order the brief first mentions it. City and state
 * share one Location line. Every must-have passed, so every value is known.
 */
function requiredReasons(record: NormalizedRecord, brief: SearchBrief): Reason[] {
  const fieldsByDimension = new Map<BriefDimension, BriefField[]>();
  for (const { field } of brief.mustHaves) {
    const dimension = FIELD_DIMENSION[field];
    fieldsByDimension.set(dimension, [...(fieldsByDimension.get(dimension) ?? []), field]);
  }
  return [...fieldsByDimension].map(([dimension, listed]) => {
    const fields = inFieldOrder(listed);
    return {
      kind: "required",
      dimension,
      // `unknownText()` can't happen for an eligible row; it only keeps the type honest.
      text: `${valuesText(record, fields) ?? unknownText(record, fields)} (required)`,
    };
  });
}

const PREFERENCE_KIND: Record<MatchResult, ReasonKind> = {
  match: "preferred",
  "no-match": "not-preferred",
  unknown: "unknown",
};

/** One dimension's preference line, from its scoring result. */
function preferenceReason(record: NormalizedRecord, score: DimensionScore): Reason {
  const fields = inFieldOrder(score.criteria.map(({ field }) => field));
  const kind = PREFERENCE_KIND[score.result];
  const values = valuesText(record, fields);
  let text: string;
  if (score.result === "unknown" || values === null) text = unknownText(record, fields);
  else text = `${values} (${score.result === "match" ? "preferred" : "not preferred"})`;
  return { kind, dimension: score.dimension, text };
}

/**
 * The preference lines, by weight, highest first. `breakdown` is in default dimension order and
 * the sort is stable, so equal weights stay in that order.
 */
function preferenceReasons(record: NormalizedRecord, breakdown: readonly DimensionScore[]): Reason[] {
  return [...breakdown]
    .sort((a, b) => b.weight - a.weight)
    .map((score) => preferenceReason(record, score));
}

/**
 * Explains one scored row against the brief it was ranked with:
 *
 * 1. `required`: the must-haves it met, in brief order, one line per dimension.
 * 2. One line per preferred dimension, highest weight first: `preferred`, `not-preferred` or
 *    `unknown`.
 * 3. `info` when the brief has no preferences.
 *
 * Values are always the record's own (`value`, tidied by TR-10), never the brief's. Exclusions
 * aren't listed: every eligible row passed them. A row always has at least one reason.
 */
export function explain(row: ScoredRecord, brief: SearchBrief): RowReasons {
  const record = row.record.normalized;
  const reasons = [...requiredReasons(record, brief), ...preferenceReasons(record, row.breakdown)];
  if (brief.preferences.length === 0) {
    reasons.push({
      kind: "info",
      dimension: null,
      text: reasons.length === 0 ? REASON_TEXT.noCriteria : REASON_TEXT.noPreferences,
    });
  }
  return { reasons, reasonText: reasons.map(({ text }) => text).join(REASON_SEPARATOR) };
}
