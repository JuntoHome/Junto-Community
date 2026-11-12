import { TEXT_FIELDS, type Executive, type TextField, type TranslatorRecord } from "./fields";
import type { FieldRules, LayoutMapping, TextRule } from "./mappings/types";

/**
 * Turns one source row into a TranslatorRecord using a layout mapping. This is the only code
 * that interprets mapping rules; the workbook parser (TR-08) calls it once per data row.
 *
 * Values stay raw: text as it is in the cell, or null when the cell is blank or only spaces.
 * Nothing is trimmed, recased, parsed or validated here (that's TR-10 and TR-11), except that
 * joined parts (a first and last name) are trimmed so the join has single spaces.
 *
 * Pure: no React, no I/O, and no workbook library, so it works with whatever parser TR-08 uses.
 */

/** A cell value as the workbook parser hands it over. */
export type SourceCell = string | number | boolean | null | undefined;

/**
 * The form a header is compared in: ends trimmed, lower case, inner spacing kept.
 * "  City " matches "City", but "Advertising  Expenses" (two spaces) doesn't match "Advertising Expenses".
 * A blank header becomes "", which no mapping uses.
 */
export function normalizeHeader(header: SourceCell): string {
  return header == null ? "" : String(header).trim().toLowerCase();
}

/** The cell's text, or null when it is blank or only spaces. */
function cellText(cell: SourceCell): string | null {
  if (cell == null) return null;
  const text = String(cell);
  return text.trim() === "" ? null : text;
}

/** Non-blank parts joined with single spaces, or null when every part is blank. */
function joinText(parts: readonly (string | null)[]): string | null {
  const filled = parts.filter((part): part is string => part !== null).map((part) => part.trim());
  return filled.length > 0 ? filled.join(" ") : null;
}

/** "ROW-0001" for the first data row; wider past 9999 ("ROW-12345"). */
export function generatedRecordId(position: number): string {
  return `ROW-${String(position).padStart(4, "0")}`;
}

/**
 * Maps one data row.
 *
 * @param mapping  the detected layout
 * @param headers  the header row (row 1), in column order
 * @param row      one data row, in the same column order (may be shorter than headers)
 * @param position the row's 1-based position among the data rows: the first row after the header is 1
 */
export function mapRow(
  mapping: LayoutMapping,
  headers: readonly SourceCell[],
  row: readonly SourceCell[],
  position: number,
): TranslatorRecord {
  // Column index by normalized header. Blank headers are skipped; if a header repeats, the first one wins.
  const columns = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key !== "" && !columns.has(key)) columns.set(key, index);
  });

  /** A column's text, or null when the cell is blank or the column is missing. */
  const read = (header: string): string | null => {
    const index = columns.get(normalizeHeader(header));
    return index === undefined ? null : cellText(row[index]);
  };

  const readRule = (rule: TextRule): string | null => {
    switch (rule.kind) {
      case "column":
        return read(rule.header);
      case "join":
        return joinText(rule.headers.map(read));
      case "firstNonBlank":
        return rule.headers.map(read).find((value) => value !== null) ?? null;
      case "none":
        return null;
    }
  };

  const readExecutives = (rule: FieldRules["otherExecutives"]): Executive[] => {
    if (rule.kind === "none") return [];
    const executives: Executive[] = [];
    for (let slot = 1; slot <= rule.slots; slot++) {
      const name = joinText(rule.nameHeaders.map((header) => read(`${header} ${slot}`)));
      const title = read(`${rule.titleHeader} ${slot}`);
      if (name !== null || title !== null) executives.push({ name, title });
    }
    return executives;
  };

  const { fields } = mapping;
  const text = Object.fromEntries(TEXT_FIELDS.map((field) => [field, readRule(fields[field])])) as Record<
    TextField,
    string | null
  >;

  return {
    recordId: read(fields.recordId.header) ?? generatedRecordId(position),
    ...text,
    otherExecutives: readExecutives(fields.otherExecutives),
  };
}
