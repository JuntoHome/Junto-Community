import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { importRows, importWorkbook } from "../__fixtures__/import-pipeline";
import { SAMPLE_PATH, syntheticRow, syntheticSheet } from "../__fixtures__/records";
import { summarizeImport } from "./summary";

describe("duplicate grouping in the synthetic sample", () => {
  it("groups SYN-0500 under SYN-0001: 499 records, 1 duplicate, 0 possible duplicates", async () => {
    const { workbook, validation, grouping } = await importWorkbook(toArrayBuffer(readFileSync(SAMPLE_PATH)));

    expect(grouping.records).toHaveLength(499);
    expect(grouping.duplicateCount).toBe(1);
    expect(grouping.issues).toEqual([]);

    const first = grouping.records.find((record) => record.normalized.recordId === "SYN-0001");
    expect(first?.sourceRow).toBe(2);
    expect(first?.duplicateIds).toEqual(["SYN-0500"]);
    expect(first?.duplicateRows).toEqual([501]);
    expect(grouping.records.some((record) => record.normalized.recordId === "SYN-0500")).toBe(false);
    expect(grouping.records.filter((record) => record.duplicateIds.length > 0)).toHaveLength(1);

    // The counts the Preview step shows: 500 read = 0 left out + 1 grouped + 499 unique.
    expect(
      summarizeImport({
        parsed: workbook,
        validation,
        records: grouping.records,
        duplicateCount: grouping.duplicateCount,
        issues: [...validation.issues, ...grouping.issues],
      }),
    ).toEqual({
      rowsRead: 500,
      skippedEmptyRows: 0,
      duplicatesGrouped: 1,
      uniqueRecords: 499,
      rowsLeftOut: 0,
      rowsWithWarnings: 0,
    });
  });
});

describe("exact duplicates", () => {
  it("groups rows equal on every field but the Record ID, ignoring case and spacing", async () => {
    const { grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1),
        syntheticRow(2),
        syntheticRow(1, { "Record ID": "TST-0101", City: " phoenix ", Company: "TEST COMPANY 01", Employees: "25" }),
        syntheticRow(1, { "Record ID": "TST-0102" }),
      ]),
    );
    expect(grouping.records.map((record) => record.normalized.recordId)).toEqual(["TST-0001", "TST-0002"]);
    expect(grouping.records[0].duplicateIds).toEqual(["TST-0101", "TST-0102"]);
    expect(grouping.records[0].duplicateRows).toEqual([4, 5]);
    expect(grouping.duplicateCount).toBe(2);
    expect(grouping.issues).toEqual([]);
  });

  it("doesn't group a blank employee count with an invalid one", async () => {
    const { grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1, { Employees: null }),
        syntheticRow(1, { "Record ID": "TST-0101", Employees: "N/A" }),
      ]),
    );
    expect(grouping.records).toHaveLength(2);
    expect(grouping.duplicateCount).toBe(0);
    expect(grouping.issues.map((issue) => issue.reason)).toEqual([
      "Looks like the same business as row 2 (TST-0001), but Employees differs. Both are kept, so check them before using the list.",
    ]);
  });
});

describe("possible duplicates", () => {
  it("keeps both rows and warns on the later one, naming the fields that differ", async () => {
    const { validation, grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1),
        syntheticRow(2),
        syntheticRow(1, { "Record ID": "TST-0101", Title: "General Manager", Email: "manager01@example.invalid" }),
      ]),
    );
    expect(grouping.records.map((record) => record.sourceRow)).toEqual([2, 3, 4]);
    expect(grouping.duplicateCount).toBe(0);
    expect(grouping.issues).toEqual([
      {
        sourceRow: 4,
        recordId: "TST-0101",
        code: "possible-duplicate",
        severity: "warning",
        reason:
          "Looks like the same business as row 2 (TST-0001), but Title and Email differ. Both are kept, so check them before using the list.",
      },
    ]);
    expect(validation.issues).toEqual([]);
  });

  it("doesn't flag the same company in another city", async () => {
    const { grouping } = await importRows(
      syntheticSheet([syntheticRow(1), syntheticRow(1, { "Record ID": "TST-0101", City: "Tempe" })]),
    );
    expect(grouping.issues).toEqual([]);
  });

  it("never flags rows with an unknown company, city or state", async () => {
    const { grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1, { State: null, Title: "Owner" }),
        syntheticRow(1, { "Record ID": "TST-0101", State: null, Title: "General Manager" }),
      ]),
    );
    expect(grouping.issues).toEqual([]);
    expect(grouping.records).toHaveLength(2);
  });
});
