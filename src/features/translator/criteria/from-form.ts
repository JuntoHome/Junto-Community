import type { z } from "zod";
import { searchBriefSchema, type BriefCriterion, type BriefField, type BriefIntent, type SearchBrief } from "./schema";

/**
 * Turns what the criteria form holds into a SearchBrief (TR-14). The form never builds a
 * second shape: it keeps the user's choices, and `toBrief()` writes them as a candidate brief
 * and checks it with `searchBriefSchema`, the same check the Phase 2 AI's briefs will get.
 *
 * Pure: no React, no I/O. TR-15 adds preferences, exclusions and list size here.
 */

/** The fields the form offers as must-haves, in the order they appear in a brief. */
export const MUST_HAVE_FIELDS = ["city", "state", "industry", "title"] as const satisfies readonly BriefField[];
export type MustHaveField = (typeof MUST_HAVE_FIELDS)[number];

/** A value the user can pick: its match key (to tell values apart) and its label (what the brief gets). */
export type PickerOption = { key: string; label: string };

/** What the form holds. Must-haves are the match keys of the picked values; none picked means no filter. */
export type CriteriaForm = {
  intent: BriefIntent | null;
  mustHaves: Record<MustHaveField, readonly string[]>;
};

/** The form's inputs, which errors are keyed by. */
export type CriteriaFormField = "intent" | MustHaveField;

export type CriteriaFormErrors = Partial<Record<CriteriaFormField, string>>;

export type ToBriefResult = { ok: true; brief: SearchBrief } | { ok: false; fieldErrors: CriteriaFormErrors };

/** A form with nothing chosen. Every must-have is optional; only the goal is required. */
export const EMPTY_CRITERIA_FORM: CriteriaForm = {
  intent: null,
  mustHaves: { city: [], state: [], industry: [], title: [] },
};

/** Messages for the form, in place of the schema's, which are written for code. */
export const CRITERIA_FORM_ERRORS = {
  intent: "Choose what you're trying to do.",
} as const satisfies CriteriaFormErrors;

/**
 * One criterion for a picked field: one value gives `equals`, two or more give `in` with the
 * values in option order. Keys that aren't in `options` are ignored. Null when nothing is picked.
 */
function mustHave(field: MustHaveField, picked: readonly string[], options: readonly PickerOption[]): BriefCriterion | null {
  const keys = new Set(picked);
  const values = options.filter((option) => keys.has(option.key)).map((option) => option.label);
  if (values.length === 0) return null;
  return values.length === 1 ? { field, operator: "equals", value: values[0] } : { field, operator: "in", value: values };
}

/** The form input a schema issue belongs to, or null for one the form has no input for. */
function issueField(issue: z.core.$ZodIssue, mustHaves: readonly BriefCriterion[]): CriteriaFormField | null {
  const [first, index] = issue.path;
  if (first === "intent") return "intent";
  // Every must-have the form builds is for one of MUST_HAVE_FIELDS.
  if (first === "mustHaves" && typeof index === "number") return (mustHaves[index]?.field as MustHaveField | undefined) ?? null;
  return null;
}

/**
 * Builds a SearchBrief from the form and validates it. `options` are the values each picker
 * offers (from `fieldOptions()`); the brief gets their labels, so it matches the records.
 *
 * `preferences` and `exclusions` stay empty and `listSize` takes the schema default until TR-15.
 * On failure, each form input gets the first message about it.
 */
export function toBrief(form: CriteriaForm, options: Record<MustHaveField, readonly PickerOption[]>): ToBriefResult {
  const mustHaves = MUST_HAVE_FIELDS.flatMap((field) => mustHave(field, form.mustHaves[field], options[field]) ?? []);
  const candidate = {
    ...(form.intent === null ? {} : { intent: form.intent }),
    mustHaves,
    preferences: [],
    exclusions: [],
  };

  const result = searchBriefSchema.safeParse(candidate);
  if (result.success) return { ok: true, brief: result.data };

  const fieldErrors: CriteriaFormErrors = {};
  for (const issue of result.error.issues) {
    const field = issueField(issue, mustHaves);
    if (field === null || fieldErrors[field]) continue;
    fieldErrors[field] = field === "intent" ? CRITERIA_FORM_ERRORS.intent : issue.message;
  }
  return { ok: false, fieldErrors };
}
