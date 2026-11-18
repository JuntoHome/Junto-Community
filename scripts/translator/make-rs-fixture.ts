/**
 * Builds docs/translator/JCA_Synthetic_RS_Layout.xlsx (TR-35): fictional businesses in the real
 * 396-column Data Axle Reference Solutions export layout, so the importer can be tested on the
 * real format without real data. Writes the same bytes to public/translator/ for the Load sample
 * button, and prints the SHA-256 for the file gate allowlist (src/features/translator/import/allowlist.ts).
 *
 * Run from the repository root (Node 22.18 or newer, which runs TypeScript directly):
 *
 *   node scripts/translator/make-rs-fixture.ts
 *
 * Only needed to rebuild the file. The output is byte-identical on every run (fixed dates in the
 * file and in the ZIP), so the allowlist hash only changes when this script changes. If you change
 * the rows, update the allowlist, the hash and the row notes in docs/translator/README.md.
 *
 * Row 1 is copied exactly, in order, from the "Export Headers" sheet of
 * docs/translator/JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx (396 columns, the last one has no
 * header). Every value below is invented: "Synthetic Co 001" companies, "Demo Person 001" people,
 * 555-01xx phone numbers (reserved for fiction), `.example` websites (reserved by RFC 2606) and
 * 9-digit IUSA Numbers counting up from 900000001. Only the mapped columns are filled; every other
 * column is left empty. Never copy anything from a real export into this script.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";

// Node needs the .ts extension to load the file; the type comes from the usual import path.
const { makeExcelJsCompatible }: typeof import("../../src/features/translator/import/xlsx-compat") = await import(
  new URL("../../src/features/translator/import/xlsx-compat.ts", import.meta.url).href
);

const HEADERS_WORKBOOK = new URL("../../docs/translator/JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx", import.meta.url);
const OUTPUTS = [
  new URL("../../docs/translator/JCA_Synthetic_RS_Layout.xlsx", import.meta.url),
  new URL("../../public/translator/JCA_Synthetic_RS_Layout.xlsx", import.meta.url),
];
const HEADER_COUNT = 396;
const SHEET_NAME = "Synthetic Detail Export";
/** Every date written into the file, so a rebuild gives the same bytes. */
const FIXED_DATE = new Date("2026-11-18T00:00:00Z");

// ---------------------------------------------------------------------------------------------
// The rows. Businesses 1 to 99 are spreadsheet rows 2 to 100, so business n is data row n and a
// blank IUSA Number gives it the ID ROW-00nn. Row 101 is an exact duplicate of business 1.
// ---------------------------------------------------------------------------------------------

const CITIES = [
  { city: "Phoenix", zip: "85001", areaCode: "602" },
  { city: "Tempe", zip: "85281", areaCode: "480" },
  { city: "Mesa", zip: "85201", areaCode: "480" },
  { city: "Glendale", zip: "85301", areaCode: "623" },
] as const;

const INDUSTRIES = [
  { sic: "Fabrication", naics: "Fabricated Structural Metal Manufacturing" },
  { sic: "Logistics", naics: "General Freight Trucking, Local" },
  { sic: "Retail", naics: "Hardware Retailers" },
  { sic: "Technology", naics: "Custom Computer Programming Services" },
  { sic: "Business Services", naics: "Office Administrative Services" },
] as const;

/** One title per block of 20 businesses. Each block has every city and industry pairing once. */
const TITLES = ["Owner", "Operations Manager", "General Manager", "President"] as const;

/** Location Employee Size Actual, by (n - 1) % 7. */
const EMPLOYEE_COUNTS = [25, 8, 60, 140, 15, 42, 310] as const;

/** Titles of the other executives, by slot. */
const SLOT_TITLES = ["Vice President", "Controller", "Sales Manager"] as const;

