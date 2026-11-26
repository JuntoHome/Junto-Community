import { matchKey } from "../normalize/match-key";
import {
  type CriteriaForm,
  EXCLUSION_FIELDS,
  MUST_HAVE_FIELDS,
  type MustHaveField,
  PICKED_PREFERENCES,
  PREFERENCE_DIMENSIONS,
  type PreferenceDimension,
  type PreferenceMode,
} from "./from-form";
import { type BriefCriterion, type BriefField, type SearchBrief, searchBriefSchema } from "./schema";

/**
 * The way back from a SearchBrief to the criteria form (TR-45): the reverse of `toBrief()` in
 * `from-form.ts`. "Edit in form" on the AI's proposal, Confirm and rank (so the criteria
 * summary's editors start from the right form) and later Phase 2 tickets use it. `toBrief()` and
 * `briefToFormState()` are the only way between form state and a brief, so the form, the
 * summary's editors and the proposal's chips always mean the same thing.
 *
 * The round trip `toBrief(briefToFormState(brief), options)` gives back exactly `brief` when the
 * brief is in the form's shape (`inFormShape()`) and its values are the pickers' labels. Every
 * proposal the AI check passes (`ai/validate.ts`) is both: the check fixes the spelling to the
 * file's and then calls `inFormShape()`.
 *
 * Pure: no React, no I/O.
 */

/** The parts of a brief that hold criteria, with the fields the form offers in each, in form order. */
const FORM_FIELDS = {
  mustHaves: MUST_HAVE_FIELDS,
  preferences: PREFERENCE_DIMENSIONS,
  exclusions: EXCLUSION_FIELDS,
} as const satisfies Record<"mustHaves" | "preferences" | "exclusions", readonly BriefField[]>;

type CriteriaPart = keyof typeof FORM_FIELDS;

/** The text values of the criteria on `field`, as the form's picked keys (match keys). */
function pickedKeys(criteria: readonly BriefCriterion[], field: BriefField): string[] {
  return criteria
    .filter((criterion) => criterion.field === field)
    .flatMap((criterion) =>
      criterion.operator === "equals" ? [criterion.value] : criterion.operator === "in" ? criterion.value : [],
    )
    .map(matchKey);
}

/**
 * The form that `toBrief()` turns back into `brief`. Picked values are match keys, as the form
 * keeps them; `toBrief()` writes the pickers' labels for them. The importance order lists the
 * brief's `priorityOrder` first, then the other preferences set to Prefer, then the rest, so
 * the form's rule ("one set back to No preference moves to the end") holds. Assumptions are
 * carried along unchanged.
 */
export function briefToFormState(brief: SearchBrief): CriteriaForm {
  const prefers = (dimension: PreferenceDimension) =>
    brief.preferences.some((criterion) => criterion.field === dimension);
  const mode = (dimension: PreferenceDimension): PreferenceMode => (prefers(dimension) ? "prefer" : "none");

  const range = brief.preferences.find((criterion) => criterion.operator === "range");
  const employees =
    range?.operator === "range"
      ? { mode: "prefer" as const, from: String(range.value.min), to: String(range.value.max) }
      : { mode: "none" as const, from: "", to: "" };

  const listed = (brief.priorityOrder ?? []).filter((dimension): dimension is PreferenceDimension =>
    (PREFERENCE_DIMENSIONS as readonly string[]).includes(dimension),
  );
  const active = PREFERENCE_DIMENSIONS.filter(prefers);
  const importanceOrder = [...new Set([...listed, ...active, ...PREFERENCE_DIMENSIONS])];

  const byField = <F extends BriefField>(fields: readonly F[], criteria: readonly BriefCriterion[]) =>
    Object.fromEntries(fields.map((field) => [field, pickedKeys(criteria, field)])) as Record<F, string[]>;

  const picked = Object.fromEntries(
    PICKED_PREFERENCES.map((dimension) => [
      dimension,
      { mode: mode(dimension), picked: pickedKeys(brief.preferences, dimension) },
    ]),
  ) as Record<(typeof PICKED_PREFERENCES)[number], { mode: PreferenceMode; picked: string[] }>;

  return {
    intent: brief.intent,
    mustHaves: byField<MustHaveField>(MUST_HAVE_FIELDS, brief.mustHaves),
    preferences: { ...picked, employees },
    rankByImportance: listed.length > 0,
    importanceOrder,
    exclusions: byField(EXCLUSION_FIELDS, brief.exclusions),
    listSize: String(brief.listSize),
    assumptions: [...brief.assumptions],
  };
}

/** Sorts values the way the pickers list them (`fieldOptions()`: by label, `localeCompare` in English). */
const pickerOrder = (values: readonly string[]) => [...values].sort((a, b) => a.localeCompare(b, "en"));

/**
 * `brief` written the way the form writes it, or `{ ok: false }` when the form can't hold it.
 * Nothing that changes the ranking is changed:
 *
 * - Criteria are put in the form's field order (must-haves city, state, industry, title;
 *   preferences industry, title, employees; exclusions industry, title, city).
 * - The values of an `in` list are put in the pickers' order; an `in` with one value becomes
 *   `equals`.
 * - An empty `priorityOrder` is left out (ranking and the summary treat it as none).
 * - A `priorityOrder` that leaves out a preference gets it added at the end, in the form's order.
 *   The ranking already weights an unlisted preference that way (`weightsFor()` in
 *   `ranking/score.ts`), so the weights stay the same; the form can only hold a full order.
 *
 * It refuses a criterion on a field the form doesn't offer in that part (a city preference, a
 * company size must-have, a state leave-out) and two criteria on one field in one part (two city
 * must-haves mean "both", which one picker can't say).
 */
export function inFormShape(brief: SearchBrief): { ok: true; brief: SearchBrief } | { ok: false } {
  const parts = {} as Record<CriteriaPart, BriefCriterion[]>;
  for (const part of Object.keys(FORM_FIELDS) as CriteriaPart[]) {
    const fields: readonly BriefField[] = FORM_FIELDS[part];
    const criteria = brief[part];
    const seen = new Set<BriefField>();
    for (const criterion of criteria) {
      if (!fields.includes(criterion.field) || seen.has(criterion.field)) return { ok: false };
      seen.add(criterion.field);
    }
    parts[part] = [...criteria]
      .sort((a, b) => fields.indexOf(a.field) - fields.indexOf(b.field))
      .map((criterion): BriefCriterion => {
        if (criterion.operator !== "in") return criterion;
        // One value is written as "equals", as `toBrief()` writes it.
        if (criterion.value.length === 1) return { field: criterion.field, operator: "equals", value: criterion.value[0] };
        return { ...criterion, value: pickerOrder(criterion.value) };
      });
  }

  const preferred = PREFERENCE_DIMENSIONS.filter((dimension) =>
    parts.preferences.some((criterion) => criterion.field === dimension),
  );
  const listed = brief.priorityOrder ?? [];
  const shaped = {
    intent: brief.intent,
    ...parts,
    ...(listed.length > 0 && { priorityOrder: [...new Set([...listed, ...preferred])] }),
    listSize: brief.listSize,
    assumptions: brief.assumptions,
  };
  const checked = searchBriefSchema.safeParse(shaped);
  return checked.success ? { ok: true, brief: checked.data } : { ok: false };
}
