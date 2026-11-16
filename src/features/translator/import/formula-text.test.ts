import { describe, expect, it } from "vitest";
import { importRows } from "../__fixtures__/import-pipeline";
import { syntheticRow, syntheticSheet } from "../__fixtures__/records";

/**
 * Text that looks like a formula (it starts with =, +, - or @) must come through import and
 * cleaning as the same literal text: never evaluated, never stripped, never prefixed. The export
 * side (writing it back safely) is TR-27 and is tested with the export in TR-31.
 */

const FORMULA_LIKE = {
  Company: "=SUM(1,1)",
  Name: "+1 602 555 0100",
  Title: "-5 units",
  Industry: "@cmd",
} as const;

describe("formula-like text", () => {
  it("survives parse and normalize unchanged", async () => {
    const { workbook } = await importRows(syntheticSheet([syntheticRow(1, FORMULA_LIKE)]));
    const [row] = workbook.rows;

    // Read from the file as plain text cells, not as formulas or numbers.
    expect(row.sourceValues.slice(1, 4)).toEqual(["=SUM(1,1)", "+1 602 555 0100", "-5 units"]);
    expect(row.sourceValues[6]).toBe("@cmd");

    // Mapped as is.
    expect(row.record).toMatchObject({
      company: "=SUM(1,1)",
      name: "+1 602 555 0100",
      title: "-5 units",
      industry: "@cmd",
    });

    // Cleaned without changing a character.
    const { company, name, title, industry } = row.normalized;
    expect(company).toEqual({ known: true, original: "=SUM(1,1)", value: "=SUM(1,1)" });
    expect(name).toEqual({ known: true, original: "+1 602 555 0100", value: "+1 602 555 0100" });
    expect(title).toMatchObject({ known: true, original: "-5 units", value: "-5 units", key: "-5 units" });
    expect(industry).toMatchObject({ known: true, original: "@cmd", value: "@cmd", key: "@cmd" });
  });

  it("an employees value that looks like a formula is flagged as invalid, not calculated", async () => {
    const { workbook, validation } = await importRows(syntheticSheet([syntheticRow(1, { Employees: "=10+15" })]));
    expect(workbook.rows[0].record.employees).toBe("=10+15");
    expect(workbook.rows[0].normalized.employees).toEqual({ known: false, reason: "invalid", original: "=10+15" });
    expect(validation.kept).toHaveLength(1);
    expect(validation.issues.map((issue) => issue.code)).toEqual(["invalid-employees"]);
  });
});
