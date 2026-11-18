import type { SearchBrief } from "../criteria/schema";
import { describeMapping } from "../import/describe-mapping";
import { summarizeImport, type ImportState } from "../normalize/summary";
import { compareIssues } from "../normalize/validate-rows";
import { rank } from "../ranking";
import { buildCounts } from "../ranking/counts";
import type { Overrides } from "../ranking/overrides";
import { importWorkbook } from "./import-pipeline";

/**
 * Runs a workbook through the whole chain the wizard runs (`ui/translator-wizard.tsx`), from the
 * bytes to the counts summary: parse, normalize, row checks and duplicate grouping
 * (`importWorkbook()`), then `summarizeImport()`, `rank()` and `buildCounts()`. It calls the real
 * functions in the wizard's order, so a regression anywhere in the chain shows up in the result.
 * Throws when the workbook doesn't parse.
 *
 * Returns everything a test needs:
 *
 * - `importState`: what the wizard keeps after importing (`ImportState`).
 * - `records`: the grouped records `rank()` got (499 for the sample).
 * - `importSummary`, `rankResult`, `counts`: as the Results step gets them.
 * - `mapping`: `describeMapping()` for the file, for `shortlistTable()` (TR-25).
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export async function runPipeline(buffer: ArrayBuffer, brief: SearchBrief, overrides?: Overrides) {
  const { workbook, validation, grouping } = await importWorkbook(buffer);
  const importState: ImportState = {
    parsed: workbook,
    validation,
    records: grouping.records,
    duplicateCount: grouping.duplicateCount,
    issues: [...validation.issues, ...grouping.issues].sort(compareIssues),
  };
  const importSummary = summarizeImport(importState);
  const rankResult = rank(importState.records, brief, overrides);
  const counts = buildCounts(importSummary, rankResult);
  const mapping = describeMapping(workbook.layout, workbook.headers);
  return { importState, records: importState.records, importSummary, rankResult, counts, mapping };
}
