import type { z } from "zod";
import {
  type BriefCriterion,
  type BriefDimension,
  type BriefField,
  type BriefIntent,
  LIST_SIZE_DEFAULT,
  type SearchBrief,
  searchBriefSchema,
} from "./schema";

/**
 * Turns what the criteria form holds into a SearchBrief (TR-14, TR-15). The form never builds a
 * second shape: it keeps the user's choices, and `toBrief()` writes them as a candidate brief
 * and checks it with `searchBriefSchema`, the same check the Phase 2 AI's briefs will get.
 *
 * Pure: no React, no I/O.
 */

/** The fields the form offers as must-haves, in the order they appear in a brief. */
export const MUST_HAVE_FIELDS = ["city", "state", "industry", "title"] as const satisfies readonly BriefField[];
export type MustHaveField = (typeof MUST_HAVE_FIELDS)[number];

/**
 * The preferences the form offers, in the order they appear in a brief and the default
 * importance order. Each is one field and one dimension. There is no geography preference in
 * the form (the schema and ranking still support one, for Phase 2).
 */
export const PREFERENCE_DIMENSIONS = ["industry", "title", "employees"] as const satisfies readonly (BriefField &
  BriefDimension)[];
export type PreferenceDimension = (typeof PREFERENCE_DIMENSIONS)[number];

/** The preferences picked from a list of values. Employees is a range instead. */
export const PICKED_PREFERENCES = ["industry", "title"] as const satisfies readonly PreferenceDimension[];
export type PickedPreference = (typeof PICKED_PREFERENCES)[number];

/** The fields the form offers as exclusions, in the order they appear in a brief. */
export const EXCLUSION_FIELDS = ["industry", "title", "city"] as const satisfies readonly MustHaveField[];
export type ExclusionField = (typeof EXCLUSION_FIELDS)[number];

/** A value the user can pick: its match key (to tell values apart) and its label (what the brief gets). */
export type PickerOption = { key: string; label: string };

/** "none" is No preference: the dimension isn't in the brief. */
export type PreferenceMode = "none" | "prefer";

/** What the form holds. Picked values are match keys; none picked means no filter. Numbers are kept as typed. */
export type CriteriaForm = {
  intent: BriefIntent | null;
  mustHaves: Record<MustHaveField, readonly string[]>;
  preferences: Record<PickedPreference, { mode: PreferenceMode; picked: readonly string[] }> & {
    employees: { mode: PreferenceMode; from: string; to: string };
  };
  /** "Rank my preferences by importance". When false, the brief has no priorityOrder. */
  rankByImportance: boolean;
  /**
   * Every preference, most important first. Only the ones set to Prefer are shown and used;
   * one set back to No preference moves to the end, so it comes back last.
   */
  importanceOrder: readonly PreferenceDimension[];
  exclusions: Record<ExclusionField, readonly string[]>;
  /** As typed in the number box, e.g. "40". */
  listSize: string;
};

/** The form's inputs, which errors are keyed by. */
export type CriteriaFormField =
  | "intent"
  | MustHaveField
  | `prefer-${PreferenceDimension}`
  | `exclude-${ExclusionField}`
  | "listSize";

export type CriteriaFormErrors = Partial<Record<CriteriaFormField, string>>;

export type ToBriefResult = { ok: true; brief: SearchBrief } | { ok: false; fieldErrors: CriteriaFormErrors };

const EMPTY_PICKED = { mode: "none", picked: [] } as const satisfies CriteriaForm["preferences"]["industry"];
const EMPTY_EMPLOYEES = { mode: "none", from: "", to: "" } as const satisfies CriteriaForm["preferences"]["employees"];

/** A form with nothing chosen: no goal, no must-haves, No preference everywhere, nothing left out, 40 rows. */
export const EMPTY_CRITERIA_FORM: CriteriaForm = {
  intent: null,
  mustHaves: { city: [], state: [], industry: [], title: [] },
  preferences: { industry: EMPTY_PICKED, title: EMPTY_PICKED, employees: EMPTY_EMPLOYEES },
  rankByImportance: false,
  importanceOrder: PREFERENCE_DIMENSIONS,
  exclusions: { industry: [], title: [], city: [] },
  listSize: String(LIST_SIZE_DEFAULT),
};

