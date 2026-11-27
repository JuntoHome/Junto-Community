import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import { buildXlsx, toArrayBuffer } from "./__fixtures__/build-workbook";
import { runPipeline } from "./__fixtures__/pipeline";
import { RS_SAMPLE_PATH, SAMPLE_PATH, syntheticRow, syntheticSheet } from "./__fixtures__/records";
import { BUSINESS_OWNER_BRIEF, JOB_SEEKER_BRIEF } from "./criteria/examples";
import type { SearchBrief } from "./criteria/schema";
import { shortlistTable } from "./export/shortlist-rows";
import { assertNoFormulas, buildWorkbook, FORMULA_BLOCKED_MESSAGE, SHORTLIST_HEADER_ROW } from "./export/workbook";
import { FILE_GATE_MESSAGES } from "./import/file-gate";
import { loadWorkbook, type LoadResult } from "./import/load";
import { parseWorkbook } from "./import/parse";
import { rank } from "./ranking";
import { diagnoseEmpty } from "./ranking/diagnose";
import { matchCriterion, prepareCriterion } from "./ranking/match";
import { contactLines, missingFields } from "./ranking/missing";
import { checkPin, PIN_MESSAGES, pinContext } from "./ranking/overrides";

/**
 * Edge cases from the spec (TR-31), end to end: each one starts from a real file (a `File` or the
 * committed sample's bytes) and goes through the same chain the wizard runs, with `loadWorkbook()`
 * for the upload path and `runPipeline()` for the rest. TR-29 and TR-30 test the functions one by
 * one; this file checks the cases hold across the whole chain.
 *
 * Reference Solutions cases use the TR-35 sample. Every row number and ID used here is listed in
 * docs/translator/README.md ("The Reference Solutions sample", "Documented rows"). Row numbers
 * are spreadsheet rows: the header is row 1, so business n is row n + 1.
 */

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const sampleBytes = () => readFileSync(SAMPLE_PATH);
const rsSampleBytes = () => readFileSync(RS_SAMPLE_PATH);
const asFile = (bytes: Uint8Array, name: string) => new File([new Uint8Array(bytes)], name, { type: XLSX_TYPE });

type Pipeline = Awaited<ReturnType<typeof runPipeline>>;

const withMustHaves = (brief: SearchBrief, mustHaves: SearchBrief["mustHaves"]): SearchBrief => ({ ...brief, mustHaves });

/** The record for spreadsheet row `sourceRow`, as it was parsed and cleaned. */
function rowAt(result: Pipeline, sourceRow: number) {
  const row = result.importState.parsed.rows.find((r) => r.sourceRow === sourceRow);
  if (!row) throw new Error(`No row ${sourceRow}`);
  return row.normalized;
}

/** The sample re-saved by ExcelJS, with `edit` applied to its first sheet first (or no edit). */
async function resavedSample(edit?: (sheet: ExcelJS.Worksheet) => void): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(toArrayBuffer(sampleBytes()));
  edit?.(workbook.worksheets[0]);
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Expects `result` to be the file gate's refusal, before anything was parsed. */
function expectGateRefusal(result: LoadResult | null) {
  expect(result).toEqual({
    ok: false,
    step: "gate",
    code: "notAllowed",
    message: FILE_GATE_MESSAGES.notAllowed,
    log: null,
  });
  expect(FILE_GATE_MESSAGES.notAllowed).toMatch(/^Only the JCA synthetic demo workbook can be used in this prototype\./);
}

describe("city not in the workbook", () => {
  const brief = withMustHaves(BUSINESS_OWNER_BRIEF, [
    { field: "city", operator: "equals", value: "Flagstaff" },
    { field: "state", operator: "equals", value: "AZ" },
  ]);

  it("gives an empty shortlist, explained by the city filter", async () => {
    const result = await runPipeline(toArrayBuffer(sampleBytes()), brief);
    expect(result.rankResult.shortlist).toEqual([]);
    expect(result.rankResult.filter.counts.eligible).toBe(0);

    const diagnosis = diagnoseEmpty(result.records, brief, result.rankResult);
    expect(diagnosis.kind).toBe("no-value");
    expect(diagnosis.hints[0]).toMatchObject({
      text: "No records are in Flagstaff. Try another city.",
      itemId: "must-geo",
    });
  });
});

