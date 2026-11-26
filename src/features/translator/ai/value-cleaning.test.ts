import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { importRows, importWorkbook } from "../__fixtures__/import-pipeline";
import { RS_SAMPLE_PATH, SAMPLE_PATH, syntheticRow, syntheticSheet } from "../__fixtures__/records";
import type { GroupedRecord } from "../normalize/duplicates";
import { MAX_SUMMARY_VALUE_CHARS } from "./guardrails";
import { MAX_INTRO_VALUE_CHARS, pickIntroFields } from "./intro";
import { buildFileSummary } from "./summary";

/**
 * Value cleaning (TR-51): whatever a workbook holds, every value that can reach the AI has no
 * control characters or line breaks, summary values are at most 80 characters and intro values at
 * most 120. These are the existing caps (TR-40, TR-48), checked, not changed.
 */

const CONTROL_OR_LINE_BREAK = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;

/** Invented rows with line breaks, tabs, control characters and long values in every text field. */
const DIRTY_ROWS = [
  syntheticRow(1, { Title: "Head\nof\tSales\u0000Team", Company: `Long\r\nCompany ${"x".repeat(300)}` }),
  syntheticRow(2, { City: `Phoenix ${"y".repeat(150)}`, Industry: "Fab\u0007rication\u2028Shop", Name: "Demo\u0085Person" }),
  syntheticRow(3, { State: "A\u000bZ", Title: `Owner ${"z".repeat(200)}` }),
];

function checkSummary(records: readonly GroupedRecord[]) {
  const summary = buildFileSummary(records, "synthetic");
  const values = [...summary.cities, ...summary.states, ...summary.industries, ...summary.titles].map((item) => item.value);
  expect(values.length).toBeGreaterThan(0);
  for (const value of values) {
    expect(value).not.toMatch(CONTROL_OR_LINE_BREAK);
    expect(value.length).toBeLessThanOrEqual(MAX_SUMMARY_VALUE_CHARS);
  }
}

function checkIntros(records: readonly GroupedRecord[]) {
  let checked = 0;
  for (const record of records) {
    const picked = pickIntroFields({ record });
    if (!picked.ok) continue;
    for (const value of Object.values(picked.intro)) {
      if (value === null) continue;
      expect(value).not.toMatch(CONTROL_OR_LINE_BREAK);
      expect(value.length).toBeLessThanOrEqual(MAX_INTRO_VALUE_CHARS);
      checked += 1;
    }
  }
  expect(checked).toBeGreaterThan(0);
}

describe("value cleaning", () => {
  it("keeps the caps at 80 for the summary and 120 for intro fields", () => {
    expect(MAX_SUMMARY_VALUE_CHARS).toBe(80);
    expect(MAX_INTRO_VALUE_CHARS).toBe(120);
  });

  it("cleans and caps invented dirty values in the summary and the intro fields", async () => {
    const { grouping } = await importRows(syntheticSheet(DIRTY_ROWS));
    checkSummary(grouping.records);
    checkIntros(grouping.records);
  });

  it.each([
    ["the synthetic sample", SAMPLE_PATH],
    ["the Reference Solutions sample", RS_SAMPLE_PATH],
  ])("cleans and caps every value from %s", async (_, path) => {
    const { grouping } = await importWorkbook(toArrayBuffer(readFileSync(path)));
    checkSummary(grouping.records);
    checkIntros(grouping.records);
  });
});
