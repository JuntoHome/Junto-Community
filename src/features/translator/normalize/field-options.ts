import type { NormalizedRow } from "./normalize";
import type { CategoryField } from "./types";

/**
 * The values a criteria picker offers for one field (TR-14), read from the loaded records so
 * the choices and their counts are what ranking will see. Never a hard-coded list.
 *
 * Pure and deterministic: no React, no I/O, no logging. The same records always give the same options.
 */

/** One value found in the records. */
export type FieldOption = {
  /** The match key every record in this option shares. Used to tell options apart, never shown. */
  key: string;
  /** What the picker shows and the SearchBrief gets: the most common spelling of the value. */
  label: string;
  /** How many records have this value. */
  count: number;
};

type Tally = { count: number; firstRow: number };

/**
 * The distinct values of `field` across `records`, grouped by match key, so " phoenix " and
 * "Phoenix" are one option. Unknown (blank or invalid) values are skipped.
 *
 * - `label`: the most common display `value` among the records with that key. A tie goes to the
 *   spelling that appears first (lowest `sourceRow`).
 * - `count`: the number of records with that key.
 * - Sorted by `label` with `localeCompare(…, "en")`. Two options can't share a label, because the
 *   same label always has the same key.
 *
 * Pass the grouped `records` (TR-12), not every parsed row, so counts match what ranking uses.
 */
export function fieldOptions(
  records: readonly Pick<NormalizedRow, "sourceRow" | "normalized">[],
  field: CategoryField,
): FieldOption[] {
  // For each key: its record count, and how often each spelling appears and where it first appears.
  const byKey = new Map<string, { count: number; spellings: Map<string, Tally> }>();
  for (const record of records) {
    const category = record.normalized[field];
    if (!category.known) continue;
    let entry = byKey.get(category.key);
    if (!entry) {
      entry = { count: 0, spellings: new Map() };
      byKey.set(category.key, entry);
    }
    entry.count += 1;
    const tally = entry.spellings.get(category.value);
    if (tally) {
      tally.count += 1;
      tally.firstRow = Math.min(tally.firstRow, record.sourceRow);
    } else {
      entry.spellings.set(category.value, { count: 1, firstRow: record.sourceRow });
    }
  }

  const options: FieldOption[] = [];
  for (const [key, { count, spellings }] of byKey) {
    let label = "";
    let best: Tally | null = null;
    for (const [spelling, tally] of spellings) {
      if (!best || tally.count > best.count || (tally.count === best.count && tally.firstRow < best.firstRow)) {
        label = spelling;
        best = tally;
      }
    }
    options.push({ key, label, count });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, "en"));
}
