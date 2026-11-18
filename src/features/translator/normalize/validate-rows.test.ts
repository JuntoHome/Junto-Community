import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { importRows, importWorkbook } from "../__fixtures__/import-pipeline";
import {
  rsBusiness,
  rsSheet,
  SAMPLE_PATH,
  syntheticRow,
  syntheticSheet,
  withoutColumns,
} from "../__fixtures__/records";
import { ROW_ISSUE_REASONS, validateRows } from "./validate-rows";

describe("invalid employee counts", () => {
  it("flags 25.5, -3 and N/A as warnings and keeps the rows", async () => {
    const { validation } = await importRows(
      syntheticSheet([
        syntheticRow(1, { Employees: "25.5" }),
        syntheticRow(2, { Employees: "-3" }),
        syntheticRow(3, { Employees: "N/A" }),
        syntheticRow(4),
      ]),
    );
    expect(validation.kept.map((row) => row.sourceRow)).toEqual([2, 3, 4, 5]);
    expect(validation.excluded).toEqual([]);
    expect(validation.issues).toEqual([
      {
        sourceRow: 2,
        recordId: "TST-0001",
        code: "invalid-employees",
        severity: "warning",
        reason: `Employees value "25.5" isn't a whole number, so company size is treated as unknown.`,
      },
      {
        sourceRow: 3,
        recordId: "TST-0002",
        code: "invalid-employees",
        severity: "warning",
        reason: ROW_ISSUE_REASONS.invalidEmployees("-3", null),
      },
      {
        sourceRow: 4,
        recordId: "TST-0003",
        code: "invalid-employees",
        severity: "warning",
        reason: ROW_ISSUE_REASONS.invalidEmployees("N/A", null),
      },
    ]);
    // The size is unknown for ranking, with the reason kept.
    expect(validation.kept[0].normalized.employees).toEqual({ known: false, reason: "invalid", original: "25.5" });
  });

  it("doesn't flag a blank employee count", async () => {
    const { validation } = await importRows(
      syntheticSheet([syntheticRow(1, { Employees: null }), syntheticRow(2, { Employees: "   " })]),
    );
    expect(validation.issues).toEqual([]);
    expect(validation.kept).toHaveLength(2);
  });

  it("finds 0 issues in the synthetic sample: 500 kept, 0 excluded", async () => {
    const { validation } = await importWorkbook(toArrayBuffer(readFileSync(SAMPLE_PATH)));
    expect(validation.issues).toEqual([]);
    expect(validation.kept).toHaveLength(500);
    expect(validation.excluded).toEqual([]);
  });
});

describe("duplicate Record IDs", () => {
  it("keeps the first row and excludes later ones, naming the first row", async () => {
    const { validation } = await importRows(
      syntheticSheet([
        syntheticRow(1),
        syntheticRow(2),
        syntheticRow(3, { "Record ID": "TST-0001" }),
      ]),
    );
    expect(validation.kept.map((row) => row.sourceRow)).toEqual([2, 3]);
    expect(validation.excluded.map((row) => row.sourceRow)).toEqual([4]);
    expect(validation.issues).toEqual([
      {
        sourceRow: 4,
        recordId: "TST-0001",
        code: "duplicate-id",
        severity: "excluded",
        reason: "Record ID TST-0001 is also used on row 2. Row 2 is used and this row is left out.",
      },
    ]);
  });

  it("compares IDs ignoring case and outer spaces", async () => {
    const { validation } = await importRows(
      syntheticSheet([
        syntheticRow(1),
        syntheticRow(2, { "Record ID": " tst-0001 " }),
        syntheticRow(3, { "Record ID": "Tst-0001" }),
        syntheticRow(4, { "Record ID": "TST-00010" }),
      ]),
    );
    expect(validation.kept.map((row) => row.normalized.recordId)).toEqual(["TST-0001", "TST-00010"]);
    expect(validation.excluded.map((row) => row.normalized.recordId)).toEqual(["tst-0001", "Tst-0001"]);
    expect(validation.issues.map((issue) => [issue.sourceRow, issue.code, issue.reason])).toEqual([
      [3, "duplicate-id", ROW_ISSUE_REASONS.duplicateId("tst-0001", 2)],
      [4, "duplicate-id", ROW_ISSUE_REASONS.duplicateId("Tst-0001", 2)],
    ]);
  });

  it("keeps the lowest row number even when a row is out of order", async () => {
    // Rows reach validateRows in sheet order; this checks it doesn't rely on that.
    const { workbook } = await importRows(
      syntheticSheet([syntheticRow(1), syntheticRow(2, { "Record ID": "TST-0001" })]),
    );
    const result = validateRows([...workbook.rows].reverse(), workbook.layout);
    expect(result.kept.map((row) => row.sourceRow)).toEqual([2]);
    expect(result.excluded.map((row) => row.sourceRow)).toEqual([3]);
  });
});

describe("generated IDs", () => {
  it("warns once per row for a synthetic row with a blank Record ID", async () => {
    const { validation } = await importRows(syntheticSheet([syntheticRow(1), syntheticRow(2, { "Record ID": null })]));
    expect(validation.issues).toEqual([
      {
        sourceRow: 3,
        recordId: "ROW-0002",
        code: "generated-id",
        severity: "warning",
        reason: "Record ID is blank, so this row was given the ID ROW-0002.",
      },
    ]);
  });

  /** Rows 2 to 17: TST-0001 to TST-0015, then row 17 with these cells. */
  const sixteenRows = (row17: Parameters<typeof syntheticRow>[1]) =>
    syntheticSheet([...Array.from({ length: 15 }, (_, i) => syntheticRow(i + 1)), syntheticRow(16, row17)]);

  it("doesn't warn when a row's own ID only looks generated (ROW-0016 on row 17)", async () => {
    const { validation } = await importRows(sixteenRows({ "Record ID": "ROW-0016" }));
    expect(validation.kept[15].sourceRow).toBe(17);
    expect(validation.kept[15].normalized.recordId).toBe("ROW-0016");
    expect(validation.kept[15].record.idGenerated).toBe(false);
    expect(validation.issues).toEqual([]);
  });

  it("warns when row 17's Record ID is blank, with the generated ID ROW-0016", async () => {
    const { validation } = await importRows(sixteenRows({ "Record ID": null }));
    expect(validation.kept[15].record.idGenerated).toBe(true);
    expect(validation.issues).toEqual([
      {
        sourceRow: 17,
        recordId: "ROW-0016",
        code: "generated-id",
        severity: "warning",
        reason: ROW_ISSUE_REASONS.generatedId("Record ID", "ROW-0016"),
      },
    ]);
  });

  it("gives one whole-file issue for a Reference Solutions file with no IUSA Number column", async () => {
    const { validation } = await importRows(
      withoutColumns(rsSheet([rsBusiness(1), rsBusiness(2), rsBusiness(3)]), ["IUSA Number"]),
    );
    expect(validation.kept.map((row) => row.normalized.recordId)).toEqual(["ROW-0001", "ROW-0002", "ROW-0003"]);
    expect(validation.issues).toEqual([
      {
        sourceRow: null,
        recordId: null,
        code: "generated-id",
        severity: "warning",
        reason: ROW_ISSUE_REASONS.generatedIdEveryRow("IUSA Number"),
      },
    ]);
  });
});