describe("required title Operations Manager", () => {
  const brief = withMustHaves(BUSINESS_OWNER_BRIEF, [
    { field: "city", operator: "equals", value: "Phoenix" },
    { field: "state", operator: "equals", value: "AZ" },
    { field: "title", operator: "equals", value: "Operations Manager" },
  ]);
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(toArrayBuffer(sampleBytes()), brief);
  });

  it("keeps 25 Phoenix rows, and the 25 Phoenix rows with a blank title fail only because of it", () => {
    expect(result.rankResult.filter.counts).toMatchObject({ eligible: 25, failedOnlyMissing: 25 });
  });

  it("never lets a row with an unknown title through", () => {
    expect(result.rankResult.ranked.filter((row) => !row.record.normalized.title.known)).toEqual([]);
  });

  it("fails every Phoenix row with a blank title on the must-haves", () => {
    const blankInPhoenix = result.records.filter(
      (r) => r.normalized.city.known && r.normalized.city.value === "Phoenix" && !r.normalized.title.known,
    );
    expect(blankInPhoenix).toHaveLength(25);
    const statuses = new Set(blankInPhoenix.map((r) => result.rankResult.filter.statusById.get(r.normalized.recordId)));
    expect([...statuses]).toEqual(["failed-must-have"]);
  });
});

describe("file gate on the upload path (loadWorkbook from a File)", () => {
  it("accepts the synthetic sample and parses it", async () => {
    const result = await loadWorkbook(asFile(sampleBytes(), "JCA_Synthetic_Contacts.xlsx"));
    if (!result?.ok) throw new Error("The sample should load");
    expect(result.workbook.entry.fileName).toBe("JCA_Synthetic_Contacts.xlsx");
    expect(result.workbook.parsed.rows).toHaveLength(500);
  });

  it("refuses a copy with one cell changed, before parsing, though the copy itself is readable", async () => {
    const altered = await resavedSample((sheet) => {
      sheet.getCell("B2").value = `${sheet.getCell("B2").value} changed`;
    });

    const parsed = await parseWorkbook(toArrayBuffer(altered));
    expect(parsed.ok).toBe(true);

    expectGateRefusal(await loadWorkbook(asFile(altered, "JCA_Synthetic_Contacts.xlsx")));
  });

  it("refuses a copy opened and saved again with no edits", async () => {
    const resaved = await resavedSample();
    expect(Buffer.from(resaved).equals(sampleBytes())).toBe(false);
    expectGateRefusal(await loadWorkbook(asFile(resaved, "JCA_Synthetic_Contacts.xlsx")));
  });

  it("accepts the Reference Solutions sample, detected as Reference Solutions from its headers", async () => {
    const result = await loadWorkbook(asFile(rsSampleBytes(), "JCA_Synthetic_RS_Layout.xlsx"));
    if (!result?.ok) throw new Error("The Reference Solutions sample should load");
    expect(result.workbook.entry).toMatchObject({ fileName: "JCA_Synthetic_RS_Layout.xlsx", layout: "reference-solutions" });
    expect(result.workbook.parsed.layout.label).toBe("Reference Solutions");
    expect(result.workbook.parsed.rows).toHaveLength(100);
  });

  it("refuses a file over 2 MB at the size check, before reading it", async () => {
    const big = new Uint8Array(2 * 1024 * 1024 + 1);
    big.set([0x50, 0x4b, 0x03, 0x04]);
    expect(await loadWorkbook(asFile(big, "big.xlsx"))).toEqual({
      ok: false,
      step: "check",
      code: "tooLarge",
      message: "This file is larger than 2 MB. Please upload a smaller .xlsx file.",
      log: null,
    });
  });

  it("stops quietly when a newer file was chosen meanwhile", async () => {
    expect(await loadWorkbook(asFile(sampleBytes(), "JCA_Synthetic_Contacts.xlsx"), () => false)).toBeNull();
  });
});

