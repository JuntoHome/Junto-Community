import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { runPipeline } from "../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import type { BriefCriterion, SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import { rank, type RankResult } from "../ranking";
import { NO_OVERRIDES, type Overrides, pin } from "../ranking/overrides";
import { diffBriefs } from "./diff-brief";
import { EXPLAIN_TEXT, explainChange } from "./explain-change";

/**
 * TR-47: the explanation after a change, on the committed synthetic sample with the business owner
 * brief (Phoenix, AZ must-have; prefer Fabrication, Owner, 10 to 99 employees; 40 rows) as the
 * starting point, as in the spec walkthroughs.
 */

const BASE = BUSINESS_OWNER_BRIEF;

/** `brief` with its preference on `field` set to `value`. */
const prefer = (brief: SearchBrief, field: "industry" | "title", value: string): SearchBrief => ({
  ...brief,
  preferences: brief.preferences.map((c) => (c.field === field ? { field, operator: "equals", value } : c)),
});

const mustCity = (brief: SearchBrief, city: string): SearchBrief => ({
  ...brief,
  mustHaves: brief.mustHaves.map((c): BriefCriterion => (c.field === "city" ? { field: "city", operator: "equals", value: city } : c)),
});

const ROLE_CHANGE = prefer(BASE, "title", "Operations Manager");

let records: readonly GroupedRecord[];
let before: RankResult;

beforeAll(async () => {
  ({ records, rankResult: before } = await runPipeline(toArrayBuffer(readFileSync(SAMPLE_PATH)), BASE));
});

/** The explanation for changing the business owner brief to `next`, with the same `overrides` on both sides. */
function explainTo(next: SearchBrief, overrides: Overrides = NO_OVERRIDES): string[] {
  const from = overrides === NO_OVERRIDES ? before : rank(records, BASE, overrides);
  return explainChange({ before: from, after: rank(records, next, overrides), changes: diffBriefs(BASE, next) });
}

const idsOf = (result: RankResult) => result.shortlist.map((row) => row.record.normalized.recordId);

