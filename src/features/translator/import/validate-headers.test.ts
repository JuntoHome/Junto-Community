import { describe, expect, it } from "vitest";
import { buildXlsx, type FixtureRow } from "../__fixtures__/build-workbook";
import { RS_HEADERS } from "../__fixtures__/rs-headers";
import {
  SYNTHETIC_HEADERS,
  rsBusiness,
  rsSheet,
  syntheticRow,
  syntheticSheet,
  withoutColumns,
} from "../__fixtures__/records";
import { REFERENCE_SOLUTIONS_MAPPING } from "./mappings/reference-solutions";
import { SYNTHETIC_MAPPING } from "./mappings/synthetic";
import { parseWorkbook } from "./parse";
import { HEADER_MESSAGES, validateHeaders } from "./validate-headers";

const parseRows = async (rows: readonly FixtureRow[]) =>
  parseWorkbook(await buildXlsx({ sheets: [{ name: "Contacts", rows }] }));

const SYNTHETIC = syntheticSheet([syntheticRow(1), syntheticRow(2)]);
const REFERENCE = rsSheet([rsBusiness(1), rsBusiness(2)]);

describe("missing required headers", () => {
  it("synthetic without City gives exactly: Missing required columns: City", async () => {
    expect(await parseRows(withoutColumns(SYNTHETIC, ["City"]))).toEqual({
      ok: false,
      code: "missingRequired",
      message: "Missing required columns: City",
      hint: HEADER_MESSAGES.missingRequiredHint,
      missing: ["City"],
    });
  });

  it("lists two missing columns in the mapping's order, not the file's", async () => {
    // State comes after Company in the mapping; reversing the file's columns must not change that.
    const reversed = withoutColumns(SYNTHETIC, ["Company", "State"]).map((row) => [...row].reverse());
    const result = await parseRows(reversed);
    expect(result).toMatchObject({
      ok: false,
      code: "missingRequired",
      message: "Missing required columns: Company, State",
      missing: ["Company", "State"],
    });
  });

  it("Reference Solutions without City says City is missing, not that the file is unrecognized", async () => {
    expect(await parseRows(withoutColumns(REFERENCE, ["City"]))).toMatchObject({
      ok: false,
      code: "missingRequired",
      message: "Missing required columns: City",
      missing: ["City"],
    });
  });

  it("checks the headers before reading any data row", () => {
    // Called with the header row alone: no rows are needed to report the problem.
    const headers = SYNTHETIC_HEADERS.filter((header) => header !== "Industry");
    expect(validateHeaders(SYNTHETIC_MAPPING, headers)).toEqual({
      ok: false,
      code: "missingRequired",
      message: "Missing required columns: Industry",
      missing: ["Industry"],
    });
  });
});

describe("optional headers", () => {
  it("synthetic without Email still loads, with email unknown", async () => {
    const result = await parseRows(withoutColumns(SYNTHETIC, ["Email"]));
    if (!result.ok) throw new Error(`Expected the workbook to load, got ${result.code}`);
    expect(result.workbook.missingOptional).toEqual(["Email"]);
    expect(result.workbook.rows.map((row) => row.record.email)).toEqual([null, null]);
  });

  it("Reference Solutions without IUSA Number still loads, with generated IDs", async () => {
    const result = await parseRows(withoutColumns(REFERENCE, ["IUSA Number"]));
    if (!result.ok) throw new Error(`Expected the workbook to load, got ${result.code}`);
    expect(result.workbook.layout.id).toBe("reference-solutions");
    expect(result.workbook.missingOptional).toEqual(["IUSA Number"]);
    expect(result.workbook.rows.map((row) => row.record.recordId)).toEqual(["ROW-0001", "ROW-0002"]);
  });

  it("the full Reference Solutions header row has every mapped column", () => {
    expect(validateHeaders(REFERENCE_SOLUTIONS_MAPPING, RS_HEADERS)).toEqual({
      ok: true,
      missingOptional: [],
      duplicates: [],
    });
  });
});

describe("duplicate headers", () => {
  it("stops when a required header appears twice", async () => {
    const sheet = SYNTHETIC.map((row, i) => [...row, i === 0 ? " city " : "Tempe"]);
    expect(await parseRows(sheet)).toEqual({
      ok: false,
      code: "duplicateRequired",
      message: "The column City appears more than once. Keep one and upload again.",
    });
  });

  it("allows an optional header twice and uses the first one", async () => {
    const sheet = SYNTHETIC.map((row, i) => [...row, i === 0 ? "Email" : "second@example.invalid"]);
    const result = await parseRows(sheet);
    if (!result.ok) throw new Error(`Expected the workbook to load, got ${result.code}`);
    expect(result.workbook.rows[0].record.email).toBe("person01@example.invalid");
    expect(validateHeaders(SYNTHETIC_MAPPING, [...SYNTHETIC_HEADERS, "Email"])).toMatchObject({
      ok: true,
      duplicates: ["Email"],
    });
  });
});