describe("Reference Solutions sample (TR-35)", () => {
  /**
   * The brief for the end-to-end case: the spec's job seeker brief (Tempe, AZ must; prefer
   * Logistics, Operations Manager, 10 to 99 employees; 30 rows). It suits this file because the
   * 25 Tempe records include a phone-only row (23), a website-only row (15), range-only sizes that
   * fit (19, 10 to 19) and don't (67, 1,000 to 4,999), a row with no size (59), a blank title
   * (31) and generated IDs (35, 71).
   */
  const RS_BRIEF = JOB_SEEKER_BRIEF;
  /** Every record, unfiltered: state AZ is every row's state; 100 rows covers all 99. */
  const ALL_ROWS_BRIEF = withMustHaves({ ...BUSINESS_OWNER_BRIEF, listSize: 100 }, [
    { field: "state", operator: "equals", value: "AZ" },
  ]);
  let result: Pipeline;
  let all: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(toArrayBuffer(rsSampleBytes()), RS_BRIEF);
    all = await runPipeline(toArrayBuffer(rsSampleBytes()), ALL_ROWS_BRIEF);
  });

  it("gives the 10 documented rows with a blank IUSA Number a ROW- ID from the row number, with one warning each", () => {
    const blankRows = [8, 17, 26, 35, 44, 53, 62, 71, 80, 89];
    for (const sourceRow of blankRows) {
      const id = `ROW-${String(sourceRow - 1).padStart(4, "0")}`;
      expect(rowAt(result, sourceRow).recordId).toBe(id);
      // TR-11: a blank ID cell is a warning on that row. Some rows have an IUSA Number, so it is per row.
      expect(result.importState.issues.filter((issue) => issue.sourceRow === sourceRow)).toEqual([
        {
          sourceRow,
          recordId: id,
          code: "generated-id",
          severity: "warning",
          reason: `IUSA Number is blank, so this row was given the ID ${id}.`,
        },
      ]);
    }
  });

  it("captures other executives in slot order, skipping empty slots, through to the export", () => {
    // Row 4 (900000003) has 3; row 3 (900000002) has a slot 2 without a title; row 12 (900000011)
    // has slot 1 empty; row 5 (900000004) has none.
    expect(rowAt(all, 4).otherExecutives).toEqual([
      { name: "Demo Executive 003-1", title: "Vice President" },
      { name: "Demo Executive 003-2", title: "Controller" },
      { name: "Demo Executive 003-3", title: "Sales Manager" },
    ]);
    expect(rowAt(all, 12).otherExecutives).toEqual([
      { name: "Demo Executive 011-2", title: "Controller" },
      { name: "Demo Executive 011-3", title: "Sales Manager" },
    ]);

    const table = shortlistTable(all.rankResult, all.mapping);
    const column = (key: string) => table.columns.findIndex((c) => c.key === key);
    const exportedFor = (id: string) => table.rows.find((row) => row[column("recordId")] === id)?.[column("otherExecutives")];
    expect(table.rows).toHaveLength(99);
    expect(exportedFor("900000002")).toBe("Demo Executive 002-1 (Vice President); Demo Executive 002-2");
    expect(exportedFor("900000011")).toBe("Demo Executive 011-2 (Controller); Demo Executive 011-3 (Sales Manager)");
    expect(exportedFor("900000004")).toBeNull();
  });

  it("has no email anywhere, and lists Contact as missing only when phone and website are both blank", () => {
    const records = all.records.map((r) => r.normalized);
    expect(records.every((r) => !r.email.known)).toBe(true);
    for (const record of records) {
      const missing = missingFields(record, all.mapping);
      expect(missing).not.toContain("Email");
      expect(missing.includes("Contact")).toBe(!record.phone.known && !record.website.known);
    }
    // Only row 86 (900000085) has neither.
    expect(records.filter((r) => missingFields(r, all.mapping).includes("Contact")).map((r) => r.recordId)).toEqual([
      "900000085",
    ]);
  });

  it("reads the size from the range when the actual count is blank, and ranks it by the range fit rule", () => {
    expect([19, 42, 48, 67, 82].map((row) => rowAt(all, row).employees)).toEqual([
      { known: true, original: "10 to 19", min: 10, max: 19, source: "range" },
      { known: true, original: "20 to 49", min: 20, max: 49, source: "range" },
      { known: true, original: "1 to 4", min: 1, max: 4, source: "range" },
      { known: true, original: "1,000 to 4,999", min: 1000, max: 4999, source: "range" },
      { known: true, original: "100 to 249", min: 100, max: 249, source: "range" },
    ]);
    const tenTo99 = prepareCriterion({ field: "employees", operator: "range", value: { min: 10, max: 99 } });
    // Row 42 (900000041): 20 to 49 fits inside 10 to 99. Row 82 (900000081): 100 to 249 doesn't.
    expect(matchCriterion(rowAt(all, 42), tenTo99)).toBe("match");
    expect(matchCriterion(rowAt(all, 82), tenTo99)).toBe("no-match");
    // Row 59 (900000058) has neither column, so its size is unknown.
    expect(matchCriterion(rowAt(all, 59), tenTo99)).toBe("unknown");
  });

  it("ranks the RS brief without errors: 25 Tempe records, every reason from the record's own values", () => {
    expect(result.importState.parsed.layout.label).toBe("Reference Solutions");
    expect(result.rankResult.filter.counts).toMatchObject({ input: 99, eligible: 25, excluded: 0 });
    expect(result.rankResult.shortlist).toHaveLength(25);
    expect(rank(result.records, RS_BRIEF).shortlist.map((row) => row.reasonText)).toEqual(
      result.rankResult.shortlist.map((row) => row.reasonText),
    );

    for (const row of result.rankResult.shortlist) {
      const r = row.record.normalized;
      const text = row.reasonText;
      expect(text).toContain(`Location: Tempe, AZ (required)`);
      expect(text).toContain(r.industry.known ? `Industry: ${r.industry.value} (` : "Industry unknown");
      expect(text).toContain(r.title.known ? `Title: ${r.title.value} (` : "Title unknown");
      const e = r.employees;
      const size = !e.known
        ? "Company size unknown"
        : e.source === "actual"
          ? `Company size: ${e.count.toLocaleString("en-US")} employees (`
          : `Company size: ${e.original} employees (`;
      expect(text).toContain(size);
    }
  });

  it("falls back to phone, then website, for Contact", () => {
    const tempe = (sourceRow: number) => rowAt(result, sourceRow);
    // Row 2 has both; row 23 (900000022) phone only; row 15 (900000014) website only.
    expect(contactLines(rowAt(all, 2))).toEqual(["(602) 555-0101", "www.synthetic-co-001.example"]);
    expect(contactLines(tempe(23))).toEqual(["(480) 555-0122"]);
    expect(contactLines(tempe(15))).toEqual(["www.synthetic-co-014.example"]);
    expect(contactLines(rowAt(all, 86))).toEqual([]);
    const shortlisted = new Set(result.rankResult.shortlist.map((row) => row.record.normalized.recordId));
    expect(shortlisted.has("900000022") && shortlisted.has("900000014")).toBe(true);
  });
});