/** Messages for the form, in place of the schema's, which are written for code. */
export const CRITERIA_FORM_ERRORS = {
  intent: "Choose what you're trying to do.",
  pickIndustry: "Pick at least one industry, or choose No preference.",
  pickTitle: "Pick at least one title, or choose No preference.",
  employeesBoth: "Enter both From and To, or choose No preference.",
  employeesWhole: "Enter whole numbers of 0 or more, for example 10 and 99.",
  employeesOrder: "From can't be more than To. For example, from 10 to 99.",
  listSize: "Choose a whole number from 1 to 100.",
} as const;

const PICK_ERRORS: Record<PickedPreference, string> = {
  industry: CRITERIA_FORM_ERRORS.pickIndustry,
  title: CRITERIA_FORM_ERRORS.pickTitle,
};

/** The preferences set to Prefer, most important first. */
export function activePreferences(form: Pick<CriteriaForm, "preferences" | "importanceOrder">): PreferenceDimension[] {
  return form.importanceOrder.filter((dimension) => form.preferences[dimension].mode === "prefer");
}

/**
 * Sets a preference to No preference or Prefer. No preference clears what was picked or typed
 * and moves the dimension to the end of the importance order. Nothing else changes.
 */
export function setPreferenceMode(form: CriteriaForm, dimension: PreferenceDimension, mode: PreferenceMode): CriteriaForm {
  const current = form.preferences[dimension];
  if (current.mode === mode) return form;
  const next = mode === "prefer" ? { ...current, mode } : dimension === "employees" ? EMPTY_EMPLOYEES : EMPTY_PICKED;
  return {
    ...form,
    preferences: { ...form.preferences, [dimension]: next },
    importanceOrder:
      mode === "none" ? [...form.importanceOrder.filter((d) => d !== dimension), dimension] : form.importanceOrder,
  };
}

/**
 * Moves one active preference up (more important) or down among the active ones. Returns the
 * new importance order, with the inactive ones after the active ones. Unchanged at either end.
 */
export function moveImportance(
  form: Pick<CriteriaForm, "preferences" | "importanceOrder">,
  dimension: PreferenceDimension,
  direction: "up" | "down",
): PreferenceDimension[] {
  const active = activePreferences(form);
  const from = active.indexOf(dimension);
  const to = direction === "up" ? from - 1 : from + 1;
  if (from === -1 || to < 0 || to >= active.length) return [...form.importanceOrder];
  [active[from], active[to]] = [active[to], active[from]];
  return [...active, ...form.importanceOrder.filter((d) => !active.includes(d))];
}

/**
 * One criterion for picked values: one value gives `equals`, two or more give `in` with the
 * values in option order. Keys that aren't in `options` are ignored. Null when nothing is picked.
 */
function pickedCriterion(field: MustHaveField, picked: readonly string[], options: readonly PickerOption[]): BriefCriterion | null {
  const keys = new Set(picked);
  const values = options.filter((option) => keys.has(option.key)).map((option) => option.label);
  if (values.length === 0) return null;
  return values.length === 1 ? { field, operator: "equals", value: values[0] } : { field, operator: "in", value: values };
}

/** A criterion before validation: an employees range may still hold a blank (null) or a fraction. */
type CandidateCriterion =
  | BriefCriterion
  | { field: "employees"; operator: "range"; value: { min: number | null; max: number | null } };

/** Typed text as a number: blank is null (so the schema rejects it), anything else goes through Number(). */
const typedNumber = (text: string) => (text.trim() === "" ? null : Number(text));