/** Rows with no IUSA Number, so they get a generated ID (ROW-0007 and so on). */
const BLANK_IUSA = new Set([7, 16, 25, 34, 43, 52, 61, 70, 79, 88]);
/** Executive Title blank, Professional Title filled: the title falls back to Professional Title. */
const TITLE_FROM_PROFESSIONAL = new Set([12, 45]);
/** Executive Title and Professional Title both blank: the title is unknown. */
const BLANK_TITLE = new Set([9, 30, 51, 72]);
/** Location Employee Size Actual blank, so the size comes from the range. */
const RANGE_ONLY = new Map<number, string>([
  [18, "10 to 19"],
  [41, "20 to 49"],
  [47, "1 to 4"],
  [66, "1,000 to 4,999"],
  [81, "100 to 249"],
]);
/** Both employee columns blank: company size is unknown. */
const NO_SIZE = new Set([58]);
const BLANK_PHONE = new Set([14, 37]);
const BLANK_WEBSITE = new Set([22, 53]);
const BLANK_PHONE_AND_WEBSITE = new Set([85]);
/** Other executives: slot 2 has a name but no title. */
const SLOT_2_NO_TITLE = new Set([2]);
/** Other executives: slot 1 is empty, slots 2 and 3 are filled. */
const SLOT_1_EMPTY = new Set([11]);

const BUSINESS_COUNT = 99;
/** Row 101 repeats business 1 with this IUSA Number. */
const DUPLICATE_OF = 1;
const DUPLICATE_IUSA = "900000100";

const pad = (n: number, width: number) => String(n).padStart(width, "0");

/** "10 to 19" style range for an actual count. */
function sizeRange(count: number): string {
  const bands: [number, number][] = [
    [1, 4],
    [5, 9],
    [10, 19],
    [20, 49],
    [50, 99],
    [100, 249],
    [250, 499],
    [500, 999],
  ];
  const band = bands.find(([min, max]) => count >= min && count <= max);
  if (!band) throw new Error(`No size range for ${count}`);
  return `${band[0]} to ${band[1]}`;
}

type Value = string | number | null;

/** Business n's cells, by header name. Headers not listed stay empty. */
function business(n: number): Map<string, Value> {
  const id = pad(n, 3);
  const place = CITIES[(n - 1) % CITIES.length];
  const industry = INDUSTRIES[Math.floor((n - 1) / CITIES.length) % INDUSTRIES.length];
  const title = TITLES[Math.floor((n - 1) / 20) % TITLES.length];
  const count = EMPLOYEE_COUNTS[(n - 1) % EMPLOYEE_COUNTS.length];
  const blankPhone = BLANK_PHONE.has(n) || BLANK_PHONE_AND_WEBSITE.has(n);
  const blankWebsite = BLANK_WEBSITE.has(n) || BLANK_PHONE_AND_WEBSITE.has(n);

  let actual: number | null = count;
  let range: string | null = sizeRange(count);
  if (RANGE_ONLY.has(n)) {
    actual = null;
    range = RANGE_ONLY.get(n)!;
  }
  if (NO_SIZE.has(n)) {
    actual = null;
    range = null;
  }

  const cells = new Map<string, Value>([
    ["Company Name", `Synthetic Co ${id}`],
    ["Executive First Name", "Demo"],
    ["Executive Last Name", `Person ${id}`],
    ["Professional Title", TITLE_FROM_PROFESSIONAL.has(n) ? title : null],
    ["Executive Title", TITLE_FROM_PROFESSIONAL.has(n) || BLANK_TITLE.has(n) ? null : title],
    ["Address", `${100 + n} Example Way`],
    ["City", place.city],
    ["State", "AZ"],
    ["ZIP Code", place.zip],
    ["Phone Number Combined", blankPhone ? null : `(${place.areaCode}) 555-01${pad(n, 2)}`],
    ["Website", blankWebsite ? null : `www.synthetic-co-${id}.example`],
    ["Primary SIC Description", industry.sic],
    ["Primary NAICS Description", industry.naics],
    ["Location Employee Size Actual", actual],
    ["Location Employee Size Range", range],
    ["IUSA Number", BLANK_IUSA.has(n) ? null : String(900000000 + n)],
  ]);

  // 0 to 3 other executives, by n % 4.
  const executives = n % 4;
  for (let slot = 1; slot <= executives; slot++) {
    if (slot === 1 && SLOT_1_EMPTY.has(n)) continue;
    cells.set(`Executive First Name ${slot}`, "Demo");
    cells.set(`Executive Last Name ${slot}`, `Executive ${id}-${slot}`);
    cells.set(`Executive Title ${slot}`, slot === 2 && SLOT_2_NO_TITLE.has(n) ? null : SLOT_TITLES[slot - 1]);
  }
  return cells;
}

