import {
  CRITERION_FIELD_NAMES,
  criterionText,
  describeBrief,
  GOAL_NAMES,
  listSizeText,
  preferenceOrder,
} from "./describe";
import { type BriefCriterion, FIELD_DIMENSION, type SearchBrief, searchBriefSchema } from "./schema";

/**
 * The AI's proposal as chips (TR-45), for the "Here's what I understood" card: one chip per
 * value per field, so the user can drop "Phoenix" and keep "AZ". `describeLines()` stays the
 * read-back for the criteria summary and the export; the chips reuse its wording helpers.
 *
 * Pure: no React, no I/O. The same brief always gives the same chips in the same order.
 */

/** The card's groups, in the order they are shown. */
export const CHIP_GROUPS = ["goal", "mustHaves", "preferences", "exclusions", "listSize", "assumptions"] as const;
export type ChipGroup = (typeof CHIP_GROUPS)[number];

/** Each group's heading. Plain language, no em-dashes. */
export const CHIP_GROUP_NAMES: Record<ChipGroup, string> = {
  goal: "Goal",
  mustHaves: "Must have",
  preferences: "Prefer",
  exclusions: "Leave out",
  listSize: "List size",
  assumptions: "Assumptions",
};

/**
 * One chip. `id` says where its value is in the brief, for `removeChip()`: `goal`, `list-size`,
 * `<part>.<criterion index>.<value index>` (such as `mustHaves.0.0`) or `assumptions.<index>`.
 * Ids are positions, so they are only good for the brief they were made from.
 */
export type Chip = { id: string; group: ChipGroup; label: string; removable: boolean };

/**
 * One group of chips. `note` is a line under the heading: the importance order for an ordered
 * Prefer group ("Most important first: Title, Industry."), otherwise null.
 */
export type ChipGroupView = { group: ChipGroup; chips: Chip[]; note: string | null };

type CriteriaPart = "mustHaves" | "preferences" | "exclusions";
const CRITERIA_PARTS: readonly CriteriaPart[] = ["mustHaves", "preferences", "exclusions"];

/** The chips for one criterion: one per value of an `in`, one for `equals` or a range. */
function criterionChips(part: CriteriaPart, criterion: BriefCriterion, index: number): Chip[] {
  const name = CRITERION_FIELD_NAMES[criterion.field];
  const chip = (valueIndex: number, text: string): Chip => ({
    id: `${part}.${index}.${valueIndex}`,
    group: part,
    label: `${name}: ${text}`,
    removable: true,
  });
  if (criterion.operator === "in") return criterion.value.map((value, valueIndex) => chip(valueIndex, value));
  return [chip(0, criterionText(criterion))];
}

/**
 * The proposal as groups of chips: Goal, Must have, Prefer, Leave out, List size, Assumptions.
 * Must-haves and leave-outs keep the brief's order. Preferences follow the summary's order (the
 * importance order first, when there is one). Groups with nothing in them are left out; Goal and
 * List size are always there. Goal and List size can't be removed (every brief needs them).
 * Assumptions can be removed (they are information only).
 */
export function briefChips(brief: SearchBrief): ChipGroupView[] {
  const groups: ChipGroupView[] = [
    {
      group: "goal",
      chips: [{ id: "goal", group: "goal", label: GOAL_NAMES[brief.intent], removable: false }],
      note: null,
    },
  ];

  const indexed = (part: CriteriaPart) => brief[part].map((criterion, index) => ({ criterion, index }));
  const preferences = preferenceOrder(brief).flatMap((dimension) =>
    indexed("preferences").filter(({ criterion }) => FIELD_DIMENSION[criterion.field] === dimension),
  );
  const ordered = { mustHaves: indexed("mustHaves"), preferences, exclusions: indexed("exclusions") };
  const priority = describeBrief(brief).find((item) => item.id === "priority")?.text ?? null;
  for (const part of CRITERIA_PARTS) {
    const chips = ordered[part].flatMap(({ criterion, index }) => criterionChips(part, criterion, index));
    if (chips.length > 0) groups.push({ group: part, chips, note: part === "preferences" ? priority : null });
  }

  groups.push({
    group: "listSize",
    chips: [{ id: "list-size", group: "listSize", label: listSizeText(brief.listSize), removable: false }],
    note: null,
  });

  const assumptions = brief.assumptions.flatMap((assumption, index): Chip[] =>
    assumption === "" ? [] : [{ id: `assumptions.${index}`, group: "assumptions", label: assumption, removable: true }],
  );
  if (assumptions.length > 0) groups.push({ group: "assumptions", chips: assumptions, note: null });
  return groups;
}