describe("pinning records that can't be pinned", () => {
  const leaveOutRetail: SearchBrief = {
    ...BUSINESS_OWNER_BRIEF,
    exclusions: [{ field: "industry", operator: "equals", value: "Retail" }],
  };
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(toArrayBuffer(sampleBytes()), leaveOutRetail);
  });

  const context = () =>
    pinContext(result.records, result.importState.validation.excluded, result.rankResult.filter.statusById);

  it("refuses SYN-0016, which the Leave out rule removed, and the shortlist stays the same", () => {
    expect(result.rankResult.filter.statusById.get("SYN-0016")).toBe("excluded");
    expect(checkPin("SYN-0016", context())).toEqual({ ok: false, message: PIN_MESSAGES.excluded("SYN-0016") });
    expect(PIN_MESSAGES.excluded("SYN-0016")).toBe("SYN-0016 can't be pinned because it matches your Leave out rule.");

    // Even if the pin reached ranking, it is dropped and nothing moves.
    const forced = rank(result.records, leaveOutRetail, { pinned: ["SYN-0016"], omitted: [] });
    expect(forced.droppedPins).toEqual(["SYN-0016"]);
    expect(forced.shortlist.map((row) => row.record.normalized.recordId)).toEqual(
      result.rankResult.shortlist.map((row) => row.record.normalized.recordId),
    );
  });

  it("refuses SYN-0500, a grouped duplicate, and names the record to pin instead", () => {
    expect(checkPin("SYN-0500", context())).toEqual({
      ok: false,
      message: "SYN-0500 is a duplicate of SYN-0001. Pin SYN-0001 instead.",
    });
  });
});

