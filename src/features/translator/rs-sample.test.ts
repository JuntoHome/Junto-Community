import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { toArrayBuffer } from "./__fixtures__/build-workbook";
import { runPipeline } from "./__fixtures__/pipeline";
import { RS_SAMPLE_PATH } from "./__fixtures__/records";
import { RS_HEADERS } from "./__fixtures__/rs-headers";
import { BUSINESS_OWNER_BRIEF } from "./criteria/examples";
import { shortlistTable } from "./export/shortlist-rows";
import { missingFields } from "./ranking/missing";

/**
 * The Reference Solutions layout sample (TR-35): docs/translator/JCA_Synthetic_RS_Layout.xlsx, built
 * by scripts/translator/make-rs-fixture.ts. These tests check the issue's acceptance criteria and
 * every row docs/translator/README.md documents ("The Reference Solutions sample"), so the docs can
 * be trusted when later tests (TR-31) point at those rows. Row numbers are spreadsheet rows (the
 * header is row 1); business n is row n + 1.
 */

const readRsSample = () => toArrayBuffer(readFileSync(RS_SAMPLE_PATH));

type Pipeline = Awaited<ReturnType<typeof runPipeline>>;

/** The only columns the script fills. Every other column of the 396 must be empty. */
const FILLED_HEADERS = new Set([
  "IUSA Number",
  "Company Name",
  "Executive First Name",
  "Executive Last Name",
  "Executive Title",
  "Professional Title",
  "City",
  "State",
  "ZIP Code",
  "Address",
  "Phone Number Combined",
  "Website",
  "Primary SIC Description",
  "Primary NAICS Description",
  "Location Employee Size Actual",
  "Location Employee Size Range",
  ...[1, 2, 3].flatMap((slot) => [
    `Executive First Name ${slot}`,
    `Executive Last Name ${slot}`,
    `Executive Title ${slot}`,
  ]),
]);

describe("the file itself", () => {
  let sheet: ExcelJS.Worksheet;
  beforeAll(async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(readRsSample());
    expect(workbook.worksheets).toHaveLength(1);
    sheet = workbook.worksheets[0];
  });

  it("has all 396 headers in the export's order, the last one blank, and nothing after them", () => {
    const row = sheet.getRow(1);
    const headers = Array.from({ length: 396 }, (_, i) => row.getCell(i + 1).value);
    expect(headers).toEqual(RS_HEADERS);
    expect(row.getCell(397).value).toBeNull();
  });

  it("has 100 data rows that fill only the mapped columns", () => {
    expect(sheet.rowCount).toBe(101);
    const filled = new Set<string>();
    for (let r = 2; r <= 101; r++) {
      sheet.getRow(r).eachCell((cell, column) => filled.add(String(RS_HEADERS[column - 1])));
    }
    expect([...filled].filter((header) => !FILLED_HEADERS.has(header))).toEqual([]);
  });
});

