import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { runPipeline } from "../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import { chatReducer, firstUserMessage, initialChatState, type IntroDraft, introReducer, initialIntroState, pickIntroFields, PROMPT_VERSION } from "../ai";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import type { SearchBrief } from "../criteria/schema";
import { confirmedFromAi, INITIAL_BRIEF_ORIGIN, savedInSummary, type BriefOrigin } from "../ui/brief-origin";
import type { ExportBriefOrigin } from "./criteria-rows";
import { SYNTHETIC_NOTE } from "./labels";
import {
  assertNoFormulas,
  buildWorkbook,
  CRITERIA_SHEET_NAME,
  FORMULA_BLOCKED_MESSAGE,
  INTRO_DRAFTS_HEADER_ROW,
  INTRO_DRAFTS_SHEET_NAME,
  SHORTLIST_SHEET_NAME,
} from "./workbook";

/**
 * The export with AI-set criteria and intro drafts (TR-52), end to end from the committed
 * synthetic sample: the wizard's origin rules (`ui/brief-origin.ts`) and the intro reducer make
 * the inputs, `buildWorkbook()` makes the file, and ExcelJS and JSZip read it back.
 */

const NOW = new Date(Date.UTC(2026, 10, 27, 10));
const SOURCE = { fileName: "JCA_Synthetic_Contacts.xlsx", layout: "Synthetic", sheetName: "Contacts", sha256: "0".repeat(64) };

/** The role change walkthrough: SYN-0006 first at 100, SYN-0001 at rank 7 (README, "Expected results"). */
const ROLE_CHANGE_BRIEF: SearchBrief = {
  ...BUSINESS_OWNER_BRIEF,
  preferences: BUSINESS_OWNER_BRIEF.preferences.map((criterion) =>
    criterion.field === "title" ? { field: "title", operator: "equals", value: "Operations Manager" } : criterion,
  ),
};

type Pipeline = Awaited<ReturnType<typeof runPipeline>>;
type Drafts = Record<string, IntroDraft>;
type Cell = { value: ExcelJS.CellValue; numFmt: string | undefined };

const withVersion = (origin: BriefOrigin): ExportBriefOrigin => ({ ...origin, aiRulesVersion: PROMPT_VERSION });
const FORM = withVersion(INITIAL_BRIEF_ORIGIN);

/** The first user message of a chat where `messages` were typed, as the chat panel passes it on confirm. */
function chatFirstMessage(...messages: string[]): string | null {
  let state = initialChatState();
  for (const text of messages) {
    state = chatReducer(state, { type: "send", text });
    state = chatReducer(state, { type: "received", requestId: state.requestId, reply: "OK", note: null, proposal: null });
  }
  return firstUserMessage(state);
}

/** Drafts written through the intro reducer, as the panel does: the AI's text, then the user's edit if any. */
function writeDrafts(result: Pipeline, entries: { recordId: string; aiText: string; edit?: string }[]): Drafts {
  let state = initialIntroState;
  for (const { recordId, aiText, edit } of entries) {
    const row = result.records.find((r) => r.normalized.recordId === recordId);
    if (!row) throw new Error(`No record ${recordId}`);
    const picked = pickIntroFields({ record: row });
    if (!picked.ok) throw new Error(picked.error);
    state = introReducer(state, { type: "request", recordId, intro: picked.intro, intent: "business_owner", goal: "" });
    state = introReducer(state, { type: "received", requestId: state.requestId, draft: aiText });
    if (edit !== undefined) state = introReducer(state, { type: "edit", recordId, text: edit });
  }
  return { ...state.drafts };
}

