import { describe, expect, it } from "vitest";
import { briefChips } from "../criteria/chips";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import type { BriefCriterion, SearchBrief } from "../criteria/schema";
import { chipMarks, DIFF_TEXT, diffBriefs } from "./diff-brief";

const BASE = BUSINESS_OWNER_BRIEF;

/** The business owner brief with the title preference set to `title`. */
const withTitle = (title: string): SearchBrief => ({
  ...BASE,
  preferences: BASE.preferences.map((c) => (c.field === "title" ? { field: "title", operator: "equals", value: title } : c)),
});

const city = (value: string | string[]): BriefCriterion =>
  Array.isArray(value) ? { field: "city", operator: "in", value } : { field: "city", operator: "equals", value };
const state: BriefCriterion = { field: "state", operator: "equals", value: "AZ" };
const retail: BriefCriterion = { field: "industry", operator: "equals", value: "Retail" };

const texts = (before: SearchBrief, after: SearchBrief) => diffBriefs(before, after).map((change) => change.text);

describe("diffBriefs", () => {
  it("gives [] for the same brief", () => {
    expect(diffBriefs(BASE, BASE)).toEqual([]);
    expect(diffBriefs(BASE, structuredClone(BASE))).toEqual([]);
  });

  it("gives one change for the title preference Owner, then Operations Manager", () => {
    expect(diffBriefs(BASE, withTitle("Operations Manager"))).toEqual([
      {
        kind: "changed",
        part: "preferences",
        field: "title",
        before: "Owner",
        after: "Operations Manager",
        text: "Title preference: Owner to Operations Manager",
      },
    ]);
  });

  it("names the added value when a must-have city gains Tempe", () => {
    const after = { ...BASE, mustHaves: [city(["Phoenix", "Tempe"]), state] };
    expect(diffBriefs(BASE, after)).toEqual([
      { kind: "added", part: "mustHaves", field: "city", before: "Phoenix", after: "Phoenix or Tempe", text: "Added must-have: City Tempe" },
    ]);
  });

  it("names a removed leave-out", () => {
    const before = { ...BASE, exclusions: [retail] };
    expect(diffBriefs(before, BASE)).toEqual([
      { kind: "removed", part: "exclusions", field: "industry", before: "Retail", text: "Removed leave out: Industry Retail" },
    ]);
  });

  it("names an added leave-out and a removed must-have value", () => {
    expect(texts(BASE, { ...BASE, exclusions: [retail] })).toEqual(["Added leave out: Industry Retail"]);
    expect(texts({ ...BASE, mustHaves: [city(["Phoenix", "Tempe"]), state] }, BASE)).toEqual(["Removed must-have: City Tempe"]);
  });

  it("gives the list size line", () => {
    expect(diffBriefs(BASE, { ...BASE, listSize: 30 })).toEqual([
      { kind: "changed", part: "listSize", field: null, before: "40", after: "30", text: "List size: 40 to 30" },
    ]);
  });

  it("lists two changes in the fixed order: preferences before list size", () => {
    const after = { ...withTitle("Operations Manager"), listSize: 30 };
    expect(texts(BASE, after)).toEqual(["Title preference: Owner to Operations Manager", "List size: 40 to 30"]);
    // The same order whichever way the brief's keys are written.
    const { listSize, ...rest } = after;
    expect(texts(BASE, { listSize, ...rest })).toEqual(texts(BASE, after));
  });

  it("orders goal, must-haves, preferences, leave out, list size, order", () => {
    const after: SearchBrief = {
      ...withTitle("Operations Manager"),
      intent: "job_seeker",
      mustHaves: [city("Tempe"), state],
      exclusions: [retail],
      listSize: 30,
      priorityOrder: ["title", "industry", "employees"],
    };
    expect(texts(BASE, after)).toEqual([
      "Goal: customers or partners to employers",
      "City must-have: Phoenix to Tempe",
      "Title preference: Owner to Operations Manager",
      "Added leave out: Industry Retail",
      "List size: 40 to 30",
      "Importance order changed",
    ]);
  });

  it("treats equals Phoenix and in [phoenix] as the same", () => {
    expect(diffBriefs({ ...BASE, mustHaves: [city("Phoenix"), state] }, { ...BASE, mustHaves: [city(["phoenix"]), state] })).toEqual([]);
  });

  it("ignores the order inside an in list", () => {
    expect(diffBriefs({ ...BASE, mustHaves: [city(["Phoenix", "Tempe"])] }, { ...BASE, mustHaves: [city(["Tempe", "Phoenix"])] })).toEqual([]);
  });

  it("gives the goal line", () => {
    expect(texts(BASE, { ...BASE, intent: "job_seeker" })).toEqual(["Goal: customers or partners to employers"]);
  });

  it("gives Importance order changed when the order is reordered, added or taken away", () => {
    const ordered = { ...BASE, priorityOrder: ["industry", "title", "employees"] } satisfies SearchBrief;
    expect(texts(ordered, { ...BASE, priorityOrder: ["title", "industry", "employees"] })).toEqual([DIFF_TEXT.order]);
    expect(texts(BASE, ordered)).toEqual([DIFF_TEXT.order]);
    expect(texts(ordered, BASE)).toEqual([DIFF_TEXT.order]);
  });

  it("doesn't count an order that only lost a removed preference", () => {
    const before = { ...BASE, priorityOrder: ["title", "industry", "employees"] } satisfies SearchBrief;
    const after = { ...before, preferences: BASE.preferences.filter((c) => c.field !== "title"), priorityOrder: ["industry", "employees"] } satisfies SearchBrief;
    expect(texts(before, after)).toEqual(["Removed preference: Title Owner"]);
  });

  it("describes company size changes with describe.ts's words", () => {
    const range = (min: number, max: number): BriefCriterion => ({ field: "employees", operator: "range", value: { min, max } });
    const noSize = { ...BASE, preferences: BASE.preferences.filter((c) => c.field !== "employees") };
    expect(texts(BASE, { ...noSize, preferences: [...noSize.preferences, range(20, 49)] })).toEqual([
      "Company size preference: 10 to 99 employees to 20 to 49 employees",
    ]);
    expect(texts(noSize, BASE)).toEqual(["Added preference: Company size 10 to 99 employees"]);
    expect(texts(BASE, noSize)).toEqual(["Removed preference: Company size 10 to 99 employees"]);
  });

  it("leaves assumptions out", () => {
    expect(diffBriefs(BASE, { ...BASE, assumptions: ["Phoenix taken as a must-have."] })).toEqual([]);
  });

  it("has no em-dashes in any text", () => {
    const after: SearchBrief = { ...withTitle("Operations Manager"), intent: "job_seeker", exclusions: [retail], listSize: 30 };
    for (const text of texts(BASE, after)) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});

describe("chipMarks", () => {
  const labelled = (after: SearchBrief, marks: Record<string, string>) =>
    Object.fromEntries(
      briefChips(after)
        .flatMap((g) => g.chips)
        .filter((chip) => marks[chip.id])
        .map((chip) => [chip.label, marks[chip.id]]),
    );

  it("marks only the changed title chip", () => {
    const after = withTitle("Operations Manager");
    expect(labelled(after, chipMarks(BASE, after))).toEqual({ "Title: Operations Manager": "changed" });
  });

  it("marks an added city and an added leave-out as new, and the list size as changed", () => {
    const after = { ...BASE, mustHaves: [city(["Phoenix", "Tempe"]), state], exclusions: [retail], listSize: 30 };
    expect(labelled(after, chipMarks(BASE, after))).toEqual({
      "City: Tempe": "new",
      "Industry: Retail": "new",
      "Show 30": "changed",
    });
  });

  it("marks the goal and a changed range", () => {
    const after: SearchBrief = {
      ...BASE,
      intent: "job_seeker",
      preferences: BASE.preferences.map((c) => (c.field === "employees" ? { field: "employees", operator: "range", value: { min: 20, max: 49 } } : c)),
    };
    expect(labelled(after, chipMarks(BASE, after))).toEqual({
      "Find potential employers": "changed",
      "Company size: 20 to 49 employees": "changed",
    });
  });

  it("marks nothing for the same brief", () => {
    expect(chipMarks(BASE, structuredClone(BASE))).toEqual({});
  });
});
