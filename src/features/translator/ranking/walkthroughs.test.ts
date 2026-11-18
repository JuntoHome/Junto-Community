import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { runPipeline } from "../__fixtures__/pipeline";
import { SAMPLE_PATH, seededShuffle } from "../__fixtures__/records";
import businessOwnerGolden from "../__fixtures__/walkthroughs/business-owner.json";
import jobSeekerGolden from "../__fixtures__/walkthroughs/job-seeker.json";
import roleChangeGolden from "../__fixtures__/walkthroughs/role-change.json";
import { BUSINESS_OWNER_BRIEF, JOB_SEEKER_BRIEF } from "../criteria/examples";
import { SCORING_VERSION, type SearchBrief } from "../criteria/schema";
import { ALLOWED_WORKBOOKS } from "../import/allowlist";
import { CRITERIA_TEXT, criteriaTable } from "../export/criteria-rows";
import { shortlistTable } from "../export/shortlist-rows";
import { rank, type RankedRow, type ShortlistRow } from "./index";

/**
 * The spec walkthroughs (TR-30), run through the whole chain from the committed synthetic sample:
 * parse, normalize, row checks, duplicate grouping, rank and counts (`runPipeline()`). The expected
 * numbers are in docs/translator/README.md ("Expected results"). Each walkthrough locks in its
 * counts, its first 8 rows, its last row and the score spread of every eligible row, so a wrong
 * weight, a broken tiebreak or a wrong cut-off fails here, not only a wrong first row.
 *
 * Each walkthrough's full shortlist is also compared with a reviewed golden file in
 * `__fixtures__/walkthroughs/`. Changing one of those files is a deliberate edit in a pull request,
 * with a reason (docs/WAY-OF-WORKING.md, "Testing"); there are no Vitest snapshots to update with -u.
 */

const readSample = () => toArrayBuffer(readFileSync(SAMPLE_PATH));

/** The role change walkthrough: the business owner brief with the title preference changed to Operations Manager. */
const ROLE_CHANGE_BRIEF: SearchBrief = {
  ...BUSINESS_OWNER_BRIEF,
  preferences: BUSINESS_OWNER_BRIEF.preferences.map((criterion) =>
    criterion.field === "title" ? { field: "title", operator: "equals", value: "Operations Manager" } : criterion,
  ),
};

/** What a golden file holds for each shortlist row. */
type GoldenRow = { rank: number; recordId: string; displayScore: number; reasonText: string };

const golden = (row: ShortlistRow): GoldenRow => ({
  rank: row.rank,
  recordId: row.record.normalized.recordId,
  displayScore: row.displayScore,
  reasonText: row.reasonText,
});

/** A shortlist row for the repeat checks: the golden fields plus the unrounded score, so even a last-bit change shows. */
const exact = (row: ShortlistRow) => ({ ...golden(row), score: row.score });

/** "SYN-0001 100": a row's Record ID and display score. */
const idAndScore = (row: ShortlistRow) => `${row.record.normalized.recordId} ${row.displayScore}`;

/**
 * How many eligible rows have each score, rounded to 2 decimals, highest first: `[[100, 1], [85.71, 4], ...]`.
 * `ranked` is sorted by score, so the scores come out highest first.
 */
function scoreSpread(ranked: readonly RankedRow[]): [number, number][] {
  const spread = new Map<number, number>();
  for (const row of ranked) {
    const score = Math.round(row.score * 100) / 100;
    spread.set(score, (spread.get(score) ?? 0) + 1);
  }
  return [...spread];
}

/** The shortlist row with this Record ID. Fails the test when it isn't in the list. */
function rowFor(shortlist: readonly ShortlistRow[], recordId: string): ShortlistRow {
  const row = shortlist.find((r) => r.record.normalized.recordId === recordId);
  if (!row) throw new Error(`${recordId} isn't in the shortlist.`);
  return row;
}

type Pipeline = Awaited<ReturnType<typeof runPipeline>>;

/** Fixed seeds for the shuffled runs, so a failure can be repeated exactly. */
const SHUFFLE_SEEDS = [1, 42, 20261118] as const;

