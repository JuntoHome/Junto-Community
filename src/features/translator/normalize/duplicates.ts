import { FIELD_LABELS, RECORD_FIELDS, type RecordField } from "../import/fields";
import { matchKey } from "./match-key";
import type { NormalizedRow } from "./normalize";
import type { NormalizedRecord } from "./types";
import { compareIssues, quote, type RowIssue } from "./validate-rows";

/**
 * Groups rows that describe the same business twice (TR-12), so each business is ranked once.
 * Runs in the browser right after `validateRows()`, on its `kept` rows only, so every Record ID
 * here is already unique.
 *
 * Pure and deterministic: no React, no I/O, no logging. The same rows always give the same result.
 */

/** A kept row plus the rows folded into it. Both lists are in `sourceRow` order and empty when there are none. */
export type GroupedRecord = NormalizedRow & {
  /** Record IDs of the exact duplicates folded into this row, as normalized. */
  duplicateIds: string[];
  /** Spreadsheet row numbers of those duplicates, in the same order. */
  duplicateRows: number[];
};

export type DuplicateGrouping = {
  /** One per business, in `sourceRow` order. Ranking (TR-17) uses these. */
  records: GroupedRecord[];
  /** How many rows were folded into another row (the "duplicates" figure in the counts). */
  duplicateCount: number;
  /** `possible-duplicate` warnings, sorted by sourceRow then code. Grouped rows are not issues. */
  issues: RowIssue[];
};

/** Every field except the Record ID, in field order. Two rows are exact duplicates when all of these match. */
const COMPARED_FIELDS = RECORD_FIELDS.filter(
  (field): field is Exclude<RecordField, "recordId"> => field !== "recordId",
);
type ComparedField = (typeof COMPARED_FIELDS)[number];

/** "Email", "Email and Title", "Email, Title and Phone". */
function joinLabels(labels: readonly string[]): string {
  return labels.length <= 1 ? labels.join("") : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export const DUPLICATE_REASONS = {
  possibleDuplicate: (firstRow: number, firstId: string, differing: readonly string[]) =>
    `Looks like the same business as row ${firstRow} (${quote(firstId)}), but ${joinLabels(differing)} ` +
    `${differing.length === 1 ? "differs" : "differ"}. Both are kept, so check them before using the list.`,
} as const;

/**
 * One field in the form rows are compared in. A known value starts with "=" and an unknown one
 * with "?" plus its reason, so a blank never equals an invalid value or a real one.
 *
 * - Text and categories: `matchKey(value)`, so " Phoenix " and "phoenix" are the same.
 * - Employees: the count, or "min-max" for a range.
 * - Other executives: in order, each as [name key, title key] (null for a blank half).
 *   Written as JSON so a "|" or "," inside a name can't make two lists look alike.
 */
function fieldKey(record: NormalizedRecord, field: ComparedField): string {
  if (field === "otherExecutives") {
    const keyOrNull = (text: string | null) => (text === null ? null : matchKey(text));
    return `=${JSON.stringify(record.otherExecutives.map((e) => [keyOrNull(e.name), keyOrNull(e.title)]))}`;
  }
  if (field === "employees") {
    const employees = record.employees;
    if (!employees.known) return `?${employees.reason}`;
    return employees.source === "actual" ? `=${employees.count}` : `=${employees.min}-${employees.max}`;
  }
  const text = record[field];
  return text.known ? `=${matchKey(text.value)}` : `?${text.reason}`;
}

/** The exact-duplicate signature: every compared field's key, as one JSON string. */
function signature(record: NormalizedRecord): string {
  return JSON.stringify(COMPARED_FIELDS.map((field) => fieldKey(record, field)));
}

/** The match key of a known value, or null when it is unknown. */
function knownKey(record: NormalizedRecord, field: "company" | "city" | "state" | "address"): string | null {
  const text = record[field];
  return text.known ? matchKey(text.value) : null;
}

/** Records that share a company, city and state, tracked so each new one finds its earliest match in one step. */
type SimilarGroup = {
  /** The earliest record in the group. */
  first: GroupedRecord;
  /** The earliest record with no address. */
  firstWithoutAddress: GroupedRecord | null;
  /** The earliest record for each address key. */
  firstByAddress: Map<string, GroupedRecord>;
};

/** The earlier of two records, either of which may be missing. */
function earlier(a: GroupedRecord | null | undefined, b: GroupedRecord | null | undefined): GroupedRecord | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a.sourceRow <= b.sourceRow ? a : b;
}

/**
 * Folds exact duplicates into the earliest row and flags rows that look like the same business.
 *
 * - **Exact duplicates** (grouped, not an issue): every field except the Record ID is equal after
 *   normalizing (see `fieldKey`). The row with the lowest `sourceRow` is kept; the others' IDs and
 *   row numbers go into its `duplicateIds` and `duplicateRows`.
 * - **Possible duplicates** (`possible-duplicate`, warning): among the records left, the same
 *   company, city and state keys, and the same address key when both rows have an address. Rows
 *   missing any of company, city or state are never flagged. Every row is kept. Each row except
 *   the earliest is flagged against the earliest row it matches, naming the fields that differ.
 */
export function groupDuplicates(kept: readonly NormalizedRow[]): DuplicateGrouping {
  const ordered = [...kept].sort((a, b) => a.sourceRow - b.sourceRow);

  // Exact duplicates: one pass, keyed by signature.
  const records: GroupedRecord[] = [];
  const bySignature = new Map<string, GroupedRecord>();
  let duplicateCount = 0;
  for (const row of ordered) {
    const key = signature(row.normalized);
    const first = bySignature.get(key);
    if (first) {
      first.duplicateIds.push(row.normalized.recordId);
      first.duplicateRows.push(row.sourceRow);
      duplicateCount += 1;
    } else {
      const record: GroupedRecord = { ...row, duplicateIds: [], duplicateRows: [] };
      bySignature.set(key, record);
      records.push(record);
    }
  }

  // Possible duplicates: one pass over the records left, keyed by company, city and state.
  const issues: RowIssue[] = [];
  const groups = new Map<string, SimilarGroup>();
  for (const record of records) {
    const company = knownKey(record.normalized, "company");
    const city = knownKey(record.normalized, "city");
    const state = knownKey(record.normalized, "state");
    if (company === null || city === null || state === null) continue;
    const address = knownKey(record.normalized, "address");
    const groupKey = JSON.stringify([company, city, state]);

    const group = groups.get(groupKey);
    if (!group) {
      groups.set(groupKey, {
        first: record,
        firstWithoutAddress: address === null ? record : null,
        firstByAddress: new Map<string, GroupedRecord>(address === null ? [] : [[address, record]]),
      });
      continue;
    }

    // With no address, any earlier row matches. With one, only rows with no address or the same one.
    const match =
      address === null ? group.first : earlier(group.firstWithoutAddress, group.firstByAddress.get(address));
    if (match) {
      const differing = COMPARED_FIELDS.filter(
        (field) => fieldKey(record.normalized, field) !== fieldKey(match.normalized, field),
      ).map((field) => FIELD_LABELS[field]);
      issues.push({
        sourceRow: record.sourceRow,
        recordId: record.normalized.recordId,
        code: "possible-duplicate",
        severity: "warning",
        reason: DUPLICATE_REASONS.possibleDuplicate(match.sourceRow, match.normalized.recordId, differing),
      });
    }

    if (address === null) group.firstWithoutAddress ??= record;
    else if (!group.firstByAddress.has(address)) group.firstByAddress.set(address, record);
  }

  issues.sort(compareIssues);
  return { records, duplicateCount, issues };
}
