/**
 * Only this object is sent to the AI for the interview. Do not add row-level fields.
 *
 * Capability: build the file summary (TR-40), what the AI may know about the loaded file.
 * Input: the grouped records (TR-12), the same ones the criteria pickers use, the layout id and,
 * optionally, the brief the chat sends as `currentBrief`, whose values the lists must then carry.
 * Output: a FileSummary. `fileSummarySchema` is its only definition; the route checks requests with it.
 *
 * It contains:
 * - the layout id and the number of unique records
 * - the cities, states, industries and titles in the file, each with its record count, as the
 *   pickers show them (at most 100 per list, most common first)
 * - the smallest and largest employee count, and how many records have a size or none
 * - which lists were cut at 100
 *
 * A value is listed only when the summary can carry it exactly: after cleaning it must still have
 * its own match key. One that is cut at 80 characters, holds a control character or looks like
 * contact data is left out, never shortened, so the AI can't propose a value that matches no row.
 * The current brief's values are always listed (in place of the least common ones), so the AI
 * sees them and the reply check accepts them (fix B, after TR-55).
 *
 * It must never contain: company names, person names, phones, emails, websites, record IDs,
 * addresses, ZIP codes, NAICS text, other executives, or any other field of a row. Every listed
 * value goes through `sanitizeSummaryValue()`, which drops anything that looks like an email,
 * phone or website. The schema is strict, so the route refuses a summary with any extra key,
 * and it repeats the contact check, so the route refuses a contact-looking value too.
 *
 * This module is pure (zod only, no React, no I/O).
 */
import { z } from "zod";
import type { BriefField, SearchBrief } from "../criteria/schema";
import { fieldOptions } from "../normalize/field-options";
import { matchKey } from "../normalize/match-key";
import type { NormalizedRow } from "../normalize/normalize";
import type { CategoryField } from "../normalize/types";
import { looksLikeContactData, MAX_SUMMARY_VALUE_CHARS, sanitizeSummaryValue } from "./guardrails";

/** Most values one list may hold. */
export const MAX_SUMMARY_VALUES = 100;

const count = z.number().int();

const summaryValueSchema = z.strictObject({
  // The contact check repeats the browser's (sanitizeSummaryValue), so the route refuses an
  // email, phone or website even if the browser let one through.
  value: z
    .string()
    .min(1)
    .max(MAX_SUMMARY_VALUE_CHARS)
    .refine((value) => !looksLikeContactData(value)),
  count: count.min(1),
});

const summaryListSchema = z.array(summaryValueSchema).max(MAX_SUMMARY_VALUES);

export const fileSummarySchema = z.strictObject({
  layout: z.enum(["synthetic", "reference-solutions"]),
  uniqueRecords: count.min(0),
  cities: summaryListSchema,
  states: summaryListSchema,
  industries: summaryListSchema,
  titles: summaryListSchema,
  employees: z.strictObject({
    min: count.nullable(),
    max: count.nullable(),
    withValue: count.min(0),
    blank: count.min(0),
  }),
  truncated: z.strictObject({
    cities: z.boolean(),
    states: z.boolean(),
    industries: z.boolean(),
    titles: z.boolean(),
  }),
});

export type FileSummary = z.infer<typeof fileSummarySchema>;
export type SummaryValue = FileSummary["cities"][number];

/** What the summary reads from a record: its row number (for `fieldOptions()`) and normalized values. */
type SummaryRecord = Pick<NormalizedRow, "sourceRow" | "normalized">;

/** Plain UTF-16 code unit order, the same in every browser (no `localeCompare()`). */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Count descending, then value A to Z: upper-cased code unit order, then the value as written. */
function compareSummaryValues(a: SummaryValue, b: SummaryValue): number {
  return (
    b.count - a.count ||
    compareCodeUnits(a.value.toUpperCase(), b.value.toUpperCase()) ||
    compareCodeUnits(a.value, b.value)
  );
}