/** The message for a From and To that the schema rejected. */
function employeesError({ from, to }: { from: string; to: string }): string {
  const min = typedNumber(from);
  const max = typedNumber(to);
  if (min === null || max === null) return CRITERIA_FORM_ERRORS.employeesBoth;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) return CRITERIA_FORM_ERRORS.employeesWhole;
  return CRITERIA_FORM_ERRORS.employeesOrder;
}

/** The form input a schema issue belongs to, or null for one the form has no input for. */
function issueField(
  issue: z.core.$ZodIssue,
  built: Record<"mustHaves" | "preferences" | "exclusions", readonly { field: BriefField }[]>,
): CriteriaFormField | null {
  const [first, index] = issue.path;
  if (first === "intent") return "intent";
  if (first === "listSize") return "listSize";
  if (typeof index !== "number") return null;
  // Every criterion the form builds is for a field the form has an input for.
  const field = (first === "mustHaves" || first === "preferences" || first === "exclusions") && built[first][index]?.field;
  if (!field) return null;
  if (first === "mustHaves") return field as MustHaveField;
  if (first === "preferences") return `prefer-${field as PreferenceDimension}`;
  return `exclude-${field as ExclusionField}`;
}

/**
 * Builds a SearchBrief from the form and validates it. `options` are the values each picker
 * offers (from `fieldOptions()`); the brief gets their labels, so it matches the records.
 *
 * Lists are in a fixed order: must-haves city, state, industry, title; preferences industry,
 * title, employees; exclusions industry, title, city. `priorityOrder` is the active preferences
 * in importance order, and only there when "Rank my preferences by importance" is ticked.
 * On failure, each form input gets the first message about it.
 */
export function toBrief(form: CriteriaForm, options: Record<MustHaveField, readonly PickerOption[]>): ToBriefResult {
  const fieldErrors: CriteriaFormErrors = {};

  const mustHaves = MUST_HAVE_FIELDS.flatMap((field) => pickedCriterion(field, form.mustHaves[field], options[field]) ?? []);

  const preferences: CandidateCriterion[] = [];
  const employees = form.preferences.employees;
  for (const dimension of PREFERENCE_DIMENSIONS) {
    if (form.preferences[dimension].mode !== "prefer") continue;
    if (dimension === "employees") {
      // Passed on as typed: the schema rejects a blank, a fraction or From above To.
      const value = { min: typedNumber(employees.from), max: typedNumber(employees.to) };
      preferences.push({ field: "employees", operator: "range", value });
      continue;
    }
    const criterion = pickedCriterion(dimension, form.preferences[dimension].picked, options[dimension]);
    if (criterion) preferences.push(criterion);
    else fieldErrors[`prefer-${dimension}`] = PICK_ERRORS[dimension];
  }

  const exclusions = EXCLUSION_FIELDS.flatMap((field) => pickedCriterion(field, form.exclusions[field], options[field]) ?? []);

  // Only preferences that made it into the brief, so a Prefer with nothing picked isn't ranked.
  const inBrief = new Set(preferences.map((criterion) => criterion.field));
  const priorityOrder = activePreferences(form).filter((dimension) => inBrief.has(dimension));

  const candidate = {
    ...(form.intent === null ? {} : { intent: form.intent }),
    mustHaves,
    preferences,
    exclusions,
    ...(form.rankByImportance && priorityOrder.length > 0 ? { priorityOrder } : {}),
    listSize: typedNumber(form.listSize),
  };

  const result = searchBriefSchema.safeParse(candidate);
  if (result.success && Object.keys(fieldErrors).length === 0) return { ok: true, brief: result.data };

  for (const issue of result.success ? [] : result.error.issues) {
    const field = issueField(issue, { mustHaves, preferences, exclusions });
    if (field === null || fieldErrors[field]) continue;
    fieldErrors[field] =
      field === "intent"
        ? CRITERIA_FORM_ERRORS.intent
        : field === "listSize"
          ? CRITERIA_FORM_ERRORS.listSize
          : field === "prefer-employees"
            ? employeesError(employees)
            : issue.message;
  }
  return { ok: false, fieldErrors };
}