describe("explainChange", () => {
  it("starts from the business owner walkthrough: SYN-0001 first at 100", () => {
    expect(before.shortlist[0].record.normalized.recordId).toBe("SYN-0001");
    expect(before.shortlist[0].displayScore).toBe(100);
  });

  it("explains the role change: the new top with its quoted reason and tie, then where SYN-0001 went", () => {
    expect(explainTo(ROLE_CHANGE)).toEqual([
      "Synthetic Company 0006 (SYN-0006) is now #1 with score 100: Title: Operations Manager (preferred). It's tied with 5 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) is now #7 with score 64: Title: Owner (not preferred).",
    ]);
  });

  it("quotes the rows' own reason text, not a rewording", () => {
    const after = rank(records, ROLE_CHANGE);
    const top = after.shortlist[0];
    const titleReason = top.reasons.find((reason) => reason.dimension === "title");
    expect(explainTo(ROLE_CHANGE)[0]).toContain(`: ${titleReason?.text}.`);
  });

  it("counts the tie from the ranking: rows with exactly the top score, ordered by Record ID", () => {
    const after = rank(records, ROLE_CHANGE);
    const tied = after.ranked.filter((row) => row.score === after.shortlist[0].score);
    expect(tied).toHaveLength(6);
    expect(tied[0].record.normalized.recordId).toBe("SYN-0006");
  });

  it("explains a list size change: the new size, then the same top with no moves", () => {
    expect(explainTo({ ...BASE, listSize: 30 })).toEqual([
      "Your list now shows 30 records.",
      "The top record is the same. No records changed position.",
    ]);
  });

  it("says the old top is outside the list, with its real place, when it still matches", () => {
    const next = prefer(prefer(BASE, "industry", "Logistics"), "title", "Operations Manager");
    const after = rank(records, next);
    // Its real place: 41st of the eligible rows, one past the list of 40.
    expect(after.ranked.findIndex((row) => row.record.normalized.recordId === "SYN-0001")).toBe(40);
    expect(after.filter.statusById.get("SYN-0001")).toBe("eligible");
    expect(explainTo(next)).toEqual([
      "Synthetic Company 0106 (SYN-0106) is now #1 with score 100: Industry: Logistics (preferred); Title: Operations Manager (preferred). It's tied with 3 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) is now #41, outside your list of 40.",
    ]);
  });

  it("says the old top no longer matches when the must-have city changes to Tempe", () => {
    expect(explainTo(mustCity(BASE, "Tempe"))).toEqual([
      "Synthetic Company 0022 (SYN-0022) is now #1 with score 86: Location: Tempe, AZ (required). It's tied with 4 others at 86; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) no longer matches your criteria.",
    ]);
  });

  it("names SYN-0002 with its required and preferred reasons for Tempe, Logistics and Operations Manager", () => {
    const next = mustCity(prefer(ROLE_CHANGE, "industry", "Logistics"), "Tempe");
    expect(explainTo(next)).toEqual([
      "Synthetic Company 0002 (SYN-0002) is now #1 with score 100: Location: Tempe, AZ (required); Industry: Logistics (preferred); Title: Operations Manager (preferred). It's tied with 6 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) no longer matches your criteria.",
    ]);
  });

  it("compares the first unpinned rows when SYN-0496 is pinned, and ends with the pin line", () => {
    const overrides = pin(NO_OVERRIDES, "SYN-0496");
    expect(idsOf(rank(records, BASE, overrides)).slice(0, 2)).toEqual(["SYN-0496", "SYN-0001"]);
    expect(explainTo(ROLE_CHANGE, overrides)).toEqual([
      "Synthetic Company 0006 (SYN-0006) is now #2 with score 100: Title: Operations Manager (preferred). It's tied with 5 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) is now #8 with score 64: Title: Owner (not preferred).",
      EXPLAIN_TEXT.pinned,
    ]);
  });

  it("gives the same-top line with the right counts when only the order below the top changes", () => {
    const next: SearchBrief = { ...BASE, priorityOrder: ["employees", "industry", "title"] };
    const after = rank(records, next);
    // Counted independently: rows in both lists at a different rank, and rows new to the list.
    const rankBefore = new Map(before.shortlist.map((row) => [row.record.normalized.recordId, row.rank]));
    const moved = after.shortlist.filter((row) => {
      const old = rankBefore.get(row.record.normalized.recordId);
      return old !== undefined && old !== row.rank;
    }).length;
    const entered = after.shortlist.filter((row) => !rankBefore.has(row.record.normalized.recordId)).length;
    expect([moved, entered]).toEqual([20, 19]);
    expect(explainTo(next)).toEqual(["The top record is the same. 20 records changed position. 19 are new in the list."]);
  });

  it("says only that nothing matches when the change leaves no rows", () => {
    const next: SearchBrief = { ...BASE, exclusions: [{ field: "city", operator: "equals", value: "Phoenix" }] };
    expect(rank(records, next).shortlist).toHaveLength(0);
    expect(explainTo(next)).toEqual([EXPLAIN_TEXT.noMatches]);
  });

  it("uses singular words for one", () => {
    expect(EXPLAIN_TEXT.tied(1, 86)).toBe(" It's tied with 1 other at 86; ties are ordered by Record ID.");
    expect(EXPLAIN_TEXT.sameTop(1)).toBe("The top record is the same. 1 record changed position.");
    expect(EXPLAIN_TEXT.entered(1)).toBe(" 1 is new in the list.");
    expect(EXPLAIN_TEXT.listShows(1)).toBe("Your list now shows 1 record.");
  });

  it("gives identical text for the same inputs, with one to three sentences and no em-dashes", () => {
    const briefs: SearchBrief[] = [
      ROLE_CHANGE,
      { ...BASE, listSize: 30 },
      mustCity(BASE, "Tempe"),
      prefer(prefer(BASE, "industry", "Logistics"), "title", "Operations Manager"),
    ];
    for (const next of briefs) {
      const first = explainTo(next);
      expect(explainTo(structuredClone(next))).toEqual(first);
      expect(first.length).toBeGreaterThanOrEqual(1);
      expect(first.length).toBeLessThanOrEqual(3);
      for (const line of first) expect(line).not.toMatch(/[\u2013\u2014]/);
    }
    for (const text of Object.values(EXPLAIN_TEXT)) {
      if (typeof text === "string") expect(text).not.toMatch(/[\u2013\u2014]/);
    }
  });
});
