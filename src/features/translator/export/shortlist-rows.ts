import type { MappingRow } from "../import/describe-mapping";
import type { Executive } from "../import/fields";
import type { Text } from "../normalize/types";
import type { RankResult, ShortlistRow } from "../ranking";
import { MISSING_SEPARATOR, missingFields } from "../ranking/missing";

/**
 * The Shortlist sheet as plain data (TR-25): one header per column and one row of cell values
 * per shortlist row, in shortlist order. `workbook.ts` turns it into the Excel sheet; this file
 * knows nothing about ExcelJS, so the content can be checked without building a file.
 *
 * The sheet is exactly `rankResult.shortlist`, so it has the same rows, order, scores, reasons
 * and Missing values as the screen, and its length is the counts summary's "exported" figure.
 * Omitted rows aren't on it: the Criteria sheet (TR-26) lists them with the overrides.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

/** A cell's value. `null` is a value the row doesn't have: the cell is left empty, never "" or "Unknown". */
export type CellValue = string | number | null;

/** How a column is stored. Only Rank, Source row, Employees and Score are numbers; everything else is text. */
export type CellKind = "text" | "number";

/** The sheet's columns, in order. */
export const SHORTLIST_COLUMNS = [
  { key: "rank", header: "Rank", kind: "number" },
  { key: "recordId", header: "Record ID", kind: "text" },
  { key: "duplicateIds", header: "Duplicate IDs", kind: "text" },
  { key: "sourceRow", header: "Source row", kind: "number" },
  { key: "company", header: "Company", kind: "text" },
  { key: "name", header: "Name", kind: "text" },
  { key: "title", header: "Title", kind: "text" },
  { key: "city", header: "City", kind: "text" },
  { key: "state", header: "State", kind: "text" },
  { key: "industry", header: "Industry", kind: "text" },
  { key: "employees", header: "Employees", kind: "number" },
  { key: "employeeRange", header: "Employee range", kind: "text" },
  { key: "email", header: "Email", kind: "text" },
  { key: "phone", header: "Phone", kind: "text" },
  { key: "website", header: "Website", kind: "text" },
  { key: "otherExecutives", header: "Other executives", kind: "text" },
  { key: "score", header: "Score", kind: "number" },
  { key: "reasons", header: "Reasons", kind: "text" },
  { key: "missing", header: "Missing", kind: "text" },
  { key: "override", header: "Override", kind: "text" },
] as const satisfies readonly { key: string; header: string; kind: CellKind }[];

export type ShortlistColumn = (typeof SHORTLIST_COLUMNS)[number];
export type ShortlistColumnKey = ShortlistColumn["key"];

/** What the Override column says for a pinned row. Other rows leave it empty. */
export const OVERRIDE_TEXT = { pinned: "Pinned" } as const;

/** Joins Duplicate IDs. */
const ID_SEPARATOR = ", ";
/** Joins Other executives. */
const EXECUTIVE_SEPARATOR = "; ";

export type ShortlistTable = { columns: readonly ShortlistColumn[]; rows: CellValue[][] };

/** A value's tidy text, or null when the row doesn't have it. */
const known = (text: Text): string | null => (text.known ? text.value : null);

/** Joined with `separator`, or null when there is nothing to join, so the cell stays empty. */
const joined = (items: readonly string[], separator: string): string | null =>
  items.length > 0 ? items.join(separator) : null;

/** "Name (Title)", "Name" when the title is blank, "(Title)" when the name is. Null when both are blank. */
function executiveText({ name, title }: Executive): string | null {
  if (name === null && title === null) return null;
  if (title === null) return name;
  return name === null ? `(${title})` : `${name} (${title})`;
}

function rowCells(row: ShortlistRow, mapping: readonly MappingRow[]): Record<ShortlistColumnKey, CellValue> {
  const { record } = row;
  const r = record.normalized;
  return {
    rank: row.rank,
    recordId: r.recordId,
    duplicateIds: joined(record.duplicateIds, ID_SEPARATOR),
    sourceRow: record.sourceRow,
    company: known(r.company),
    name: known(r.name),
    title: known(r.title),
    city: known(r.city),
    state: known(r.state),
    industry: known(r.industry),
    // Only an actual count is a number. A count read from the size range is in Employee range instead.
    employees: r.employees.known && r.employees.source === "actual" ? r.employees.count : null,
    employeeRange: known(r.employeeRange),
    email: known(r.email),
    phone: known(r.phone),
    website: known(r.website),
    otherExecutives: joined(
      r.otherExecutives.flatMap((executive) => executiveText(executive) ?? []),
      EXECUTIVE_SEPARATOR,
    ),
    // The rounded score shown on screen. `rank` keeps the exact order.
    score: row.displayScore,
    reasons: row.reasonText,
    missing: joined(missingFields(r, mapping), MISSING_SEPARATOR),
    override: row.override === "pinned" ? OVERRIDE_TEXT.pinned : null,
  };
}

/**
 * The Shortlist sheet's columns and rows for one ranking run. `mapping` is `describeMapping()`
 * for the loaded file, for the Missing column (the same `missingFields()` as the screen).
 */
export function shortlistTable(rankResult: RankResult, mapping: readonly MappingRow[]): ShortlistTable {
  return {
    columns: SHORTLIST_COLUMNS,
    rows: rankResult.shortlist.map((row) => {
      const cells = rowCells(row, mapping);
      return SHORTLIST_COLUMNS.map(({ key }) => cells[key]);
    }),
  };
}
