import { describe, expect, it } from "vitest";
import { EXAMPLE_SUMMARY } from "../__fixtures__/summary";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { type SearchBrief } from "../criteria/schema";
import type { TranslatorRecord } from "../import/fields";
import { normalizeRecord } from "../normalize/normalize";
import { briefFitsSummary, briefForAi } from "./brief-for-ai";
import { buildFileSummary } from "./summary";
import { parseInterviewReply } from "./validate";

/** EXAMPLE_SUMMARY holds Phoenix and Tempe, AZ, Fabrication and Owner. */
const brief = (changes: Partial<SearchBrief>): SearchBrief => ({ ...BUSINESS_OWNER_BRIEF, ...changes });

describe("briefForAi", () => {
  it("keeps a brief whose values are all in the summary, unchanged", () => {
    expect(briefForAi(BUSINESS_OWNER_BRIEF, EXAMPLE_SUMMARY)).toEqual({ brief: BUSINESS_OWNER_BRIEF, withheld: [] });
  });

  it("gives nothing for no brief", () => {
    expect(briefForAi(undefined, EXAMPLE_SUMMARY)).toEqual({ brief: undefined, withheld: [] });
  });

  it("takes out a value the summary doesn't hold, and names it", () => {
    const result = briefForAi(
      brief({ exclusions: [{ field: "title", operator: "equals", value: "jane@example.invalid" }] }),
      EXAMPLE_SUMMARY,
    );
    expect(result.withheld).toEqual(["jane@example.invalid"]);
    expect(result.brief?.exclusions).toEqual([]);
    expect(JSON.stringify(result.brief)).not.toContain("jane@");
  });

  it("keeps the values of an in list that the summary holds, and an in left with one becomes equals", () => {
    const result = briefForAi(
      brief({
        mustHaves: [
          { field: "city", operator: "in", value: ["Phoenix", "Zuni"] },
          { field: "state", operator: "equals", value: "AZ" },
        ],
      }),
      EXAMPLE_SUMMARY,
    );
    expect(result.brief?.mustHaves).toEqual([
      { field: "city", operator: "equals", value: "Phoenix" },
      { field: "state", operator: "equals", value: "AZ" },
    ]);
    expect(result.withheld).toEqual(["Zuni"]);
  });

  it("drops a preference left with no value from the importance order", () => {
    const result = briefForAi(
      brief({
        preferences: [
          { field: "industry", operator: "equals", value: "Mining" },
          { field: "title", operator: "equals", value: "Owner" },
          { field: "employees", operator: "range", value: { min: 10, max: 99 } },
        ],
        priorityOrder: ["industry", "title", "employees"],
      }),
      EXAMPLE_SUMMARY,
    );
    expect(result.brief?.preferences.map((criterion) => criterion.field)).toEqual(["title", "employees"]);
    expect(result.brief?.priorityOrder).toEqual(["title", "employees"]);
    expect(result.withheld).toEqual(["Mining"]);
  });

  it("drops assumptions that look like contact data or are too long, and keeps at most 5", () => {
    const assumptions = [
      "Phoenix taken as a must-have.",
      "Call 602-555-0100 for details.",
      "x".repeat(201),
      "One.",
      "Two.",
      "Three.",
      "Four.",
      "Five.",
    ];
    expect(briefForAi(brief({ assumptions }), EXAMPLE_SUMMARY).brief?.assumptions).toEqual([
      "Phoenix taken as a must-have.",
      "One.",
      "Two.",
      "Three.",
      "Four.",
    ]);
  });

  it("names each withheld value once, on one line, at most 80 characters", () => {
    const long = `Zuni ${"y".repeat(120)}`;
    const result = briefForAi(
      brief({
        mustHaves: [
          { field: "city", operator: "in", value: [long, "Zuni"] },
          { field: "state", operator: "equals", value: "AZ" },
        ],
        exclusions: [{ field: "city", operator: "equals", value: "Zuni" }],
      }),
      EXAMPLE_SUMMARY,
    );
    expect(result.withheld).toEqual([long.slice(0, 80), "Zuni"]);
  });
});

