import { fileURLToPath } from "node:url";
import type { FixtureCell, FixtureRow } from "./build-workbook";
import { RS_HEADERS } from "./rs-headers";

/**
 * Small invented rows for the import and cleaning tests. Every value is made up: `TST-` IDs,
 * "Test Company 01" style names and `.invalid` email addresses, so nothing here can be mistaken
 * for a real business. Never paste rows from a real export into this file.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */

/** The committed synthetic sample (500 fictional records). Tests read it with `fs`. */
export const SAMPLE_PATH = fileURLToPath(new URL("../../../../docs/translator/JCA_Synthetic_Contacts.xlsx", import.meta.url));

/** The served copy of the sample used by the Load sample button. It must be byte-identical. */
export const PUBLIC_SAMPLE_PATH = fileURLToPath(
  new URL("../../../../public/translator/JCA_Synthetic_Contacts.xlsx", import.meta.url),
);

/** The committed Reference Solutions layout sample (TR-35): 100 fictional rows, built by scripts/translator/make-rs-fixture.ts. */
export const RS_SAMPLE_PATH = fileURLToPath(new URL("../../../../docs/translator/JCA_Synthetic_RS_Layout.xlsx", import.meta.url));

/** The served copy of the Reference Solutions sample. It must be byte-identical. */
export const PUBLIC_RS_SAMPLE_PATH = fileURLToPath(
  new URL("../../../../public/translator/JCA_Synthetic_RS_Layout.xlsx", import.meta.url),
);

/** The 9 headers of the synthetic layout, in the sample's column order. */
export const SYNTHETIC_HEADERS = [
  "Record ID",
  "Company",
  "Name",
  "Title",
  "City",
  "State",
  "Industry",
  "Email",
  "Employees",
] as const;

export type SyntheticColumn = (typeof SYNTHETIC_HEADERS)[number];

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/**
 * A complete synthetic row for invented business `n` (1 to 99), with any cells replaced by
 * `changes`. Defaults: TST-00nn, "Test Company nn", "Test Person nn", Owner, Phoenix, AZ,
 * Fabrication, personnn@example.invalid, 25 employees (a number cell).
 */
export function syntheticRow(n: number, changes: Partial<Record<SyntheticColumn, FixtureCell>> = {}): FixtureCell[] {
  const values: Record<SyntheticColumn, FixtureCell> = {
    "Record ID": `TST-${pad(n, 4)}`,
    Company: `Test Company ${pad(n, 2)}`,
    Name: `Test Person ${pad(n, 2)}`,
    Title: "Owner",
    City: "Phoenix",
    State: "AZ",
    Industry: "Fabrication",
    Email: `person${pad(n, 2)}@example.invalid`,
    Employees: 25,
    ...changes,
  };
  return SYNTHETIC_HEADERS.map((header) => values[header]);
}

/** A synthetic sheet: the header row, then these rows. */
export function syntheticSheet(rows: readonly FixtureRow[]): FixtureRow[] {
  return [[...SYNTHETIC_HEADERS], ...rows];
}

/**
 * The same sheet with some columns removed, header and cells alike. `dropped` names headers
 * exactly as they appear in row 1.
 */
export function withoutColumns(sheet: readonly FixtureRow[], dropped: readonly string[]): FixtureRow[] {
  const [headers = [], ...rows] = sheet;
  const keep = headers.map((header) => !dropped.includes(String(header)));
  return [headers, ...rows].map((row) => row.filter((_, column) => keep[column] ?? true));
}

/** A Reference Solutions column name, as written in the export (see rs-headers.ts). */
export type RsHeader = string;

/**
 * One row in the full 396-column Reference Solutions layout, with these cells filled and every
 * other cell empty. Throws on a header that isn't in the export, so a typo can't pass silently.
 */
export function rsRow(values: Readonly<Record<RsHeader, FixtureCell>>): FixtureCell[] {
  for (const header of Object.keys(values)) {
    if (!RS_HEADERS.includes(header)) throw new Error(`Not a Reference Solutions header: "${header}"`);
  }
  return RS_HEADERS.map((header) => (header === null ? null : (values[header] ?? null)));
}

/**
 * A Reference Solutions row for invented business `n`: the four required columns, an IUSA Number
 * (TST-90nn), a main contact and an employee count, with any cells replaced by `changes`.
 */
export function rsBusiness(n: number, changes: Readonly<Record<RsHeader, FixtureCell>> = {}): FixtureCell[] {
  return rsRow({
    "Company Name": `Test Company ${pad(n, 2)}`,
    City: "Tempe",
    State: "AZ",
    "Primary SIC Description": "Logistics",
    "IUSA Number": `TST-${pad(9000 + n, 4)}`,
    "Executive First Name": "Test",
    "Executive Last Name": `Person ${pad(n, 2)}`,
    "Executive Title": "Operations Manager",
    "Location Employee Size Actual": 40,
    ...changes,
  });
}

/** The full Reference Solutions header row, then these rows. */
export function rsSheet(rows: readonly FixtureRow[]): FixtureRow[] {
  return [[...RS_HEADERS], ...rows];
}

/** A fixed-seed generator (mulberry32): each call gives the next whole number from 0 to 2^32 - 1. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/**
 * `length` bytes from a fixed-seed generator (mulberry32), so a "random" file is the same on
 * every run. Used for files that aren't workbooks at all.
 */
export function seededBytes(seed: number, length: number): Uint8Array {
  const next = mulberry32(seed);
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) bytes[i] = next() & 0xff;
  return bytes;
}

/**
 * A new array with `items` in a shuffled order that depends only on `seed` (Fisher-Yates with
 * mulberry32), so a "shuffled" test gives the same order on every run. `items` is not changed.
 */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const next = mulberry32(seed);
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = next() % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