describe("import (acceptance: layout, mapping, generated IDs, duplicate)", () => {
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(readRsSample(), BUSINESS_OWNER_BRIEF);
  });

  const record = (sourceRow: number) => {
    const row = result.importState.parsed.rows.find((r) => r.sourceRow === sourceRow);
    if (!row) throw new Error(`No row ${sourceRow}`);
    return row.normalized;
  };

  it("is detected as Reference Solutions, with every field found except Email", () => {
    const { parsed } = result.importState;
    expect(parsed.layout.label).toBe("Reference Solutions");
    expect(parsed.sheetName).toBe("Synthetic Detail Export");
    expect(result.mapping.filter((m) => m.status !== "Found").map((m) => [m.field, m.status])).toEqual([
      ["email", "Not in this layout"],
    ]);
  });

  it("reads 100 rows: 1 duplicate grouped, 99 unique, none left out, 10 with warnings", () => {
    expect(result.importSummary).toEqual({
      rowsRead: 100,
      skippedEmptyRows: 0,
      duplicatesGrouped: 1,
      uniqueRecords: 99,
      rowsLeftOut: 0,
      rowsWithWarnings: 10,
    });
  });

  it("contains only invented values", () => {
    const records = result.importState.parsed.rows.map((r) => r.normalized);
    const known = (values: { known: boolean; value?: string }[]) =>
      values.filter((v) => v.known).map((v) => (v as { value: string }).value);
    for (const company of known(records.map((r) => r.company))) expect(company).toMatch(/^Synthetic Co \d{3}$/);
    for (const name of known(records.map((r) => r.name))) expect(name).toMatch(/^Demo Person \d{3}$/);
    for (const phone of known(records.map((r) => r.phone))) expect(phone).toMatch(/^\((602|480|623)\) 555-01\d{2}$/);
    for (const site of known(records.map((r) => r.website))) expect(site).toMatch(/^www\.synthetic-co-\d{3}\.example$/);
    for (const exec of records.flatMap((r) => r.otherExecutives)) expect(exec.name).toMatch(/^Demo Executive \d{3}-[1-3]$/);
    expect(records.every((r) => !r.email.known)).toBe(true);
  });

  it("maps row 2 (business 1) to the expected values", () => {
    const r = record(2);
    expect({
      recordId: r.recordId,
      company: r.company.known && r.company.value,
      name: r.name.known && r.name.value,
      title: r.title.known && r.title.value,
      city: r.city.known && r.city.value,
      state: r.state.known && r.state.value,
      zip: r.zip.known && r.zip.value,
      address: r.address.known && r.address.value,
      industry: r.industry.known && r.industry.value,
      naics: r.naicsDescription.known && r.naicsDescription.value,
      employees: r.employees,
      employeeRange: r.employeeRange.known && r.employeeRange.value,
      phone: r.phone.known && r.phone.value,
      website: r.website.known && r.website.value,
      email: r.email.known,
      otherExecutives: r.otherExecutives,
    }).toEqual({
      recordId: "900000001",
      company: "Synthetic Co 001",
      name: "Demo Person 001",
      title: "Owner",
      city: "Phoenix",
      state: "AZ",
      zip: "85001",
      address: "101 Example Way",
      industry: "Fabrication",
      naics: "Fabricated Structural Metal Manufacturing",
      employees: { known: true, original: "25", count: 25, source: "actual" },
      employeeRange: "20 to 49",
      phone: "(602) 555-0101",
      website: "www.synthetic-co-001.example",
      email: false,
      otherExecutives: [{ name: "Demo Executive 001-1", title: "Vice President" }],
    });
  });

  it("gives the 10 rows with a blank IUSA Number a generated ID and a warning each", () => {
    const generated = result.importState.issues.filter((issue) => issue.code === "generated-id");
    expect(generated.map((issue) => [issue.sourceRow, issue.recordId])).toEqual([
      [8, "ROW-0007"],
      [17, "ROW-0016"],
      [26, "ROW-0025"],
      [35, "ROW-0034"],
      [44, "ROW-0043"],
      [53, "ROW-0052"],
      [62, "ROW-0061"],
      [71, "ROW-0070"],
      [80, "ROW-0079"],
      [89, "ROW-0088"],
    ]);
    expect(result.importState.issues).toHaveLength(10);
  });

  it("groups row 101 (900000100) under row 2 (900000001)", () => {
    const grouped = result.records.filter((r) => r.duplicateIds.length > 0);
    expect(grouped.map((r) => [r.normalized.recordId, r.duplicateIds, r.duplicateRows])).toEqual([
      ["900000001", ["900000100"], [101]],
    ]);
  });

  it("matches the documented rows: titles, sizes, contacts and other executives", () => {
    const title = (row: number) => {
      const t = record(row).title;
      return t.known ? t.value : null;
    };
    // Title from Professional Title (Executive Title blank), then both blank.
    expect([13, 46].map(title)).toEqual(["Owner", "General Manager"]);
    expect([10, 31, 52, 73].map(title)).toEqual([null, null, null, null]);

    // Location Employee Size Actual blank: the size comes from the range. Row 59 has neither.
    expect([19, 42, 48, 67, 82].map((row) => record(row).employees)).toEqual([
      { known: true, original: "10 to 19", min: 10, max: 19, source: "range" },
      { known: true, original: "20 to 49", min: 20, max: 49, source: "range" },
      { known: true, original: "1 to 4", min: 1, max: 4, source: "range" },
      { known: true, original: "1,000 to 4,999", min: 1000, max: 4999, source: "range" },
      { known: true, original: "100 to 249", min: 100, max: 249, source: "range" },
    ]);
    expect(record(59).employees.known).toBe(false);
    expect(record(59).employeeRange.known).toBe(false);

    // Phone blank (rows 15, 38), website blank (23, 54), both blank (86).
    const contact = (row: number) => [record(row).phone.known, record(row).website.known];
    expect([15, 38, 23, 54, 86].map(contact)).toEqual([
      [false, true],
      [false, true],
      [true, false],
      [true, false],
      [false, false],
    ]);
    expect(missingFields(record(86), result.mapping)).toEqual(["Contact"]);
    expect(missingFields(record(59), result.mapping)).toEqual(["Company size"]);

    // Other executives: 3 on row 4; row 3's slot 2 has no title; row 12's slot 1 is empty.
    expect(record(4).otherExecutives.map((e) => e.title)).toEqual(["Vice President", "Controller", "Sales Manager"]);
    expect(record(3).otherExecutives).toEqual([
      { name: "Demo Executive 002-1", title: "Vice President" },
      { name: "Demo Executive 002-2", title: null },
    ]);
    expect(record(12).otherExecutives).toEqual([
      { name: "Demo Executive 011-2", title: "Controller" },
      { name: "Demo Executive 011-3", title: "Sales Manager" },
    ]);
    expect(record(5).otherExecutives).toEqual([]);
  });
});

describe("Phoenix fabrication search and export (acceptance)", () => {
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(readRsSample(), BUSINESS_OWNER_BRIEF);
  });

  it("ranks the 25 Phoenix records with business 1 first at 100", () => {
    expect(result.rankResult.filter.counts).toEqual({
      input: 99,
      excluded: 0,
      failedMustHave: 74,
      failedOnlyMissing: 0,
      eligible: 25,
    });
    expect(result.rankResult.shortlist).toHaveLength(25);
    expect(
      result.rankResult.shortlist.slice(0, 4).map((row) => `${row.record.normalized.recordId} ${row.displayScore}`),
    ).toEqual(["900000001 100", "900000081 86", "900000041 64", "ROW-0061 64"]);
  });

  it("exports phone and website, and leaves email blank on every row", () => {
    const table = shortlistTable(result.rankResult, result.mapping);
    const column = (key: string) => table.columns.findIndex((c) => c.key === key);
    const [email, phone, website] = [column("email"), column("phone"), column("website")];
    expect(table.rows).toHaveLength(25);
    expect(table.rows.every((row) => row[email] === null)).toBe(true);
    expect([table.rows[0][phone], table.rows[0][website]]).toEqual(["(602) 555-0101", "www.synthetic-co-001.example"]);
  });
});