async function exportFile(result: Pipeline, origin: ExportBriefOrigin, introDrafts: Drafts = {}) {
  const bytes = await buildWorkbook(result.rankResult, result.mapping, {
    counts: result.counts,
    source: SOURCE,
    now: NOW,
    origin,
    introDrafts,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return { bytes, workbook };
}

/** Every cell of a sheet, by row, as value and number format. */
function cells(sheet: ExcelJS.Worksheet): Cell[][] {
  const rows: Cell[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const values: Cell[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => values.push({ value: cell.value, numFmt: cell.numFmt }));
    rows[rowNumber - 1] = values;
  });
  return rows;
}

/** The Criteria sheet's Item / Details pairs. */
function criteriaPairs(workbook: ExcelJS.Workbook): [string, string][] {
  const sheet = workbook.getWorksheet(CRITERIA_SHEET_NAME)!;
  const pairs: [string, string][] = [];
  sheet.eachRow((row) => pairs.push([String(row.getCell(1).value ?? ""), String(row.getCell(2).value ?? "")]));
  return pairs;
}

const detailsOf = (workbook: ExcelJS.Workbook, label: string) =>
  criteriaPairs(workbook).filter(([item]) => item === label).map(([, details]) => details);

const sheetNames = (workbook: ExcelJS.Workbook) => workbook.worksheets.map((s) => s.name);

describe("export with AI criteria and intro drafts (TR-52)", () => {
  let result: Pipeline;
  let formShortlist: Cell[][];
  beforeAll(async () => {
    result = await runPipeline(toArrayBuffer(readFileSync(SAMPLE_PATH)), ROLE_CHANGE_BRIEF);
    // Guard: the walkthrough's ranks, which the drafts cases below rely on.
    const rankOf = (id: string) => result.rankResult.shortlist.find((r) => r.record.normalized.recordId === id)?.rank;
    expect([rankOf("SYN-0006"), rankOf("SYN-0001")]).toEqual([1, 7]);
    formShortlist = cells((await exportFile(result, FORM)).workbook.getWorksheet(SHORTLIST_SHEET_NAME)!);
  });

  /** Every case leaves the Shortlist sheet exactly as the plain form export has it. */
  const expectShortlistUnchanged = (workbook: ExcelJS.Workbook) =>
    expect(cells(workbook.getWorksheet(SHORTLIST_SHEET_NAME)!)).toEqual(formShortlist);

  it("form brief, no drafts: Criteria set by Form, and only Shortlist and Criteria", async () => {
    const { workbook } = await exportFile(result, FORM);
    expect(sheetNames(workbook)).toEqual([SHORTLIST_SHEET_NAME, CRITERIA_SHEET_NAME]);
    expect(detailsOf(workbook, "Criteria set by")).toEqual(["Form"]);
    expect(detailsOf(workbook, "What you asked for")).toEqual([]);
    expect(detailsOf(workbook, "AI rules version")).toEqual([]);
  });

  it("AI brief from 'owners in Phoenix': AI chat, the request and the AI rules version", async () => {
    const origin = withVersion(confirmedFromAi(INITIAL_BRIEF_ORIGIN, chatFirstMessage("owners in Phoenix", "Owner, please")));
    const { workbook } = await exportFile(result, origin);
    expect(detailsOf(workbook, "Criteria set by")).toEqual(["AI chat"]);
    expect(detailsOf(workbook, "What you asked for")).toEqual(["owners in Phoenix"]);
    expect(detailsOf(workbook, "AI rules version")).toEqual(["1.0"]);
    // Right after the brief's lines, before the Scoring section (eachRow skips the blank row).
    const items = criteriaPairs(workbook).map(([item]) => item);
    expect(items.slice(items.indexOf("Criteria set by"), items.indexOf("Criteria set by") + 5)).toEqual([
      "Criteria set by",
      "What you asked for",
      "AI rules version",
      "Scoring",
      "Scoring version",
    ]);
    expectShortlistUnchanged(workbook);
  });

  it("AI brief, then a summary edit: AI chat, then edited", async () => {
    const ai = confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix");
    const edited = savedInSummary(ai, ROLE_CHANGE_BRIEF, { ...ROLE_CHANGE_BRIEF, listSize: 30 });
    const { workbook } = await exportFile(result, withVersion(edited));
    expect(detailsOf(workbook, "Criteria set by")).toEqual(["AI chat, then edited"]);
    expect(detailsOf(workbook, "What you asked for")).toEqual(["owners in Phoenix"]);
  });

  it("AI brief, then a Results revision confirmed: still AI chat, still the first message", async () => {
    const first = confirmedFromAi(INITIAL_BRIEF_ORIGIN, chatFirstMessage("owners in Phoenix"));
    const revised = confirmedFromAi(first, chatFirstMessage("make it Operations Manager"));
    const { workbook } = await exportFile(result, withVersion(revised));
    expect(detailsOf(workbook, "Criteria set by")).toEqual(["AI chat"]);
    expect(detailsOf(workbook, "What you asked for")).toEqual(["owners in Phoenix"]);
  });

  it("a 400 character first message with line breaks: one line, 300 characters and the ellipsis", async () => {
    const message = Array.from({ length: 8 }, (_, i) => `${String(i).repeat(49)}\n`).join("");
    expect(message.length).toBe(400);
    const { workbook } = await exportFile(result, withVersion(confirmedFromAi(INITIAL_BRIEF_ORIGIN, message)));
    const [askedFor] = detailsOf(workbook, "What you asked for");
    expect(askedFor).not.toMatch(/[\r\n]/);
    expect(Array.from(askedFor)).toHaveLength(301);
    expect(askedFor.endsWith(String.fromCodePoint(0x2026))).toBe(true);
  });

  it("a first message '=SUM(1,1)': a text cell with the Text format, value unchanged", async () => {
    const { bytes, workbook } = await exportFile(result, withVersion(confirmedFromAi(INITIAL_BRIEF_ORIGIN, "=SUM(1,1)")));
    const sheet = workbook.getWorksheet(CRITERIA_SHEET_NAME)!;
    let found: ExcelJS.Cell | null = null;
    sheet.eachRow((row) => {
      if (row.getCell(1).value === "What you asked for") found = row.getCell(2);
    });
    const cell = found as ExcelJS.Cell | null;
    expect(cell?.value).toBe("=SUM(1,1)");
    expect(cell?.type).toBe(ExcelJS.ValueType.String);
    expect(cell?.numFmt).toBe("@");
    await expectNoFormulaXml(bytes, 2);
  });

  it("two drafts: an Intro drafts sheet after Criteria, in rank order, with the edited text", async () => {
    const drafts = writeDrafts(result, [
      { recordId: "SYN-0001", aiText: "Hello from the AI.", edit: "Hello, my edited intro.\nSecond line." },
      { recordId: "SYN-0006", aiText: "Hi there, [Your name] here." },
    ]);
    const origin = withVersion(confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix"));
    const { bytes, workbook } = await exportFile(result, origin, drafts);
    expect(sheetNames(workbook)).toEqual([SHORTLIST_SHEET_NAME, CRITERIA_SHEET_NAME, INTRO_DRAFTS_SHEET_NAME]);

    const sheet = workbook.getWorksheet(INTRO_DRAFTS_SHEET_NAME)!;
    expect(sheet.getCell(1, 1).value).toBe(SYNTHETIC_NOTE);
    expect(sheet.getCell(1, 1).font?.bold).toBe(true);
    expect(SYNTHETIC_NOTE).toBe("Synthetic demonstration. All companies and people are fictional.");
    expect(sheet.getRow(2).cellCount).toBe(0);
    expect(sheet.getRow(INTRO_DRAFTS_HEADER_ROW).values).toEqual([undefined, "Rank", "Record ID", "Company", "Draft"]);
    expect(sheet.getRow(INTRO_DRAFTS_HEADER_ROW).getCell(1).font?.bold).toBe(true);

    const company = (id: string) => drafts[id].intro.company;
    expect(sheet.getRow(4).values).toEqual([undefined, 1, "SYN-0006", company("SYN-0006"), "Hi there, [Your name] here."]);
    expect(sheet.getRow(5).values).toEqual([
      undefined,
      7,
      "SYN-0001",
      company("SYN-0001"),
      "Hello, my edited intro.\nSecond line.",
    ]);
    expect(sheet.rowCount).toBe(5);

    // Layout: frozen at the header, widths, only Draft wraps, every text cell is Text.
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: INTRO_DRAFTS_HEADER_ROW });
    expect([1, 2, 3, 4].map((c) => sheet.getColumn(c).width)).toEqual([8, 14, 30, 90]);
    expect(sheet.getCell(4, 4).alignment?.wrapText).toBe(true);
    expect(sheet.getCell(4, 3).alignment?.wrapText).toBeFalsy();
    expect(sheet.getCell(4, 1).numFmt).not.toBe("@");
    for (const column of [2, 3, 4]) expect(sheet.getCell(4, column).numFmt).toBe("@");

    // The filter covers the header and both drafts.
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("xl/worksheets/sheet3.xml")!.async("string");
    expect(xml).toContain('<autoFilter ref="A3:D5"/>');
    expectShortlistUnchanged(workbook);
  });

  it("a draft for a record outside the shortlist: Not in shortlist, after the ranked ones", async () => {
    const shortlisted = new Set(result.rankResult.shortlist.map((r) => r.record.normalized.recordId));
    // Guard: SYN-0300 isn't in the 40 rows.
    expect(shortlisted.has("SYN-0300")).toBe(false);
    const drafts = writeDrafts(result, [
      { recordId: "SYN-0300", aiText: "An intro for a record that left the list." },
      { recordId: "SYN-0001", aiText: "Rank 7 intro." },
    ]);
    const { workbook } = await exportFile(result, FORM, drafts);
    const sheet = workbook.getWorksheet(INTRO_DRAFTS_SHEET_NAME)!;
    expect([4, 5].map((r) => [sheet.getCell(r, 1).value, sheet.getCell(r, 2).value])).toEqual([
      [7, "SYN-0001"],
      ["Not in shortlist", "SYN-0300"],
    ]);
    expect(sheet.getCell(5, 1).numFmt).toBe("@");
  });

  it("drafts that start with =HYPERLINK(...) or @cmd stay text, and no sheet's XML has a formula", async () => {
    const drafts = writeDrafts(result, [
      { recordId: "SYN-0006", aiText: '=HYPERLINK("http://example.invalid","click")' },
      { recordId: "SYN-0001", aiText: "Fine.", edit: "@cmd /c calc" },
    ]);
    const { bytes, workbook } = await exportFile(result, FORM, drafts);
    const sheet = workbook.getWorksheet(INTRO_DRAFTS_SHEET_NAME)!;
    for (const [row, text] of [
      [4, '=HYPERLINK("http://example.invalid","click")'],
      [5, "@cmd /c calc"],
    ] as const) {
      const cell = sheet.getCell(row, 4);
      expect(cell.value).toBe(text);
      expect(cell.type).toBe(ExcelJS.ValueType.String);
      expect(cell.numFmt).toBe("@");
    }
    await expectNoFormulaXml(bytes, 3);
  });

  it("an empty draft is skipped, and with no other draft there is no sheet", async () => {
    const drafts = writeDrafts(result, [{ recordId: "SYN-0006", aiText: "Hello.", edit: "   \n  " }]);
    const { workbook } = await exportFile(result, FORM, drafts);
    expect(sheetNames(workbook)).toEqual([SHORTLIST_SHEET_NAME, CRITERIA_SHEET_NAME]);

    const withOther = writeDrafts(result, [
      { recordId: "SYN-0006", aiText: "Hello.", edit: "" },
      { recordId: "SYN-0001", aiText: "Kept." },
    ]);
    const sheet = (await exportFile(result, FORM, withOther)).workbook.getWorksheet(INTRO_DRAFTS_SHEET_NAME)!;
    expect(sheet.rowCount).toBe(4);
    expect(sheet.getCell(4, 2).value).toBe("SYN-0001");
  });

  it("gives identical sheet contents for the same inputs twice", async () => {
    const origin = withVersion(confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix"));
    const make = () =>
      exportFile(
        result,
        origin,
        writeDrafts(result, [
          { recordId: "SYN-0001", aiText: "One.", edit: "One, edited." },
          { recordId: "SYN-0006", aiText: "Six." },
          { recordId: "SYN-0300", aiText: "Out." },
        ]),
      );
    const [a, b] = [await make(), await make()];
    expect(sheetNames(a.workbook)).toEqual(sheetNames(b.workbook));
    for (const sheet of a.workbook.worksheets) expect(cells(sheet)).toEqual(cells(b.workbook.getWorksheet(sheet.name)!));
  });
});

describe("assertNoFormulas and the Intro drafts sheet", () => {
  it("checks every sheet, so a formula planted on the third sheet blocks the export", () => {
    const workbook = new ExcelJS.Workbook();
    for (const name of [SHORTLIST_SHEET_NAME, CRITERIA_SHEET_NAME]) workbook.addWorksheet(name).getCell("A1").value = "text";
    const drafts = workbook.addWorksheet(INTRO_DRAFTS_SHEET_NAME);
    drafts.getCell("D4").value = "=SUM(1,1)";
    expect(() => assertNoFormulas(workbook)).not.toThrow();
    drafts.getCell("D5").value = { formula: "SUM(1,1)", date1904: false };
    expect(() => assertNoFormulas(workbook)).toThrow(FORMULA_BLOCKED_MESSAGE);
  });
});

/** No worksheet in the file has a formula element; `sheets` is how many worksheets it has. */
async function expectNoFormulaXml(bytes: ArrayBuffer, sheets: number) {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
  expect(names).toHaveLength(sheets);
  for (const name of names) expect(await zip.file(name)!.async("string")).not.toMatch(/<f[\s>]/);
}