describe("briefFitsSummary (the route's check)", () => {
  it("is true for a brief whose values are all in the summary", () => {
    expect(briefFitsSummary(BUSINESS_OWNER_BRIEF, EXAMPLE_SUMMARY)).toBe(true);
  });

  it("is false for a value the summary doesn't hold, a contact-looking or long assumption, or 6 assumptions", () => {
    expect(briefFitsSummary(brief({ exclusions: [{ field: "city", operator: "equals", value: "Zuni" }] }), EXAMPLE_SUMMARY)).toBe(false);
    expect(briefFitsSummary(brief({ assumptions: ["jane@example.invalid"] }), EXAMPLE_SUMMARY)).toBe(false);
    expect(briefFitsSummary(brief({ assumptions: ["x".repeat(201)] }), EXAMPLE_SUMMARY)).toBe(false);
    expect(briefFitsSummary(brief({ assumptions: ["1", "2", "3", "4", "5", "6"] }), EXAMPLE_SUMMARY)).toBe(false);
  });

  it("is true for what briefForAi gives, whatever the brief held", () => {
    const messy = brief({
      mustHaves: [{ field: "city", operator: "in", value: ["Phoenix", "Zuni"] }],
      exclusions: [{ field: "title", operator: "equals", value: "jane@example.invalid" }],
      assumptions: ["Call 602-555-0100."],
    });
    const { brief: sent } = briefForAi(messy, EXAMPLE_SUMMARY);
    if (!sent) throw new Error("expected a brief");
    expect(briefFitsSummary(messy, EXAMPLE_SUMMARY)).toBe(false);
    expect(briefFitsSummary(sent, EXAMPLE_SUMMARY)).toBe(true);
  });
});

describe("a value outside the 100 most common (the change chat refused it before fix B)", () => {
  /** 120 cities, City 001 most common; "Zuni" has one record, so it isn't in the top 100. */
  function records() {
    const base = (n: number, city: string): { sourceRow: number; normalized: ReturnType<typeof normalizeRecord> } => {
      const record: TranslatorRecord = {
        recordId: `TST-${String(n).padStart(5, "0")}`,
        idGenerated: false,
        otherExecutives: [],
        company: `Test Company ${n}`,
        city,
        state: "AZ",
        industry: "Fabrication",
        employees: null,
        title: "Owner",
        name: null,
        email: null,
        phone: null,
        website: null,
        address: null,
        zip: null,
        naicsDescription: null,
        employeeRange: null,
      };
      return { sourceRow: n + 1, normalized: normalizeRecord(record) };
    };
    const rows = [];
    let n = 1;
    for (let city = 1; city <= 120; city += 1) {
      for (let copy = 0; copy < 2 + (120 - city); copy += 1) rows.push(base(n++, `City ${String(city).padStart(3, "0")}`));
    }
    rows.push(base(n, "Zuni"));
    return rows;
  }

  it("is in the summary built with the brief, so the AI sees it and its copy of the brief is accepted", () => {
    const withZuni = brief({ mustHaves: [{ field: "city", operator: "equals", value: "Zuni" }, { field: "state", operator: "equals", value: "AZ" }] });
    const plain = buildFileSummary(records(), "synthetic");
    const summary = buildFileSummary(records(), "synthetic", withZuni);

    expect(plain.cities.map((city) => city.value)).not.toContain("Zuni");
    expect(summary.cities.map((city) => city.value)).toContain("Zuni");
    expect(summary.cities).toHaveLength(100);
    expect(summary.truncated.cities).toBe(true);
    expect(briefForAi(withZuni, summary)).toEqual({ brief: withZuni, withheld: [] });

    // The AI copies the brief and changes the list size: accepted, no "not in this file" note.
    const reply = JSON.stringify({ message: "Done.", proposal: { ...withZuni, listSize: 20, priorityOrder: null } });
    const parsed = parseInterviewReply(reply, summary);
    expect(parsed).toMatchObject({ ok: true, note: null });
    expect(parsed.ok && parsed.reply.proposal?.mustHaves[0]).toEqual({ field: "city", operator: "equals", value: "Zuni" });
  });
});
