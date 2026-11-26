import { describe, expect, it } from "vitest";
import { briefChips, type ChipGroupView, focusAfterRemoval, hasAnyCriterion, removeChip } from "./chips";
import { BUSINESS_OWNER_BRIEF, JOB_SEEKER_BRIEF } from "./examples";
import { type SearchBrief, searchBriefSchema } from "./schema";

/** Each group as [group, labels], to compare without ids. */
const labels = (groups: readonly ChipGroupView[]) => groups.map((g) => [g.group, g.chips.map((chip) => chip.label)]);

/** The id of the chip with `label`. */
function idOf(brief: SearchBrief, label: string): string {
  const chip = briefChips(brief)
    .flatMap((g) => g.chips)
    .find((c) => c.label === label);
  if (!chip) throw new Error(`no chip "${label}"`);
  return chip.id;
}

const remove = (brief: SearchBrief, label: string) => removeChip(brief, idOf(brief, label));

const ORDERED_BRIEF: SearchBrief = { ...BUSINESS_OWNER_BRIEF, priorityOrder: ["title", "industry", "employees"] };

const TWO_CITIES: SearchBrief = {
  ...BUSINESS_OWNER_BRIEF,
  mustHaves: [
    { field: "city", operator: "in", value: ["Phoenix", "Tempe"] },
    { field: "state", operator: "equals", value: "AZ" },
  ],
};

describe("briefChips", () => {
  it("gives the business owner brief one chip per value per field, with no Leave out group", () => {
    expect(labels(briefChips(BUSINESS_OWNER_BRIEF))).toEqual([
      ["goal", ["Find prospective customers or partners"]],
      ["mustHaves", ["City: Phoenix", "State: AZ"]],
      ["preferences", ["Industry: Fabrication", "Title: Owner", "Company size: 10 to 99 employees"]],
      ["listSize", ["Show 40"]],
    ]);
  });

  it("gives each value of an in list its own chip", () => {
    expect(labels(briefChips(TWO_CITIES))[1]).toEqual(["mustHaves", ["City: Phoenix", "City: Tempe", "State: AZ"]]);
  });

  it("shows leave-outs and assumptions, and the job seeker's goal", () => {
    const brief: SearchBrief = {
      ...JOB_SEEKER_BRIEF,
      exclusions: [{ field: "industry", operator: "equals", value: "Retail" }],
      assumptions: ["Tempe taken as a must-have.", ""],
    };
    const groups = labels(briefChips(brief));
    expect(groups[0]).toEqual(["goal", ["Find potential employers"]]);
    expect(groups.slice(3)).toEqual([
      ["exclusions", ["Industry: Retail"]],
      ["listSize", ["Show 30"]],
      ["assumptions", ["Tempe taken as a must-have."]],
    ]);
  });

  it("lists preferences most important first, with the order as a note", () => {
    const prefer = briefChips(ORDERED_BRIEF).find((g) => g.group === "preferences");
    expect(prefer?.chips.map((c) => c.label)).toEqual(["Title: Owner", "Industry: Fabrication", "Company size: 10 to 99 employees"]);
    expect(prefer?.note).toBe("Most important first: Title, Industry, Company size.");
    expect(briefChips(BUSINESS_OWNER_BRIEF).find((g) => g.group === "preferences")?.note).toBeNull();
  });

  it("makes Goal and List size not removable, and everything else removable", () => {
    const brief: SearchBrief = { ...BUSINESS_OWNER_BRIEF, assumptions: ["Phoenix taken as a must-have."] };
    for (const chip of briefChips(brief).flatMap((g) => g.chips)) {
      expect(chip.removable).toBe(chip.group !== "goal" && chip.group !== "listSize");
    }
  });
});

