import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { runPipeline } from "../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import {
  askedForText,
  CRITERIA_TEXT,
  type CriteriaRow,
  criteriaTable,
  CUT_MARK,
  type ExportBriefOrigin,
  MAX_ASKED_FOR_CHARS,
} from "./criteria-rows";

/** How the criteria were set (TR-52): the rows after the brief's lines on the Criteria sheet. */

const NOW = new Date(Date.UTC(2026, 10, 27, 10));
const SOURCE = { fileName: "JCA_Synthetic_Contacts.xlsx", layout: "Synthetic", sheetName: "Contacts", sha256: "0".repeat(64) };
const FORM: ExportBriefOrigin = { briefSource: "form", editedAfterAi: false, firstAiRequest: null, aiRulesVersion: "1.0" };
const AI: ExportBriefOrigin = { ...FORM, briefSource: "ai", firstAiRequest: "owners in Phoenix" };

type Pipeline = Awaited<ReturnType<typeof runPipeline>>;

describe("Criteria sheet: how the criteria were set", () => {
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(toArrayBuffer(readFileSync(SAMPLE_PATH)), BUSINESS_OWNER_BRIEF);
  });

  const criteriaRows = (origin: ExportBriefOrigin): CriteriaRow[] => {
    const sections = criteriaTable({ rankResult: result.rankResult, counts: result.counts, source: SOURCE, now: NOW, origin });
    return sections.find((s) => s.heading === CRITERIA_TEXT.criteria)?.rows ?? [];
  };
  const labels = (rows: CriteriaRow[]) => rows.map(([label]) => label);

  it("says Form for a form brief, with no request and no AI rules version", () => {
    const rows = criteriaRows(FORM);
    expect(rows.at(-1)).toEqual(["Criteria set by", "Form"]);
    expect(labels(rows)).not.toContain("What you asked for");
    expect(labels(rows)).not.toContain("AI rules version");
  });

  it("says AI chat, what was asked and the AI rules version for an AI brief, after the brief's lines", () => {
    const rows = criteriaRows(AI);
    expect(rows.slice(-3)).toEqual([
      ["Criteria set by", "AI chat"],
      ["What you asked for", "owners in Phoenix"],
      ["AI rules version", "1.0"],
    ]);
    // The brief's own lines come first, unchanged.
    expect(rows.slice(0, -3)).toEqual(criteriaRows(FORM).slice(0, -1));
  });

  it("says AI chat, then edited after a summary edit", () => {
    expect(criteriaRows({ ...AI, editedAfterAi: true })).toContainEqual(["Criteria set by", "AI chat, then edited"]);
  });

  it("leaves out What you asked for when there is no request text", () => {
    expect(labels(criteriaRows({ ...AI, firstAiRequest: null }))).not.toContain("What you asked for");
    expect(labels(criteriaRows({ ...AI, firstAiRequest: "  \n " }))).not.toContain("What you asked for");
    expect(labels(criteriaRows({ ...AI, firstAiRequest: null }))).toContain("AI rules version");
  });

  it("ignores the first request and the edit mark on a form brief", () => {
    expect(criteriaRows({ ...FORM, firstAiRequest: "owners in Phoenix", editedAfterAi: true }).at(-1)).toEqual([
      "Criteria set by",
      "Form",
    ]);
  });
});

describe("askedForText", () => {
  it("trims and turns line breaks into single spaces", () => {
    expect(askedForText("  owners\n\nin  Phoenix \r\n please  ")).toBe("owners in  Phoenix please");
  });

  it("cuts a 400 character message with line breaks to one line of 300 characters plus the ellipsis", () => {
    const message = Array.from({ length: 8 }, (_, i) => `${String(i).repeat(49)}\n`).join("");
    expect(message.length).toBe(400);
    const text = askedForText(message);
    expect(text).not.toMatch(/[\r\n]/);
    expect(text.endsWith(CUT_MARK)).toBe(true);
    expect(CUT_MARK).toBe(String.fromCodePoint(0x2026));
    expect(Array.from(text)).toHaveLength(MAX_ASKED_FOR_CHARS + 1);
    expect(text.slice(0, 50)).toBe(`${"0".repeat(49)} `);
  });

  it("keeps a message of exactly 300 characters whole", () => {
    expect(askedForText("a".repeat(300))).toBe("a".repeat(300));
  });

  it("never cuts an emoji in half", () => {
    const text = askedForText(`${"a".repeat(299)}\u{1F600}\u{1F600}`);
    expect(text).toBe(`${"a".repeat(299)}\u{1F600}${CUT_MARK}`);
  });

  it("keeps formula-like text exactly as typed", () => {
    expect(askedForText("=SUM(1,1)")).toBe("=SUM(1,1)");
  });
});
