/**
 * Capability: what changed between two briefs (TR-46). The chat on the Results step uses it to
 * show what a proposed change does before it is confirmed; TR-47 reuses it.
 * Input: the brief before (the confirmed one) and the brief after (the AI's proposal).
 * Output: `BriefChange[]`, in a fixed order: goal, must-haves, preferences, leave out (fields in
 * schema order), list size, importance order. `[]` when nothing changed. `chipMarks()` says which
 * of the proposal card's chips are new or changed.
 * Privacy: reads only the two briefs. Nothing is sent, stored or logged.
 * This module is pure (no React, no I/O).
 */
import {
  type CriteriaPart,
  CRITERIA_PARTS,
  criterionChipId,
  GOAL_CHIP_ID,
  LIST_SIZE_CHIP_ID,
} from "../criteria/chips";
import { CRITERION_FIELD_NAMES, criterionText } from "../criteria/describe";
import { BRIEF_FIELDS, type BriefCriterion, type BriefField, type BriefIntent, type SearchBrief } from "../criteria/schema";
import { matchKey } from "../normalize/match-key";

/** What a change is about: one list of criteria, or the goal, the list size or the importance order. */
export type ChangePart = CriteriaPart | "intent" | "listSize" | "priorityOrder";

/**
 * One change. Criteria are compared per part and field, the same granularity as the chips.
 * `field` is null for the goal, the list size and the importance order. `before` and `after`
 * are the values as words (`"Owner"`, `"Phoenix or Tempe"`, `"40"`), when there are any.
 */
export type BriefChange = {
  kind: "added" | "removed" | "changed";
  part: ChangePart;
  field: BriefField | null;
  before?: string;
  after?: string;
  text: string;
};

// The wording of each change. Plain language, no em-dashes.
export const DIFF_TEXT = {
  parts: { mustHaves: "must-have", preferences: "preference", exclusions: "leave out" } satisfies Record<CriteriaPart, string>,
  /** "customers or partners to employers" in the goal line. */
  goals: { business_owner: "customers or partners", job_seeker: "employers" } satisfies Record<BriefIntent, string>,
  /** "Title preference: Owner to Operations Manager" */
  changed: (part: CriteriaPart, field: BriefField, before: string, after: string) =>
    `${CRITERION_FIELD_NAMES[field]} ${DIFF_TEXT.parts[part]}: ${before} to ${after}`,
  /** "Added must-have: City Tempe" */
  added: (part: CriteriaPart, field: BriefField, values: string) =>
    `Added ${DIFF_TEXT.parts[part]}: ${CRITERION_FIELD_NAMES[field]} ${values}`,
  /** "Removed leave out: Industry Retail" */
  removed: (part: CriteriaPart, field: BriefField, values: string) =>
    `Removed ${DIFF_TEXT.parts[part]}: ${CRITERION_FIELD_NAMES[field]} ${values}`,
  goal: (before: BriefIntent, after: BriefIntent) => `Goal: ${DIFF_TEXT.goals[before]} to ${DIFF_TEXT.goals[after]}`,
  listSize: (before: string, after: string) => `List size: ${before} to ${after}`,
  order: "Importance order changed",
} as const;

const number = (n: number) => n.toLocaleString("en-US");

/** Text values as one criterion's words, as describe.ts writes them: "Phoenix", "Phoenix or Tempe". */
function valuesText(field: BriefField, values: readonly string[]): string {
  // Only text fields hold text values; the field doesn't change the words.
  const textField = field as Exclude<BriefField, "employees">;
  return criterionText(
    values.length === 1
      ? { field: textField, operator: "equals", value: values[0] }
      : { field: textField, operator: "in", value: [...values] },
  );
}

/**
 * Everything one part of a brief says about one field: its text values by match key (so
 * `equals Phoenix` and `in ["phoenix"]` are the same, in any order), and its ranges.
 */
type FieldSide = { values: Map<string, string>; ranges: Map<string, string> };

function fieldSide(criteria: readonly BriefCriterion[], field: BriefField): FieldSide {
  const side: FieldSide = { values: new Map(), ranges: new Map() };
  for (const criterion of criteria) {
    if (criterion.field !== field) continue;
    if (criterion.operator === "range") {
      side.ranges.set(`${criterion.value.min}-${criterion.value.max}`, criterionText(criterion));
    } else {
      for (const value of criterion.operator === "equals" ? [criterion.value] : criterion.value) {
        const key = matchKey(value);
        if (!side.values.has(key)) side.values.set(key, value);
      }
    }
  }
  return side;
}

const isEmpty = (side: FieldSide) => side.values.size === 0 && side.ranges.size === 0;

/** The side's values as words, text values first, then ranges. */
function sideText(field: BriefField, side: FieldSide, only?: ReadonlySet<string>): string {
  const values = [...side.values].filter(([key]) => !only || only.has(key)).map(([, value]) => value);
  const parts = [...(values.length > 0 ? [valuesText(field, values)] : []), ...side.ranges.values()];
  return parts.join(" or ");
}

/** Keys in `a` and not in `b`. */
const minus = (a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>) =>
  new Set([...a.keys()].filter((key) => !b.has(key)));

