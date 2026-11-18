import { DIMENSION_NAMES } from "../criteria/describe";
import { MAPPING_STATUS, type MappingRow } from "../import/describe-mapping";
import { FIELD_LABELS, type RecordField } from "../import/fields";
import type { NormalizedRecord } from "../normalize/types";

/**
 * Missing fields (TR-22): which of the shown fields a shortlist row has no value for, so the
 * results table can say "Missing: Title, Contact" and the export (TR-25) can write the same.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/**
 * One shown field: its label, the record values that fill it (it is missing when all of them
 * are unknown), and the mapped fields whose columns count as the file having it.
 */
type ShownField = { label: string; values: readonly ValueField[]; columns: readonly RecordField[] };

/** The record values a shown field is made of. */
type ValueField = "name" | "title" | "email" | "phone" | "website" | "employees";

/**
 * The fields checked, in the order they are listed. Contact is email, phone and website
 * together. Company size is the employee count, which normalizing fills from the employee range
 * when the count is blank (TR-10), so either column means the file has it.
 */
const SHOWN_FIELDS: readonly ShownField[] = [
  { label: FIELD_LABELS.name, values: ["name"], columns: ["name"] },
  { label: FIELD_LABELS.title, values: ["title"], columns: ["title"] },
  { label: "Contact", values: ["email", "phone", "website"], columns: ["email", "phone", "website"] },
  { label: DIMENSION_NAMES.employees, values: ["employees"], columns: ["employees", "employeeRange"] },
];

/** Joins `missingFields()` for one line of text. */
export const MISSING_SEPARATOR = ", ";

/**
 * What the results table's Contact column shows (TR-22), one entry per line: the email when the
 * record has one; otherwise the phone and the website, each that is known. Empty when none is
 * known, which is exactly when `missingFields()` lists Contact (if the file has those columns).
 * Reference Solutions exports have no email column, so they show phone and website.
 */
export function contactLines(record: NormalizedRecord): string[] {
  if (record.email.known) return [record.email.value];
  return [record.phone, record.website].flatMap((text) => (text.known ? [text.value] : []));
}

/**
 * The labels of the shown fields this record has no value for, in `SHOWN_FIELDS` order: Name,
 * Title, Contact, Company size. Empty when it has them all.
 *
 * `mapping` is `describeMapping()` for the file the record came from. A field is listed only
 * when the file has a column for it (status `Found`): a column that is missing from the whole
 * file, or that the layout doesn't have, is already explained on the Preview step, so it isn't
 * repeated on every row. Contact is listed only when email, phone and website are all unknown,
 * and only when the file has at least one of those columns. In the Reference Solutions layout,
 * which has no email column, that means phone and website are both blank.
 */
export function missingFields(record: NormalizedRecord, mapping: readonly MappingRow[]): string[] {
  const found = new Set(mapping.filter((row) => row.status === MAPPING_STATUS.found).map((row) => row.field));
  return SHOWN_FIELDS.filter(
    ({ values, columns }) => columns.some((field) => found.has(field)) && !values.some((field) => record[field].known),
  ).map(({ label }) => label);
}
