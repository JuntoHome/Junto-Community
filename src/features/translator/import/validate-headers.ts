import { normalizeHeader, type SourceCell } from "./map-row";
import type { FieldRules, LayoutMapping } from "./mappings/types";

/**
 * Checks a recognised file's header row against its layout's mapping before any data row is
 * read (TR-09). Required headers must each appear exactly once. Optional mapped headers may be
 * missing: their values are unknown (`mapRow()` gives null for an absent column).
 *
 * Headers are compared like everywhere else (`normalizeHeader()`: trimmed, ignoring case).
 * Messages name columns as the mapping writes them, which is how they appear in a real file.
 *
 * Pure: no React, no I/O, no logging.
 */

export const HEADER_MESSAGES = {
  /** Shown as its own line under the "Missing required columns" message. */
  missingRequiredHint: "Add these columns to the file and upload again.",
} as const;

export type HeaderProblem = "missingRequired" | "duplicateRequired";

export type HeaderCheck =
  | {
      ok: true;
      /** Optional mapped headers the file doesn't have, as the mapping names them, in field order. */
      missingOptional: string[];
      /** Optional or unmapped headers that appear more than once, as first written in the file. The first one is used. */
      duplicates: string[];
    }
  | {
      ok: false;
      code: HeaderProblem;
      message: string;
      /** The required headers that are missing, in `requiredHeaders` order. Empty for a duplicate. */
      missing: string[];
    };

/** "Missing required columns: City, State". No full stop, to match the acceptance criteria. */
export function missingRequiredMessage(names: readonly string[]): string {
  return `Missing required columns: ${names.join(", ")}`;
}

export function duplicateRequiredMessage(name: string): string {
  return `The column ${name} appears more than once. Keep one and upload again.`;
}

/**
 * Every single-column header the mapping reads, in field order, without repeats. Numbered
 * executive slots are left out: a file may have any number of them, and absent slots are skipped.
 */
function mappedHeaders(fields: FieldRules): string[] {
  const headers: string[] = [];
  for (const rule of Object.values(fields)) {
    switch (rule.kind) {
      case "column":
      case "generatedId":
        headers.push(rule.header);
        break;
      case "join":
      case "firstNonBlank":
        headers.push(...rule.headers);
        break;
      case "none":
      case "repeated":
        break;
    }
  }
  const seen = new Set<string>();
  return headers.filter((header) => {
    const key = normalizeHeader(header);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validateHeaders(mapping: LayoutMapping, headers: readonly SourceCell[]): HeaderCheck {
  // How often each header appears, and how it was first written. Blank header cells are ignored.
  const counts = new Map<string, { count: number; written: string }>();
  for (const header of headers) {
    const key = normalizeHeader(header);
    if (key === "") continue;
    const entry = counts.get(key);
    if (entry) entry.count++;
    else counts.set(key, { count: 1, written: String(header).trim() });
  }
  const countOf = (header: string) => counts.get(normalizeHeader(header))?.count ?? 0;

  const missing = mapping.requiredHeaders.filter((header) => countOf(header) === 0);
  if (missing.length > 0) {
    return { ok: false, code: "missingRequired", message: missingRequiredMessage(missing), missing };
  }

  const repeated = mapping.requiredHeaders.find((header) => countOf(header) > 1);
  if (repeated !== undefined) {
    return { ok: false, code: "duplicateRequired", message: duplicateRequiredMessage(repeated), missing: [] };
  }

  const required = new Set(mapping.requiredHeaders.map(normalizeHeader));
  const missingOptional = mappedHeaders(mapping.fields).filter(
    (header) => !required.has(normalizeHeader(header)) && countOf(header) === 0,
  );
  const duplicates = [...counts.values()].filter((entry) => entry.count > 1).map((entry) => entry.written);

  return { ok: true, missingOptional, duplicates };
}
