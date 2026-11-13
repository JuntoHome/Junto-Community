import { TEXT_FIELDS, type Executive, type TranslatorRecord } from "../import/fields";
import type { ParsedRow, ParsedWorkbook } from "../import/parse";
import { matchKey } from "./match-key";
import {
  CATEGORY_FIELDS,
  type Category,
  type CategoryField,
  type Employees,
  type NormalizedRecord,
  type PlainTextField,
  type Text,
  type UnknownText,
} from "./types";

/**
 * Cleans a mapped record so matching is reliable, while keeping every original value for
 * display and export (TR-10). Runs in the browser right after `parseWorkbook()`.
 *
 * Pure and deterministic: no React, no I/O, no workbook library. The same record always gives
 * the same result.
 */

/** A parsed row plus its normalized record. `sourceValues` and `record` are left untouched. */
export type NormalizedRow = ParsedRow & { normalized: NormalizedRecord };

/** A parsed workbook whose rows have been normalized. */
export type NormalizedWorkbook = Omit<ParsedWorkbook, "rows"> & { rows: NormalizedRow[] };

/** Trimmed, with inner whitespace (including non-breaking spaces) collapsed to one space. */
function tidy(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

const unknown = (original: string | null, reason: UnknownText["reason"]): UnknownText => ({
  known: false,
  reason,
  original,
});

/** Null, empty and whitespace-only text is unknown ("blank"). */
export function normalizeText(original: string | null): Text {
  if (original === null) return unknown(null, "blank");
  const value = tidy(original);
  return value === "" ? unknown(original, "blank") : { known: true, original, value };
}

/** Like normalizeText, plus the match key when the value is known. */
export function normalizeCategory(original: string | null): Category {
  const text = normalizeText(original);
  return text.known ? { ...text, key: matchKey(text.value) } : text;
}

/** A whole number written with digits, optionally with thousands commas: "25", "1,200". */
const NUMBER = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;
/** "10 to 19", "10-19", "10 - 19", "1,000 to 4,999". */
const CLOSED_RANGE = new RegExp(String.raw`^${NUMBER}(?:\s*-\s*|\s+to\s+)${NUMBER}$`);
/** "10,000+", "10,000 or more". */
const OPEN_RANGE = new RegExp(String.raw`^${NUMBER}(?:\s*\+|\s+or\s+more)$`);

/** A digit string (commas allowed) as a number, or null when it is too big to hold exactly. */
function toCount(digits: string): number | null {
  const count = Number(digits.replace(/,/g, ""));
  return Number.isSafeInteger(count) ? count : null;
}

/**
 * The employees column as a whole number. Commas and spaces are removed first, so "1,200" and
 * " 40 " are fine. Anything else that isn't blank ("25.5", "-3", "about 20", "N/A") is "invalid".
 */
function parseActual(original: string | null): Employees {
  if (original === null || original.trim() === "") return unknown(original, "blank");
  const digits = original.replace(/[,\s]/g, "");
  const count = /^\d+$/.test(digits) ? toCount(digits) : null;
  return count === null ? unknown(original, "invalid") : { known: true, original, count, source: "actual" };
}

/**
 * An employee size range ("10 to 19", "10,000+") as min and max, or null when it isn't one.
 * The Reference Solutions wording these patterns expect is Unverified (see docs/translator/README.md).
 */
function parseRange(original: string): { min: number; max: number } | null {
  const text = tidy(original).toLowerCase();
  const closed = CLOSED_RANGE.exec(text);
  if (closed) {
    const min = toCount(closed[1]);
    const max = toCount(closed[2]);
    return min !== null && max !== null && min <= max ? { min, max } : null;
  }
  const open = OPEN_RANGE.exec(text);
  if (open) {
    const min = toCount(open[1]);
    return min === null ? null : { min, max: Number.POSITIVE_INFINITY };
  }
  return null;
}

/** The actual count when it is a whole number; otherwise the range, when it can be read; otherwise unknown. */
export function normalizeEmployees(employees: string | null, employeeRange: string | null): Employees {
  const actual = parseActual(employees);
  if (actual.known || employeeRange === null) return actual;
  const range = parseRange(employeeRange);
  return range ? { known: true, original: employeeRange, ...range, source: "range" } : actual;
}

/** Name and title trimmed (null when blank); executives with neither are dropped. */
function normalizeExecutives(executives: readonly Executive[]): Executive[] {
  const clean = (text: string | null) => {
    const value = text === null ? "" : tidy(text);
    return value === "" ? null : value;
  };
  return executives
    .map((executive) => ({ name: clean(executive.name), title: clean(executive.title) }))
    .filter((executive) => executive.name !== null || executive.title !== null);
}

const isCategoryField = (field: string): field is CategoryField =>
  (CATEGORY_FIELDS as readonly string[]).includes(field);

/** Normalizes one record. The record itself is not changed. */
export function normalizeRecord(record: TranslatorRecord): NormalizedRecord {
  const categories = Object.fromEntries(
    CATEGORY_FIELDS.map((field) => [field, normalizeCategory(record[field])]),
  ) as Record<CategoryField, Category>;
  const plainFields = TEXT_FIELDS.filter(
    (field): field is PlainTextField => !isCategoryField(field) && field !== "employees",
  );
  const texts = Object.fromEntries(plainFields.map((field) => [field, normalizeText(record[field])])) as Record<
    PlainTextField,
    Text
  >;

  return {
    recordId: tidy(record.recordId),
    ...categories,
    ...texts,
    employees: normalizeEmployees(record.employees, record.employeeRange),
    otherExecutives: normalizeExecutives(record.otherExecutives),
  };
}

/** Adds a normalized record to every parsed row, keeping `sourceRow`, `sourceValues` and `record` as they are. */
export function normalizeWorkbook(workbook: ParsedWorkbook): NormalizedWorkbook {
  return { ...workbook, rows: workbook.rows.map((row) => ({ ...row, normalized: normalizeRecord(row.record) })) };
}