/**
 * The checks every walkthrough shares: the same brief run twice gives the same shortlist, the
 * records shuffled first (3 fixed seeds) give the same shortlist, and the shortlist matches its
 * golden file exactly.
 */
function itIsRepeatableAndMatchesGolden(brief: SearchBrief, expected: readonly GoldenRow[], run: () => Pipeline) {
  it("gives a deep-equal shortlist when run twice", async () => {
    const again = await runPipeline(readSample(), brief);
    expect(again.rankResult.shortlist.map(exact)).toEqual(run().rankResult.shortlist.map(exact));
  });

  it.each(SHUFFLE_SEEDS)("gives the same shortlist with the records shuffled (seed %i)", (seed) => {
    const { records, rankResult } = run();
    const shuffled = seededShuffle(records, seed);
    // Guard: the shuffle really changed the order, so the check below means something.
    expect(shuffled.map((r) => r.normalized.recordId)).not.toEqual(records.map((r) => r.normalized.recordId));
    expect(rank(shuffled, brief).shortlist.map(exact)).toEqual(rankResult.shortlist.map(exact));
  });

  it("matches the reviewed golden file row for row", () => {
    expect(run().rankResult.shortlist.map(golden)).toEqual(expected);
  });
}

describe("business owner walkthrough (Phoenix, AZ must; prefer Fabrication, Owner, 10 to 99; 40 rows)", () => {
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(readSample(), BUSINESS_OWNER_BRIEF);
  });

  it("counts 500 read, 1 duplicate, 499 unique, 0 excluded, 399 failed, 100 eligible, 40 exported", () => {
    expect(result.counts).toMatchObject({
      rowsRead: 500,
      rowsLeftOut: 0,
      duplicatesGrouped: 1,
      uniqueRecords: 499,
      excluded: 0,
      failedMustHave: 399,
      failedOnlyMissing: 0,
      eligible: 100,
      exported: 40,
    });
  });

  it("puts SYN-0001 first at 100, then the next 7 in order", () => {
    expect(result.rankResult.shortlist.slice(0, 8).map(idAndScore)).toEqual([
      "SYN-0001 100",
      "SYN-0101 86",
      "SYN-0201 86",
      "SYN-0301 86",
      "SYN-0401 86",
      "SYN-0006 64",
      "SYN-0011 64",
      "SYN-0026 64",
    ]);
  });

  it("ends with SYN-0441 at 36 in row 40", () => {
    const last = result.rankResult.shortlist.at(-1);
    expect(last && idAndScore(last)).toBe("SYN-0441 36");
    expect(last?.rank).toBe(40);
  });

  it("spreads the 100 eligible scores as expected", () => {
    expect(scoreSpread(result.rankResult.ranked)).toEqual([
      [100, 1],
      [85.71, 4],
      [64.29, 7],
      [50, 10],
      [35.71, 20],
      [14.29, 19],
      [0, 39],
    ]);
  });

  it("gives SYN-0001 its duplicate and its reasons", () => {
    const first = rowFor(result.rankResult.shortlist, "SYN-0001");
    expect(first.record.duplicateIds).toEqual(["SYN-0500"]);
    expect(first.reasonText).toBe(
      "Location: Phoenix, AZ (required); Industry: Fabrication (preferred); Title: Owner (preferred); Company size: 25 employees (preferred)",
    );
  });

  itIsRepeatableAndMatchesGolden(BUSINESS_OWNER_BRIEF, businessOwnerGolden, () => result);
});