const isCriteriaPart = (value: string): value is CriteriaPart => (CRITERIA_PARTS as readonly string[]).includes(value);

/** A whole number of 0 or more written as text, or null. */
const position = (text: string | undefined) => (text !== undefined && /^\d+$/.test(text) ? Number(text) : null);

/** The criterion without the value at `valueIndex`: an `in` with one value left becomes `equals`; null when none is left. */
function withoutValue(criterion: BriefCriterion, valueIndex: number): BriefCriterion | null {
  if (criterion.operator !== "in") return null;
  const values = criterion.value.filter((_, index) => index !== valueIndex);
  if (values.length === 0) return null;
  return values.length === 1 ? { field: criterion.field, operator: "equals", value: values[0] } : { ...criterion, value: values };
}

/**
 * The brief without the chip `chipId` (from `briefChips()` of the same brief):
 * - an `in` loses that value, and one value left becomes `equals`;
 * - a criterion with no value left is removed;
 * - a preference dimension with no preference left is removed from `priorityOrder`, and an
 *   empty `priorityOrder` is left out;
 * - an assumption is removed.
 * The result is checked with `searchBriefSchema`. Goal, List size, an unknown id, or a result
 * that fails the check (it can't: removing never adds a clash) give back `brief` unchanged.
 */
export function removeChip(brief: SearchBrief, chipId: string): SearchBrief {
  const [part, first, second] = chipId.split(".");
  let next: SearchBrief;

  if (part === "assumptions") {
    const index = position(first);
    if (index === null || index >= brief.assumptions.length) return brief;
    next = { ...brief, assumptions: brief.assumptions.filter((_, i) => i !== index) };
  } else if (isCriteriaPart(part)) {
    const index = position(first);
    const valueIndex = position(second);
    const criterion = index === null ? undefined : brief[part][index];
    if (!criterion || valueIndex === null) return brief;
    const replacement = withoutValue(criterion, valueIndex);
    const criteria = replacement
      ? brief[part].map((c, i) => (i === index ? replacement : c))
      : brief[part].filter((_, i) => i !== index);
    next = { ...brief, [part]: criteria };
    if (part === "preferences") {
      const { priorityOrder, ...rest } = next;
      const kept = (priorityOrder ?? []).filter((dimension) =>
        criteria.some((c) => FIELD_DIMENSION[c.field] === dimension),
      );
      next = kept.length > 0 ? { ...rest, priorityOrder: kept } : rest;
    }
  } else {
    return brief;
  }

  const checked = searchBriefSchema.safeParse(next);
  return checked.success ? checked.data : brief;
}

/** True when the brief has at least one must-have or preference. The chat requires one before ranking; the form doesn't. */
export function hasAnyCriterion(brief: SearchBrief): boolean {
  return brief.mustHaves.length > 0 || brief.preferences.length > 0;
}

/** Where focus goes after a chip is removed. */
export type ChipFocus = { to: "chip"; id: string } | { to: "group"; group: ChipGroup } | { to: "heading" };

/**
 * Where focus goes after removing `removedId` from the brief that gave `before`; `after` is
 * `briefChips()` of the new brief. The next chip in the same group (it now has the removed
 * chip's place); if the removed chip was the last one, the group's heading; if the group is
 * gone, the card's heading.
 */
export function focusAfterRemoval(before: readonly ChipGroupView[], after: readonly ChipGroupView[], removedId: string): ChipFocus {
  const group = before.find((g) => g.chips.some((chip) => chip.id === removedId));
  if (!group) return { to: "heading" };
  const place = group.chips.findIndex((chip) => chip.id === removedId);
  const now = after.find((g) => g.group === group.group);
  if (!now) return { to: "heading" };
  const next = now.chips[place];
  return next ? { to: "chip", id: next.id } : { to: "group", group: group.group };
}
