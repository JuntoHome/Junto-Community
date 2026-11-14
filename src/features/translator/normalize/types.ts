import type { Executive, TextField } from "../import/fields";

/**
 * The shapes the normalize step (TR-10) gives each value. Every value keeps three versions:
 *
 * - `original`: the mapped value exactly as it came from the workbook. Export (TR-25) uses it.
 * - `value`: trimmed, inner whitespace collapsed to one space. Use it for display.
 * - `key` (categories only): `matchKey(value)`. Use it for matching, never for display.
 *
 * A value the row doesn't have is `unknown`: a tagged object, never null or "". The `reason`
 * says why, so TR-11 can flag invalid employee counts without reading the cells again.
 */

/** Why a value is unknown: the cell was blank (or only spaces), or it couldn't be read as the expected kind of value. */
export type UnknownReason = "blank" | "invalid";

export type Unknown = { known: false; reason: UnknownReason };

/** A value the row doesn't have. `original` is the raw mapped value: null, or text that is only spaces. */
export type UnknownText = Unknown & { original: string | null };

/** One piece of text, shown but not matched. */
export type Text = { known: true; original: string; value: string } | UnknownText;

/** Text that criteria compare (city, state, industry, title). `key` is the match key and exists only when known. */
export type Category = { known: true; original: string; value: string; key: string } | UnknownText;

/**
 * A business's employee count.
 *
 * - `source: "actual"`: a whole number from the employees column. `original` is that cell's text.
 * - `source: "range"`: the employees column was unknown, so it came from `employeeRange` (Reference
 *   Solutions "Location Employee Size Range"). `original` is the range text. An open range such as
 *   "10,000+" has `max = Number.POSITIVE_INFINITY`.
 * - Unknown: `original` is the raw employees value; `reason` is "invalid" when it wasn't a whole
 *   number and no range could be read, otherwise "blank".
 *
 * Range fit rule, applied by ranking (`matchCriterion()` in ranking/match.ts), not here: a
 * range-sourced count matches a user range only when the whole range fits inside it
 * (`min >= userMin && max <= userMax`). An open range (`max` is Infinity) never matches, because
 * a user range always has a whole-number max.
 */
export type Employees =
  | { known: true; original: string; count: number; source: "actual" }
  | { known: true; original: string; min: number; max: number; source: "range" }
  | UnknownText;

/** The fields normalized as a `Category`. They are the text fields a SearchBrief can test. */
export const CATEGORY_FIELDS = ["city", "state", "industry", "title"] as const satisfies readonly TextField[];
export type CategoryField = (typeof CATEGORY_FIELDS)[number];

/** The fields normalized as plain `Text`: every text field except the categories and employees. */
export type PlainTextField = Exclude<TextField, CategoryField | "employees">;

/** A TranslatorRecord after normalizing: the same fields, each in one of the shapes above. */
export type NormalizedRecord = {
  /** Trimmed, inner whitespace collapsed. Never blank: the parser generates "ROW-0001" style IDs. */
  recordId: string;
  employees: Employees;
  /** Name and title trimmed (null when blank). Executives with neither are dropped. Display only. */
  otherExecutives: Executive[];
} & Record<CategoryField, Category> &
  Record<PlainTextField, Text>;
