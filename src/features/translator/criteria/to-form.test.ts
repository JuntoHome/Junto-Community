import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { importWorkbook } from "../__fixtures__/import-pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import { fieldOptions } from "../normalize/field-options";
import { BUSINESS_OWNER_BRIEF, JOB_SEEKER_BRIEF } from "./examples";
import { type CriteriaForm, EMPTY_CRITERIA_FORM, type MustHaveField, type PickerOption, toBrief } from "./from-form";
import type { SearchBrief } from "./schema";
import { briefToFormState, inFormShape } from "./to-form";

// The pickers' options for the synthetic sample: cities Glendale, Mesa, Phoenix, Scottsdale, Tempe;
// state AZ; industries Business Services, Fabrication, Logistics, Retail, Technology;
// titles General Manager, Operations Manager, Owner.
let options: Record<MustHaveField, PickerOption[]>;

beforeAll(async () => {
  const bytes = readFileSync(SAMPLE_PATH);
  const { grouping } = await importWorkbook(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  options = {
    city: fieldOptions(grouping.records, "city"),
    state: fieldOptions(grouping.records, "state"),
    industry: fieldOptions(grouping.records, "industry"),
    title: fieldOptions(grouping.records, "title"),
  };
});

/** The business owner brief with its preferences ranked title, company size, industry. */
const ORDERED_BRIEF: SearchBrief = { ...BUSINESS_OWNER_BRIEF, priorityOrder: ["title", "employees", "industry"] };

/** "in" lists in must-haves, preferences and exclusions, in the pickers' order. */
const LISTS_BRIEF: SearchBrief = {
  intent: "job_seeker",
  mustHaves: [
    { field: "city", operator: "in", value: ["Phoenix", "Tempe"] },
    { field: "state", operator: "equals", value: "AZ" },
    { field: "industry", operator: "in", value: ["Fabrication", "Logistics"] },
  ],
  preferences: [
    { field: "title", operator: "in", value: ["General Manager", "Owner"] },
    { field: "employees", operator: "range", value: { min: 0, max: 10 } },
  ],
  exclusions: [
    { field: "industry", operator: "equals", value: "Retail" },
    { field: "title", operator: "equals", value: "Operations Manager" },
    { field: "city", operator: "in", value: ["Glendale", "Mesa"] },
  ],
  listSize: 25,
  assumptions: [],
};

/** The job seeker brief with the AI's assumptions. */
const ASSUMPTIONS_BRIEF: SearchBrief = {
  ...JOB_SEEKER_BRIEF,
  assumptions: ["Tempe taken as a must-have.", "No exclusions given."],
};

describe("briefToFormState", () => {
  it("gives the business owner brief as the form would hold it", () => {
    expect(briefToFormState(BUSINESS_OWNER_BRIEF)).toEqual({
      intent: "business_owner",
      mustHaves: { city: ["phoenix"], state: ["az"], industry: [], title: [] },
      preferences: {
        industry: { mode: "prefer", picked: ["fabrication"] },
        title: { mode: "prefer", picked: ["owner"] },
        employees: { mode: "prefer", from: "10", to: "99" },
      },
      rankByImportance: false,
      importanceOrder: ["industry", "title", "employees"],
      exclusions: { industry: [], title: [], city: [] },
      listSize: "40",
      assumptions: [],
    } satisfies CriteriaForm);
  });

  it("ticks Rank by importance and puts the priority order first", () => {
    const form = briefToFormState(ORDERED_BRIEF);
    expect(form.rankByImportance).toBe(true);
    expect(form.importanceOrder).toEqual(["title", "employees", "industry"]);
  });

  it("moves preferences that aren't set to the end of the importance order", () => {
    const brief: SearchBrief = { ...BUSINESS_OWNER_BRIEF, preferences: [BUSINESS_OWNER_BRIEF.preferences[2]] };
    const form = briefToFormState(brief);
    expect(form.preferences.industry).toEqual({ mode: "none", picked: [] });
    expect(form.preferences.title).toEqual({ mode: "none", picked: [] });
    expect(form.importanceOrder).toEqual(["employees", "industry", "title"]);
  });

  it("keeps everything else from the empty form's shape", () => {
    expect(Object.keys(briefToFormState(BUSINESS_OWNER_BRIEF)).sort()).toEqual(Object.keys(EMPTY_CRITERIA_FORM).sort());
  });
});

describe("the round trip: toBrief(briefToFormState(brief)) gives back the brief", () => {
  it.each([
    ["the business owner brief", BUSINESS_OWNER_BRIEF],
    ["the job seeker brief", JOB_SEEKER_BRIEF],
    ["ordered preferences", ORDERED_BRIEF],
    ["in lists and exclusions", LISTS_BRIEF],
    ["assumptions", ASSUMPTIONS_BRIEF],
  ])("%s", (_, brief) => {
    expect(toBrief(briefToFormState(brief), options)).toEqual({ ok: true, brief });
  });

  it("takes the pickers' spelling, as the form always does", () => {
    const brief: SearchBrief = {
      ...BUSINESS_OWNER_BRIEF,
      mustHaves: [{ field: "city", operator: "equals", value: "phoenix" }],
    };
    const result = toBrief(briefToFormState(brief), options);
    expect(result.ok && result.brief.mustHaves).toEqual([{ field: "city", operator: "equals", value: "Phoenix" }]);
  });
});

describe("inFormShape", () => {
  it("leaves a brief already in the form's shape as it is", () => {
    for (const brief of [BUSINESS_OWNER_BRIEF, JOB_SEEKER_BRIEF, ORDERED_BRIEF, LISTS_BRIEF, ASSUMPTIONS_BRIEF]) {
      expect(inFormShape(brief)).toEqual({ ok: true, brief });
    }
  });

  it("puts criteria and in values in the form's order, and turns a one-value in into equals", () => {
    const shuffled: SearchBrief = {
      ...LISTS_BRIEF,
      mustHaves: [
        { field: "industry", operator: "in", value: ["Logistics", "Fabrication"] },
        { field: "state", operator: "in", value: ["AZ"] },
        { field: "city", operator: "in", value: ["Tempe", "Phoenix"] },
      ],
      preferences: [LISTS_BRIEF.preferences[1], { field: "title", operator: "in", value: ["Owner", "General Manager"] }],
      exclusions: [...LISTS_BRIEF.exclusions].reverse(),
    };
    expect(inFormShape(shuffled)).toEqual({ ok: true, brief: LISTS_BRIEF });
  });

  it("adds the preferences a priority order leaves out, in the form's order, and drops an empty one", () => {
    const partial = inFormShape({ ...BUSINESS_OWNER_BRIEF, priorityOrder: ["employees"] });
    expect(partial.ok && partial.brief.priorityOrder).toEqual(["employees", "industry", "title"]);
    expect(inFormShape({ ...BUSINESS_OWNER_BRIEF, priorityOrder: [] })).toEqual({ ok: true, brief: BUSINESS_OWNER_BRIEF });
  });

  it.each<[string, Partial<SearchBrief>]>([
    ["a city preference", { preferences: [{ field: "city", operator: "equals", value: "Phoenix" }] }],
    ["a company size must-have", { mustHaves: [{ field: "employees", operator: "range", value: { min: 1, max: 9 } }] }],
    ["a state leave-out", { exclusions: [{ field: "state", operator: "equals", value: "NV" }] }],
    [
      "two city must-haves",
      {
        mustHaves: [
          { field: "city", operator: "equals", value: "Phoenix" },
          { field: "city", operator: "equals", value: "Tempe" },
        ],
      },
    ],
  ])("refuses %s", (_, changes) => {
    expect(inFormShape({ ...BUSINESS_OWNER_BRIEF, ...changes })).toEqual({ ok: false });
  });
});
