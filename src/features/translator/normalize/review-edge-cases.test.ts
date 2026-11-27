import { describe, expect, it } from "vitest";
import { importRows } from "../__fixtures__/import-pipeline";
import { rsBusiness, rsSheet, syntheticRow, syntheticSheet } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { rank } from "../ranking";
import { fieldOptions } from "./field-options";
import { matchKey } from "./match-key";

/**
 * Three Phase 1 edge cases found in the review after TR-55 (fix C). None can happen with the two
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
