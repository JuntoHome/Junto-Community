import { parseWorkbook } from "../import/parse";
import { groupDuplicates } from "../normalize/duplicates";
import { normalizeWorkbook } from "../normalize/normalize";
import { validateRows } from "../normalize/validate-rows";
import { buildXlsx, type FixtureRow } from "./build-workbook";

/**
 * Runs a workbook through the import steps in the order the wizard does
 * (`ui/translator-wizard.tsx`): parse, normalize, row checks, duplicate grouping. Throws when the
 * workbook doesn't parse, naming the problem code, so a broken fixture fails loudly.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export async function importWorkbook(buffer: ArrayBuffer) {
  const parsed = await parseWorkbook(buffer);
  if (!parsed.ok) throw new Error(`The fixture workbook didn't parse: ${parsed.code}`);
  const workbook = normalizeWorkbook(parsed.workbook);
  const validation = validateRows(workbook.rows, workbook.layout);
  const grouping = groupDuplicates(validation.kept);
  return { workbook, validation, grouping };
}

/** Builds a one-sheet workbook ("Contacts") from these rows, header first, and imports it. */
export async function importRows(rows: readonly FixtureRow[]) {
  return importWorkbook(await buildXlsx({ sheets: [{ name: "Contacts", rows }] }));
}