/** The match keys of `brief`'s values on `field`, in every part (must-haves, preferences, exclusions). */
function briefKeys(brief: SearchBrief | undefined, field: BriefField): Set<string> {
  const keys = new Set<string>();
  for (const criterion of [...(brief?.mustHaves ?? []), ...(brief?.preferences ?? []), ...(brief?.exclusions ?? [])]) {
    if (criterion.field !== field || criterion.operator === "range") continue;
    for (const value of criterion.operator === "equals" ? [criterion.value] : criterion.value) keys.add(matchKey(value));
  }
  return keys;
}

/**
 * One list: `fieldOptions()` labels and counts (not recounted). Each label goes through
 * `sanitizeSummaryValue()` and is kept only when the cleaned text still has the option's match
 * key (otherwise it is left out). Sorted, then cut to MAX_SUMMARY_VALUES, except that a value
 * whose key is in `wanted` (the current brief's) always stays, in place of the least common.
 * `truncated` is true only when values were cut, not when they were left out.
 */
function summarizeField(
  records: readonly SummaryRecord[],
  field: CategoryField,
  wanted: ReadonlySet<string>,
): { values: SummaryValue[]; truncated: boolean } {
  const values: (SummaryValue & { key: string })[] = [];
  for (const option of fieldOptions(records, field)) {
    const value = sanitizeSummaryValue(option.label);
    if (value !== null && matchKey(value) === option.key) values.push({ value, count: option.count, key: option.key });
  }
  values.sort(compareSummaryValues);
  const extra = values.slice(MAX_SUMMARY_VALUES).filter(({ key }) => wanted.has(key)).slice(0, MAX_SUMMARY_VALUES);
  const kept = [...values.slice(0, MAX_SUMMARY_VALUES - extra.length), ...extra].sort(compareSummaryValues);
  return { values: kept.map(({ value, count }) => ({ value, count })), truncated: values.length > MAX_SUMMARY_VALUES };
}

/**
 * Employee sizes. `withValue`: records with a known size (an actual count or a range). `blank`:
 * the rest (blank or invalid). `min` and `max` come from actual counts and finite range bounds
 * only, so an open range ("10,000+") adds its lower bound and never Infinity, which JSON would
 * turn into null. Both are null when no record has a size.
 */
function summarizeEmployees(records: readonly SummaryRecord[]): FileSummary["employees"] {
  let min: number | null = null;
  let max: number | null = null;
  let withValue = 0;
  for (const { normalized } of records) {
    const employees = normalized.employees;
    if (!employees.known) continue;
    withValue += 1;
    const bounds = employees.source === "actual" ? [employees.count] : [employees.min, employees.max];
    for (const bound of bounds) {
      if (!Number.isFinite(bound)) continue;
      min = min === null ? bound : Math.min(min, bound);
      max = max === null ? bound : Math.max(max, bound);
    }
  }
  return { min, max, withValue, blank: records.length - withValue };
}

/**
 * The file summary for `records` (pass the grouped records, TR-12, so counts match the pickers
 * and the Preview step). `layout` is the parsed workbook's `layout.id`. `currentBrief`, when
 * given, is the brief the chat sends with this summary: its values are always listed. The same
 * records and brief always give the same JSON.
 */
export function buildFileSummary(
  records: readonly SummaryRecord[],
  layout: FileSummary["layout"],
  currentBrief?: SearchBrief,
): FileSummary {
  const cities = summarizeField(records, "city", briefKeys(currentBrief, "city"));
  const states = summarizeField(records, "state", briefKeys(currentBrief, "state"));
  const industries = summarizeField(records, "industry", briefKeys(currentBrief, "industry"));
  const titles = summarizeField(records, "title", briefKeys(currentBrief, "title"));
  return {
    layout,
    uniqueRecords: records.length,
    cities: cities.values,
    states: states.values,
    industries: industries.values,
    titles: titles.values,
    employees: summarizeEmployees(records),
    truncated: {
      cities: cities.truncated,
      states: states.truncated,
      industries: industries.truncated,
      titles: titles.truncated,
    },
  };
}