describe("removeChip", () => {
  it("removes City: Phoenix and keeps State: AZ", () => {
    const next = remove(BUSINESS_OWNER_BRIEF, "City: Phoenix");
    expect(next.mustHaves).toEqual([{ field: "state", operator: "equals", value: "AZ" }]);
    expect(searchBriefSchema.safeParse(next).success).toBe(true);
    expect(next.preferences).toEqual(BUSINESS_OWNER_BRIEF.preferences);
  });

  it("turns city in Phoenix, Tempe into equals Phoenix when Tempe is removed", () => {
    expect(remove(TWO_CITIES, "City: Tempe").mustHaves).toEqual([
      { field: "city", operator: "equals", value: "Phoenix" },
      { field: "state", operator: "equals", value: "AZ" },
    ]);
  });

  it("removes a removed preference from the priority order", () => {
    const next = remove(ORDERED_BRIEF, "Title: Owner");
    expect(next.preferences.map((c) => c.field)).toEqual(["industry", "employees"]);
    expect(next.priorityOrder).toEqual(["industry", "employees"]);
  });

  it("leaves out an empty priority order", () => {
    let next: SearchBrief = { ...BUSINESS_OWNER_BRIEF, priorityOrder: ["title"] };
    next = remove(next, "Title: Owner");
    expect(next).not.toHaveProperty("priorityOrder");
    expect(searchBriefSchema.safeParse(next).success).toBe(true);
  });

  it("removes an assumption", () => {
    const brief: SearchBrief = { ...BUSINESS_OWNER_BRIEF, assumptions: ["One.", "Two."] };
    expect(remove(brief, "One.").assumptions).toEqual(["Two."]);
  });

  it("leaves the brief as it is for Goal, List size and an unknown id", () => {
    for (const id of ["goal", "list-size", "mustHaves.9.0", "mustHaves.x.0", "rows.0.0", ""]) {
      expect(removeChip(BUSINESS_OWNER_BRIEF, id)).toBe(BUSINESS_OWNER_BRIEF);
    }
  });

  it("doesn't change the brief it was given", () => {
    const copy = structuredClone(ORDERED_BRIEF);
    remove(ORDERED_BRIEF, "Title: Owner");
    expect(ORDERED_BRIEF).toEqual(copy);
  });
});

describe("hasAnyCriterion", () => {
  it("is false once every must-have and preference is removed", () => {
    let brief = BUSINESS_OWNER_BRIEF;
    expect(hasAnyCriterion(brief)).toBe(true);
    for (const label of ["City: Phoenix", "State: AZ", "Industry: Fabrication", "Title: Owner"]) {
      brief = remove(brief, label);
      expect(hasAnyCriterion(brief)).toBe(true);
    }
    brief = remove(brief, "Company size: 10 to 99 employees");
    expect(hasAnyCriterion(brief)).toBe(false);
    expect(searchBriefSchema.safeParse(brief).success).toBe(true);
  });

  it("doesn't count leave-outs", () => {
    const brief: SearchBrief = {
      ...BUSINESS_OWNER_BRIEF,
      mustHaves: [],
      preferences: [],
      exclusions: [{ field: "city", operator: "equals", value: "Mesa" }],
    };
    expect(hasAnyCriterion(brief)).toBe(false);
  });
});

describe("focusAfterRemoval", () => {
  const focusAfter = (brief: SearchBrief, label: string) =>
    focusAfterRemoval(briefChips(brief), briefChips(remove(brief, label)), idOf(brief, label));

  it("moves to the next chip in the group", () => {
    const after = remove(BUSINESS_OWNER_BRIEF, "City: Phoenix");
    expect(focusAfter(BUSINESS_OWNER_BRIEF, "City: Phoenix")).toEqual({ to: "chip", id: idOf(after, "State: AZ") });
    expect(focusAfter(TWO_CITIES, "City: Phoenix")).toEqual({ to: "chip", id: idOf(remove(TWO_CITIES, "City: Phoenix"), "City: Tempe") });
  });

  it("moves to the group's heading after the last chip in it", () => {
    expect(focusAfter(BUSINESS_OWNER_BRIEF, "State: AZ")).toEqual({ to: "group", group: "mustHaves" });
  });

  it("moves to the card's heading when the group is gone", () => {
    const one = remove(BUSINESS_OWNER_BRIEF, "City: Phoenix");
    expect(focusAfter(one, "State: AZ")).toEqual({ to: "heading" });
  });
});