/** How one part's criteria on one field changed, or null when they didn't. */
function fieldChange(part: CriteriaPart, field: BriefField, before: FieldSide, after: FieldSide): BriefChange | null {
  const addedValues = minus(after.values, before.values);
  const removedValues = minus(before.values, after.values);
  const rangesChanged = minus(after.ranges, before.ranges).size > 0 || minus(before.ranges, after.ranges).size > 0;
  if (addedValues.size === 0 && removedValues.size === 0 && !rangesChanged) return null;

  const whole = { before: sideText(field, before), after: sideText(field, after) };
  if (isEmpty(before)) return { kind: "added", part, field, after: whole.after, text: DIFF_TEXT.added(part, field, whole.after) };
  if (isEmpty(after)) return { kind: "removed", part, field, before: whole.before, text: DIFF_TEXT.removed(part, field, whole.before) };
  if (!rangesChanged && removedValues.size === 0) {
    const added = sideText(field, after, addedValues);
    return { kind: "added", part, field, ...whole, text: DIFF_TEXT.added(part, field, added) };
  }
  if (!rangesChanged && addedValues.size === 0) {
    const removed = sideText(field, before, removedValues);
    return { kind: "removed", part, field, ...whole, text: DIFF_TEXT.removed(part, field, removed) };
  }
  return { kind: "changed", part, field, ...whole, text: DIFF_TEXT.changed(part, field, whole.before, whole.after) };
}

/**
 * Whether the importance order changed: one brief orders its preferences and the other doesn't,
 * or the dimensions both orders list are in a different order. A dimension that is only in one
 * of them (a preference added or removed, already its own change) doesn't count on its own.
 */
function orderChanged(before: SearchBrief, after: SearchBrief): boolean {
  const a = before.priorityOrder ?? [];
  const b = after.priorityOrder ?? [];
  if ((a.length > 0) !== (b.length > 0)) return true;
  const shared = a.filter((dimension) => b.includes(dimension));
  const sharedAfter = b.filter((dimension) => a.includes(dimension));
  return shared.some((dimension, index) => sharedAfter[index] !== dimension);
}

/**
 * Every change from `before` to `after`, in the fixed order. Assumptions are left out (the card
 * shows them anyway). Text values are compared with `matchKey()`, so spelling of case and
 * spaces, the order inside an `in` list and `equals X` versus `in [X]` are not changes.
 */
export function diffBriefs(before: SearchBrief, after: SearchBrief): BriefChange[] {
  const changes: BriefChange[] = [];
  if (before.intent !== after.intent) {
    changes.push({
      kind: "changed",
      part: "intent",
      field: null,
      before: DIFF_TEXT.goals[before.intent],
      after: DIFF_TEXT.goals[after.intent],
      text: DIFF_TEXT.goal(before.intent, after.intent),
    });
  }
  for (const part of CRITERIA_PARTS) {
    for (const field of BRIEF_FIELDS) {
      const change = fieldChange(part, field, fieldSide(before[part], field), fieldSide(after[part], field));
      if (change) changes.push(change);
    }
  }
  if (before.listSize !== after.listSize) {
    const [from, to] = [number(before.listSize), number(after.listSize)];
    changes.push({ kind: "changed", part: "listSize", field: null, before: from, after: to, text: DIFF_TEXT.listSize(from, to) });
  }
  if (orderChanged(before, after)) changes.push({ kind: "changed", part: "priorityOrder", field: null, text: DIFF_TEXT.order });
  return changes;
}

/** How a chip on the proposal card is marked: a value that is new, or one that replaces another. */
export type ChipMark = "new" | "changed";

/**
 * The marks for the chips of `briefChips(after)`, by chip id. A value on a field that had none
 * before is "new"; a value added next to the old ones (city Phoenix, then Phoenix and Tempe) is
 * "new" too; a value that replaces another (title Owner, then Operations Manager), or a changed
 * range, is "changed". The goal and the list size are "changed" when they changed. Unchanged
 * chips have no mark. Removed values have no chip: they are only in the list of changes.
 */
export function chipMarks(before: SearchBrief, after: SearchBrief): Record<string, ChipMark> {
  const marks: Record<string, ChipMark> = {};
  if (before.intent !== after.intent) marks[GOAL_CHIP_ID] = "changed";
  if (before.listSize !== after.listSize) marks[LIST_SIZE_CHIP_ID] = "changed";
  for (const part of CRITERIA_PARTS) {
    after[part].forEach((criterion, index) => {
      const old = fieldSide(before[part], criterion.field);
      const change = fieldChange(part, criterion.field, old, fieldSide(after[part], criterion.field));
      if (!change) return;
      const mark: ChipMark = change.kind === "changed" ? "changed" : "new";
      if (criterion.operator === "range") {
        if (!old.ranges.has(`${criterion.value.min}-${criterion.value.max}`)) marks[criterionChipId(part, index, 0)] = mark;
        return;
      }
      const values = criterion.operator === "equals" ? [criterion.value] : criterion.value;
      values.forEach((value, valueIndex) => {
        if (!old.values.has(matchKey(value))) marks[criterionChipId(part, index, valueIndex)] = mark;
      });
    });
  }
  return marks;
}