describe("role change walkthrough (business owner brief, title Operations Manager)", () => {
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(readSample(), ROLE_CHANGE_BRIEF);
  });

  it("puts the 6 Operations Manager rows first at 100, in Record ID order, then SYN-0001 and SYN-0011", () => {
    expect(result.rankResult.shortlist.slice(0, 8).map(idAndScore)).toEqual([
      "SYN-0006 100",
      "SYN-0026 100",
      "SYN-0126 100",
      "SYN-0226 100",
      "SYN-0326 100",
      "SYN-0426 100",
      "SYN-0001 64",
      "SYN-0011 64",
    ]);
  });

  it("ends with SYN-0476 at 50 in row 40", () => {
    const last = result.rankResult.shortlist.at(-1);
    expect(last && idAndScore(last)).toBe("SYN-0476 50");
    expect(last?.rank).toBe(40);
  });

  it("spreads the 100 eligible scores as expected", () => {
    expect(scoreSpread(result.rankResult.ranked)).toEqual([
      [100, 6],
      [64.29, 2],
      [50, 33],
      [0, 59],
    ]);
  });

  it("explains SYN-0006 with the preferred title", () => {
    const first = rowFor(result.rankResult.shortlist, "SYN-0006");
    expect(first.reasons.map((reason) => reason.text)).toContain("Title: Operations Manager (preferred)");
  });

  it("keeps SYN-0011 at rank 8 with Title unknown", () => {
    const row = rowFor(result.rankResult.shortlist, "SYN-0011");
    expect(row.rank).toBe(8);
    expect(row.reasons.map((reason) => reason.text)).toContain("Title unknown");
  });

  describe("export builders", () => {
    it("puts SYN-0006 in row 1 of the Shortlist sheet and leaves SYN-0011's Title and Email empty", () => {
      const { columns, rows } = shortlistTable(result.rankResult, result.mapping);
      const column = (key: (typeof columns)[number]["key"]) => columns.findIndex((c) => c.key === key);
      const syn0011 = rows.find((cells) => cells[column("recordId")] === "SYN-0011");

      expect(rows[0][column("recordId")]).toBe("SYN-0006");
      expect(syn0011?.[column("title")]).toBeNull();
      expect(syn0011?.[column("email")]).toBeNull();
    });

    it("writes the changed preference and the scoring version on the Criteria sheet", () => {
      // The source the wizard would pass for the Load sample file.
      const { parsed } = result.importState;
      const sections = criteriaTable({
        rankResult: result.rankResult,
        counts: result.counts,
        source: {
          fileName: ALLOWED_WORKBOOKS[0].fileName,
          layout: parsed.layout.label,
          sheetName: parsed.sheetName,
          sha256: ALLOWED_WORKBOOKS[0].sha256,
        },
        now: new Date(Date.UTC(2026, 10, 18)),
      });
      const section = (heading: string) => sections.find((s) => s.heading === heading)?.rows ?? [];

      expect(section(CRITERIA_TEXT.criteria).map(([, value]) => value)).toContain(
        "Prefer Fabrication, Operations Manager, 10 to 99 employees.",
      );
      expect(section(CRITERIA_TEXT.scoring)).toContainEqual([CRITERIA_TEXT.scoringVersion, SCORING_VERSION]);
    });
  });

  itIsRepeatableAndMatchesGolden(ROLE_CHANGE_BRIEF, roleChangeGolden, () => result);
});

describe("job seeker walkthrough (Tempe, AZ must; prefer Logistics, Operations Manager, 10 to 99; 30 rows)", () => {
  let result: Pipeline;
  beforeAll(async () => {
    result = await runPipeline(readSample(), JOB_SEEKER_BRIEF);
  });

  it("counts 100 eligible and 30 exported", () => {
    expect(result.counts.eligible).toBe(100);
    expect(result.counts.exported).toBe(30);
  });

  it("puts SYN-0002 first at 100, tied with 6 others in Record ID order, then SYN-0012", () => {
    expect(result.rankResult.shortlist.slice(0, 8).map(idAndScore)).toEqual([
      "SYN-0002 100",
      "SYN-0007 100",
      "SYN-0027 100",
      "SYN-0127 100",
      "SYN-0227 100",
      "SYN-0327 100",
      "SYN-0427 100",
      "SYN-0012 64",
    ]);
  });

  it("ends with SYN-0347 at 50 in row 30", () => {
    const last = result.rankResult.shortlist.at(-1);
    expect(last && idAndScore(last)).toBe("SYN-0347 50");
    expect(last?.rank).toBe(30);
  });

  it("spreads the 100 eligible scores as expected", () => {
    expect(scoreSpread(result.rankResult.ranked)).toEqual([
      [100, 7],
      [64.29, 1],
      [50, 33],
      [0, 59],
    ]);
  });

  itIsRepeatableAndMatchesGolden(JOB_SEEKER_BRIEF, jobSeekerGolden, () => result);
});
