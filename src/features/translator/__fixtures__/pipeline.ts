import { expect } from "vitest";
import { type MustHaveField, type PickerOption, toBrief } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import { briefToFormState } from "../criteria/to-form";
import { describeMapping } from "../import/describe-mapping";
import type { GroupedRecord } from "../normalize/duplicates";
import { fieldOptions } from "../normalize/field-options";
import { summarizeImport, type ImportState } from "../normalize/summary";
import { compareIssues } from "../normalize/validate-rows";
import { rank, type RankResult, type ShortlistRow } from "../ranking";
import { buildCounts } from "../ranking/counts";
import type { Overrides } from "../ranking/overrides";
import { importWorkbook } from "./import-pipeline";

/**
 * Imports a workbook the way the wizard does (`ui/translator-wizard.tsx`), up to the point where
 * a brief is needed: parse, normalize, row checks and duplicate grouping (`importWorkbook()`),
 * then `summarizeImport()` and `describeMapping()`. Also gives the criteria pickers' options
 * (`fieldOptions()`), which `toBrief()` needs. Throws when the workbook doesn't parse.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export async function loadFile(buffer: ArrayBuffer) {
  const { workbook, validation, grouping } = await importWorkbook(buffer);
  const importState: ImportState = {
    parsed: workbook,
    validation,
    records: grouping.records,
    duplicateCount: grouping.duplicateCount,
    issues: [...validation.issues, ...grouping.issues].sort(compareIssues),
  };
  const records = importState.records;
  return {
    importState,
    records,
    importSummary: summarizeImport(importState),
    mapping: describeMapping(workbook.layout, workbook.headers),
    options: pickerOptions(records),
  };
}

export type LoadedFile = Awaited<ReturnType<typeof loadFile>>;

/** The values each criteria picker offers for these records (`fieldOptions()`), as `toBrief()` needs them. */
export function pickerOptions(records: readonly GroupedRecord[]): Record<MustHaveField, PickerOption[]> {
  return {
    city: fieldOptions(records, "city"),
    state: fieldOptions(records, "state"),
    industry: fieldOptions(records, "industry"),
    title: fieldOptions(records, "title"),
  };
}

/** The same file with its grouped records in another order (a shuffle), and the pickers built from them. */
export function withRecords(file: LoadedFile, records: GroupedRecord[]): LoadedFile {
  return { ...file, records, options: pickerOptions(records) };
}

/**
 * Runs a workbook through the whole chain the wizard runs (`ui/translator-wizard.tsx`), from the
 * bytes to the counts summary: `loadFile()`, then `rank()` and `buildCounts()`. It calls the real
 * functions in the wizard's order, so a regression anywhere in the chain shows up in the result.
 * Throws when the workbook doesn't parse.
 *
 * Returns everything a test needs:
 *
 * - `importState`: what the wizard keeps after importing (`ImportState`).
 * - `records`: the grouped records `rank()` got (499 for the sample).
 * - `importSummary`, `rankResult`, `counts`: as the Results step gets them.
 * - `mapping`: `describeMapping()` for the file, for `shortlistTable()` (TR-25).
 */
export async function runPipeline(buffer: ArrayBuffer, brief: SearchBrief, overrides?: Overrides) {
  const { importState, records, importSummary, mapping } = await loadFile(buffer);
  const rankResult = rank(records, brief, overrides);
  const counts = buildCounts(importSummary, rankResult);
  return { importState, records, importSummary, rankResult, counts, mapping };
}

/**
 * Confirm and rank on the AI's proposal card (TR-45, TR-46), the way `confirmAiBrief()` in
 * `ui/translator-wizard.tsx` does it, with no shortcut straight to `rank()`:
 *
 * 1. the form becomes `briefToFormState(proposal)`;
 * 2. `toBrief()` turns that form back into a brief, which must deep-equal the proposal (so the
 *    form, the criteria summary's editors and the ranked brief all agree);
 * 3. that brief becomes the pending brief, then the confirmed brief;
 * 4. `rank()` ranks the confirmed brief, and `buildCounts()` gives the counts summary.
 *
 * Fails the test when step 2 doesn't give the proposal back.
 */
export function confirmAiProposal(proposal: SearchBrief, file: LoadedFile, overrides?: Overrides) {
  const form = briefToFormState(proposal);
  const built = toBrief(form, file.options);
  expect(built, "toBrief(briefToFormState(proposal)) must give the proposal back").toStrictEqual({ ok: true, brief: proposal });
  if (!built.ok) throw new Error("unreachable: checked above");
  const pendingBrief: SearchBrief = built.brief;
  const confirmedBrief: SearchBrief = pendingBrief;
  const rankResult = rank(file.records, confirmedBrief, overrides);
  const counts = buildCounts(file.importSummary, rankResult);
  return { form, pendingBrief, confirmedBrief, rankResult, counts };
}

/** What a walkthrough golden file (`walkthroughs/*.json`, TR-30) holds for each shortlist row. */
export type GoldenRow = { rank: number; recordId: string; displayScore: number; reasonText: string };

/** A shortlist row as a golden file holds it. */
export const goldenRow = (row: ShortlistRow): GoldenRow => ({
  rank: row.rank,
  recordId: row.record.normalized.recordId,
  displayScore: row.displayScore,
  reasonText: row.reasonText,
});

/** The whole shortlist as a golden file holds it, to compare with one row for row. */
export const goldenRows = (result: RankResult): GoldenRow[] => result.shortlist.map(goldenRow);
