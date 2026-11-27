import { describe, expect, it } from "vitest";
import { importRows } from "../__fixtures__/import-pipeline";
import { rsBusiness, rsSheet, syntheticRow, syntheticSheet } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { rank } from "../ranking";
import { fieldOptions } from "./field-options";
import { matchKey } from "./match-key";
import { normalizeEmployees } from "./normalize";

/**
 * Phase 1 edge cases found in the review after TR-55: three in fix C, the size range warning
 * and the strict employee count in the follow-up. None can happen with the two
 * synthetic samples; all could with a real export. Every row here is invented.
 */

describe("a generated ID the file itself also uses", () => {
  it("gets the first free suffix, so both businesses are kept", async () => {
    // Row 2 has a blank Record ID, so it is given ROW-0001; row 3 really is ROW-0001.
    const { validation, grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1, { "Record ID": null, Company: "Test Company Blank" }),
        syntheticRow(2, { "Record ID": "ROW-0001", Company: "Test Company Real" }),
      ]),
    );
    expect(validation.excluded).toEqual([]);
    expect(validation.issues.map((issue) => issue.code)).toEqual(["generated-id"]);
    expect(validation.issues[0].reason).toBe("Record ID is blank, so this row was given the ID ROW-0001-2.");
    const ids = grouping.records.map((record) => [record.normalized.recordId, record.record.recordId, record.normalized.company]);
    expect(ids).toEqual([
      ["ROW-0001-2", "ROW-0001-2", expect.objectContaining({ value: "Test Company Blank" })],
      ["ROW-0001", "ROW-0001", expect.objectContaining({ value: "Test Company Real" })],
    ]);
  });

  it("skips a suffix the file uses too, comparing IDs as match keys", async () => {
    const { validation, grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1, { "Record ID": null, Company: "Test Company Blank" }),
        syntheticRow(2, { "Record ID": " row-0001 ", Company: "Test Company Real" }),
        syntheticRow(3, { "Record ID": "ROW-0001-2", Company: "Test Company Other" }),
      ]),
    );
    expect(validation.excluded).toEqual([]);
    expect(grouping.records.map((record) => record.normalized.recordId)).toEqual(["ROW-0001-3", "row-0001", "ROW-0001-2"]);
  });

  it("leaves a generated ID nothing collides with as it is", async () => {
    const { grouping } = await importRows(syntheticSheet([syntheticRow(1, { "Record ID": null }), syntheticRow(2)]));
    expect(grouping.records.map((record) => record.normalized.recordId)).toEqual(["ROW-0001", "TST-0002"]);
  });
});

describe("invisible characters", () => {
  const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
  const SOFT_HYPHEN = String.fromCharCode(0xad);
  const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

  it("don't split a value: three Phoenix spellings are one picker option, and a Phoenix must-have keeps all three", async () => {
    const { grouping } = await importRows(
      syntheticSheet([
        syntheticRow(1, { City: "Phoenix" }),
        syntheticRow(2, { City: `Phoenix${ZERO_WIDTH_SPACE}` }),
        syntheticRow(3, { City: `Pho${SOFT_HYPHEN}enix` }),
        syntheticRow(4, { City: `${BYTE_ORDER_MARK}Phoenix` }),
      ]),
    );
    expect(fieldOptions(grouping.records, "city")).toEqual([expect.objectContaining({ label: "Phoenix", count: 4 })]);
    // The shown value has no invisible character either.
    for (const record of grouping.records) expect(record.normalized.city).toMatchObject({ known: true, value: "Phoenix" });
    const result = rank(grouping.records, BUSINESS_OWNER_BRIEF);
    expect(result.filter.counts.eligible).toBe(4);
  });

  it("are left out of the match key", () => {
    expect(matchKey(`Pho${SOFT_HYPHEN}enix${ZERO_WIDTH_SPACE}`)).toBe("phoenix");
  });
});

describe("a blank employee count and an invalid one, with the same size range", () => {
  it("don't group as duplicates: blank and N/A stay different", async () => {
    const same = { "Location Employee Size Range": "10 to 19" };
    const { grouping } = await importRows(
      rsSheet([
        rsBusiness(1, { ...same, "Location Employee Size Actual": null }),
        rsBusiness(1, { ...same, "IUSA Number": "900000002", "Location Employee Size Actual": "N/A" }),
      ]),
    );
    expect(grouping.duplicateCount).toBe(0);
    expect(grouping.records).toHaveLength(2);
  });

  it("still group when both counts are blank and the range is the same (control)", async () => {
    const same = { "Location Employee Size Range": "10 to 19", "Location Employee Size Actual": null };
    const { grouping } = await importRows(
      rsSheet([rsBusiness(1, same), rsBusiness(1, { ...same, "IUSA Number": "900000002" })]),
    );
    expect(grouping.duplicateCount).toBe(1);
  });
});

describe("an unreadable size range", () => {
  it("gets a warning when it was needed: a blank or invalid count and range text no format reads", async () => {
    const { validation, grouping } = await importRows(
      rsSheet([
        rsBusiness(1, { "Location Employee Size Actual": null, "Location Employee Size Range": "Unknown" }),
        rsBusiness(2, { "Location Employee Size Actual": null, "Location Employee Size Range": "10 to 19" }),
        rsBusiness(3, { "Location Employee Size Actual": 25, "Location Employee Size Range": "Unknown" }),
      ]),
    );
    expect(validation.issues.filter((issue) => issue.code === "unreadable-range")).toEqual([
      expect.objectContaining({
        sourceRow: 2,
        severity: "warning",
        reason: `Employee size range "Unknown" isn't a format the Translator can read, so company size is treated as unknown.`,
      }),
    ]);
    // Every row is kept; the first one has an unknown size.
    expect(grouping.records).toHaveLength(3);
    expect(grouping.records[0].normalized.employees.known).toBe(false);
  });
});

describe("the employee count", () => {
  it("reads digits, correct thousands commas and spaces at the ends", () => {
    for (const [cell, count] of [["25", 25], ["1,200", 1200], [" 40 ", 40], ["12,345,678", 12345678]] as const) {
      expect(normalizeEmployees(cell, null)).toMatchObject({ known: true, count, source: "actual" });
    }
  });

  it("treats misplaced commas or inner spaces as invalid, never as a different number", () => {
    for (const cell of ["1,2,3", "12 34", "1,5", "1,20", ",120"]) {
      expect(normalizeEmployees(cell, null)).toMatchObject({ known: false, reason: "invalid" });
    }
  });
});