function allRows(): Map<string, Value>[] {
  const rows: Map<string, Value>[] = [];
  for (let n = 1; n <= BUSINESS_COUNT; n++) rows.push(business(n));
  const duplicate = business(DUPLICATE_OF);
  duplicate.set("IUSA Number", DUPLICATE_IUSA);
  rows.push(duplicate);
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Writing the file.
// ---------------------------------------------------------------------------------------------

/** Row 1 of the "Export Headers" sheet, exactly as written: text, or null for a blank cell. */
async function readExportHeaders(): Promise<(string | null)[]> {
  const bytes = readFileSync(HEADERS_WORKBOOK);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await makeExcelJsCompatible(buffer));
  const sheet = workbook.getWorksheet("Export Headers");
  if (!sheet) throw new Error('The headers workbook has no "Export Headers" sheet');

  const headers: (string | null)[] = [];
  for (let column = 1; column <= HEADER_COUNT; column++) {
    const value = sheet.getRow(1).getCell(column).value;
    if (value !== null && typeof value !== "string") throw new Error(`Header ${column} isn't text`);
    headers.push(value);
  }
  if (sheet.getRow(1).getCell(HEADER_COUNT + 1).value !== null) throw new Error(`More than ${HEADER_COUNT} headers`);
  if (headers[HEADER_COUNT - 1] !== null) throw new Error(`Header ${HEADER_COUNT} should be blank`);
  return headers;
}

async function buildWorkbook(headers: readonly (string | null)[]): Promise<Buffer> {
  const columnOf = new Map<string, number>();
  headers.forEach((header, index) => {
    if (header === null) return;
    if (columnOf.has(header)) throw new Error(`Header "${header}" appears twice`);
    columnOf.set(header, index + 1);
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JCA Data Axle Translator (scripts/translator/make-rs-fixture.ts)";
  workbook.title = "Synthetic Reference Solutions layout sample";
  workbook.subject = "Synthetic demonstration. All companies and people are fictional.";
  workbook.created = FIXED_DATE;
  workbook.modified = FIXED_DATE;
  const sheet = workbook.addWorksheet(SHEET_NAME);

  const headerRow = sheet.getRow(1);
  headers.forEach((header, index) => {
    if (header !== null) headerRow.getCell(index + 1).value = header;
  });

  allRows().forEach((cells, index) => {
    const row = sheet.getRow(index + 2);
    for (const [header, value] of cells) {
      const column = columnOf.get(header);
      if (column === undefined) throw new Error(`No column "${header}" in the export headers`);
      if (value !== null) row.getCell(column).value = value;
    }
  });

  // ExcelJS stamps every ZIP entry with the current time. Rewrite the files with a fixed date and
  // no folder entries (JSZip would stamp those with the current time too; Excel doesn't need them).
  const written = await workbook.xlsx.writeBuffer();
  const zip = await JSZip.loadAsync(written);
  const fixed = new JSZip();
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    fixed.file(entry.name, await entry.async("uint8array"), { date: FIXED_DATE, binary: true, createFolders: false });
  }
  return fixed.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

const headers = await readExportHeaders();
const bytes = await buildWorkbook(headers);
for (const output of OUTPUTS) writeFileSync(output, bytes);
console.log(`Wrote ${bytes.length} bytes to ${OUTPUTS.length} files.`);
console.log(`SHA-256: ${createHash("sha256").update(bytes).digest("hex")}`);