describe("formula-like text in the export", () => {
  const FORMULA_TEXT = ["=SUM(1,1)", "+1+1", "-1+2", "@SUM(1,1)"];
  const NOW = new Date("2026-11-18T10:00:00Z");
  let bytes: ArrayBuffer;
  beforeAll(async () => {
    // Invented records whose Company and Industry look like formulas.
    const rows = FORMULA_TEXT.map((text, i) => syntheticRow(i + 1, { Company: text, Industry: text }));
    const workbook = await buildXlsx({ sheets: [{ name: "Contacts", rows: syntheticSheet(rows) }] });
    const brief: SearchBrief = { ...BUSINESS_OWNER_BRIEF, preferences: [], mustHaves: [] };
    const result = await runPipeline(workbook, brief);
    expect(result.rankResult.shortlist).toHaveLength(FORMULA_TEXT.length);
    bytes = await buildWorkbook(result.rankResult, result.mapping, {
      counts: result.counts,
      source: { fileName: "formula-text.xlsx", layout: "Synthetic", sheetName: "Contacts", sha256: "0".repeat(64) },
      now: NOW,
      origin: { briefSource: "form", editedAfterAi: false, firstAiRequest: null, aiRulesVersion: "1.0" },
      introDrafts: {},
    });
  });

  it("writes every text cell as a literal string with the Text format, and keeps the values", async () => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes);
    const numberHeaders = new Set(["Rank", "Source row", "Employees", "Score"]);

    workbook.eachSheet((sheet) => {
      const header = sheet.name === "Shortlist" ? sheet.getRow(SHORTLIST_HEADER_ROW) : null;
      sheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, column) => {
          expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);
          const isNumberColumn = header !== null && rowNumber > SHORTLIST_HEADER_ROW && numberHeaders.has(String(header.getCell(column).value));
          if (isNumberColumn) {
            expect(typeof cell.value).toBe("number");
          } else {
            expect(typeof cell.value).toBe("string");
            expect(cell.numFmt).toBe("@");
          }
        });
      });
    });

    const shortlist = workbook.getWorksheet("Shortlist")!;
    const headers = (shortlist.getRow(SHORTLIST_HEADER_ROW).values as unknown[]).map(String);
    const [company, industry] = [headers.indexOf("Company"), headers.indexOf("Industry")];
    const values = [0, 1, 2, 3].map((i) => {
      const row = shortlist.getRow(SHORTLIST_HEADER_ROW + 1 + i);
      return [row.getCell(company).value, row.getCell(industry).value];
    });
    expect(values.map(([c]) => c).sort()).toEqual([...FORMULA_TEXT].sort());
    expect(values.every(([c, i]) => c === i)).toBe(true);
  });

  it("has no formula in the file's XML", async () => {
    const zip = await JSZip.loadAsync(bytes);
    const sheets = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    expect(sheets.length).toBe(2);
    for (const name of sheets) expect(await zip.file(name)!.async("string")).not.toMatch(/<f[\s>]/);
  });
});

describe("assertNoFormulas", () => {
  const workbookWith = (value: ExcelJS.CellValue) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Shortlist");
    sheet.getCell("A1").value = "Synthetic Co 001";
    sheet.getCell("B2").value = value;
    return workbook;
  };

  it("throws when a formula cell is planted", () => {
    expect(() => assertNoFormulas(workbookWith({ formula: "SUM(1,1)", date1904: false }))).toThrow(FORMULA_BLOCKED_MESSAGE);
    expect(() => assertNoFormulas(workbookWith({ formula: "SUM(1,1)", result: 2, date1904: false }))).toThrow(
      FORMULA_BLOCKED_MESSAGE,
    );
  });

  it("lets formula-like text through", () => {
    expect(() => assertNoFormulas(workbookWith("=SUM(1,1)"))).not.toThrow();
  });
});
