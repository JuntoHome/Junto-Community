import { FIELD_LABELS, RECORD_FIELDS, type RecordField } from "./fields";
import { normalizeHeader, type SourceCell } from "./map-row";
import type { FieldRules, LayoutMapping, RepeatedRule } from "./mappings/types";

/**
 * Describes how a layout mapping fills each internal field for one file, so the Preview step
 * (TR-13) can show which spreadsheet column feeds which field and whether the file has it.
 *
 * Pure: no React, no I/O, no logging. It reads only the header row, never a data cell.
 */

export const MAPPING_STATUS = {
  found: "Found",
  missing: "Missing (shown as unknown)",
  notInLayout: "Not in this layout",
} as const;

export type MappingStatus = (typeof MAPPING_STATUS)[keyof typeof MAPPING_STATUS];

export type MappingRow = {
  field: RecordField;
  /** The field's display name (`FIELD_LABELS`). */
  fieldLabel: string;
  /** Where the value comes from, in plain text, using the mapping's column names. */
  source: string;
  status: MappingStatus;
};

/** "Executive First Name, Last Name, Title 1 to 50": the slot columns, with their shared first words written once. */
function repeatedSource(rule: RepeatedRule): string {
  const headers = [...rule.nameHeaders, rule.titleHeader];
  const words = headers.map((header) => header.split(" "));
  let shared = 0;
  while (words.every((w) => w.length > shared + 1 && w[shared] === words[0][shared])) shared++;
  const rest = words.slice(1).map((w) => w.slice(shared).join(" "));
  return `${[headers[0], ...rest].join(", ")} 1 to ${rule.slots}`;
}

/** The header names a rule reads, for the "Found" check. Repeated slots are checked by their first slot. */
function headersRead(rule: FieldRules[RecordField]): string[] {
  switch (rule.kind) {
    case "column":
    case "generatedId":
      return [rule.header];
    case "join":
    case "firstNonBlank":
      return [...rule.headers];
    case "repeated":
      return [...rule.nameHeaders, rule.titleHeader].map((header) => `${header} 1`);
    case "none":
      return [];
  }
}

function sourceText(rule: FieldRules[RecordField]): string {
  switch (rule.kind) {
    case "column":
      return rule.header;
    case "join":
      return rule.headers.join(" + ");
    case "firstNonBlank":
      return rule.headers.join(", else ");
    case "repeated":
      return repeatedSource(rule);
    case "generatedId":
      return `${rule.header}, else generated (ROW-0001)`;
    case "none":
      return MAPPING_STATUS.notInLayout;
  }
}

/**
 * One row per internal field, in `RECORD_FIELDS` order. A field is "Found" when the header row
 * has at least one of the columns it reads (a joined name with only a first name still has a
 * value), "Missing" when it has none of them, and "Not in this layout" when the layout has no
 * such column at all. Headers are compared with `normalizeHeader()`, like the parser.
 */
export function describeMapping(mapping: LayoutMapping, headers: readonly SourceCell[]): MappingRow[] {
  const present = new Set(headers.map(normalizeHeader).filter((header) => header !== ""));
  return RECORD_FIELDS.map((field) => {
    const rule = mapping.fields[field];
    const read = headersRead(rule);
    const status =
      rule.kind === "none"
        ? MAPPING_STATUS.notInLayout
        : read.some((header) => present.has(normalizeHeader(header)))
          ? MAPPING_STATUS.found
          : MAPPING_STATUS.missing;
    return { field, fieldLabel: FIELD_LABELS[field], source: sourceText(rule), status };
  });
}
