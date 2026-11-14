"use client";

import { type ReactNode, type Ref, useEffect, useMemo, useRef, useState } from "react";
import { inputClasses } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import {
  activePreferences,
  type CriteriaForm,
  type CriteriaFormErrors,
  type CriteriaFormField,
  EXCLUSION_FIELDS,
  type ExclusionField,
  moveImportance,
  MUST_HAVE_FIELDS,
  type MustHaveField,
  type PickedPreference,
  PREFERENCE_DIMENSIONS,
  type PreferenceDimension,
  type PreferenceMode,
  setPreferenceMode,
} from "../criteria/from-form";
import { type BriefIntent, LIST_SIZE_MAX, LIST_SIZE_MIN } from "../criteria/schema";
import { FIELD_LABELS } from "../import/fields";
import type { GroupedRecord } from "../normalize/duplicates";
import { type FieldOption, fieldOptions } from "../normalize/field-options";
import { ValuePicker } from "./value-picker";

/**
 * The criteria controls (TR-14, TR-15), shared by the Criteria step and the criteria summary's
 * inline editors (TR-16), so both edit the same `CriteriaForm` in the same way. Each control
 * gets the form, the picker options, the errors and `update(fields, next)`, which sets the new
 * form and clears the errors on `fields`.
 */

// Every string the controls show. Plain language, no em-dashes.
export const CRITERIA_TEXT = {
  goalLegend: "Goal",
  goalHint: "What is the list for?",
  goals: [
    { value: "business_owner", label: "Find prospective customers or partners" },
    { value: "job_seeker", label: "Find potential employers" },
  ] satisfies { value: BriefIntent; label: string }[],
  required: "Required",
  modes: [
    { value: "none", label: "No preference" },
    { value: "prefer", label: "Prefer" },
  ] satisfies { value: PreferenceMode; label: string }[],
  preferLegends: { industry: "Industries to prefer", title: "Titles to prefer" } satisfies Record<PickedPreference, string>,
  employeesHint: "Number of employees, for example from 10 to 99.",
  from: "From",
  to: "To",
  importanceHeading: "Importance order (optional)",
  rankByImportance: "Rank my preferences by importance",
  importanceHelp: "The first one counts most.",
  importanceEmpty: "Choose Prefer for at least one preference above to rank it.",
  move: (label: string, direction: "up" | "down") => `Move ${label} ${direction}`,
  moved: (label: string, position: number, total: number) => `${label} moved to position ${position} of ${total}.`,
  excludeLegends: {
    industry: "Industries to leave out",
    title: "Titles to leave out",
    city: "Cities to leave out",
  } satisfies Record<ExclusionField, string>,
  listSizeHeading: "List size",
  listSizeLabel: "How many rows do you want?",
  listSizeHint: `A whole number from ${LIST_SIZE_MIN} to ${LIST_SIZE_MAX}.`,
} as const;

/** What each preference is called. */
export const PREFERENCE_LABELS: Record<PreferenceDimension, string> = {
  industry: FIELD_LABELS.industry,
  title: FIELD_LABELS.title,
  employees: "Company size",
};

/** The id of the control an error summary link focuses. */
export const fieldId = (field: CriteriaFormField) => `criteria-${field}`;

/** Each form input's name in an error summary. */
export const FIELD_NAMES: Record<CriteriaFormField, string> = {
  intent: CRITERIA_TEXT.goalLegend,
  city: FIELD_LABELS.city,
  state: FIELD_LABELS.state,
  industry: FIELD_LABELS.industry,
  title: FIELD_LABELS.title,
  "prefer-industry": "Preferred industry",
  "prefer-title": "Preferred title",
  "prefer-employees": PREFERENCE_LABELS.employees,
  "exclude-industry": "Leave out industry",
  "exclude-title": "Leave out title",
  "exclude-city": "Leave out city",
  listSize: CRITERIA_TEXT.listSizeHeading,
};

/** Every form input, in the order the Criteria step shows them, for error summaries. */
export const FORM_FIELDS: readonly CriteriaFormField[] = [
  "intent",
  ...MUST_HAVE_FIELDS,
  ...PREFERENCE_DIMENSIONS.map((d) => `prefer-${d}` as const),
  ...EXCLUSION_FIELDS.map((f) => `exclude-${f}` as const),
  "listSize",
];

/** The exclusion input for a field, when there is one: a conflict shows there. */
export const exclusionFor = (field: string): CriteriaFormField[] =>
  (EXCLUSION_FIELDS as readonly string[]).includes(field) ? [`exclude-${field as ExclusionField}`] : [];

export const errorText = "text-[15px] font-medium text-red-700";

export type CriteriaOptions = Record<MustHaveField, FieldOption[]>;

/** The values each picker offers, read from the records with counts. */
export function useCriteriaOptions(records: readonly GroupedRecord[]): CriteriaOptions {
  return useMemo(
    () => Object.fromEntries(MUST_HAVE_FIELDS.map((field) => [field, fieldOptions(records, field)])) as CriteriaOptions,
    [records],
  );
}

/** Sets the new form and clears the errors on `fields`. */
export type CriteriaUpdate = (fields: readonly CriteriaFormField[], next: CriteriaForm) => void;

type ControlProps = {
  form: CriteriaForm;
  options: CriteriaOptions;
  errors: CriteriaFormErrors;
  update: CriteriaUpdate;
};

/**
 * A list of problems, each a link that focuses its input. It takes focus itself (through `ref`)
 * after a submit that didn't go through.
 */
export function ErrorSummary({
  title,
  errors,
  summaryRef,
}: {
  title: string;
  errors: CriteriaFormErrors;
  summaryRef: Ref<HTMLDivElement>;
}) {
  const fields = FORM_FIELDS.filter((field) => errors[field]);
  if (fields.length === 0) return null;
  return (
    <div
      ref={summaryRef}
      tabIndex={-1}
      role="alert"
      className="rounded-xl border-2 border-red-700 bg-white p-5 focus:outline-none md:p-6"
    >
      <h3 className="text-lg font-bold text-red-700">{title}</h3>
      <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-red-700">
        {fields.map((field) => (
          <li key={field}>
            <a
              href={`#${fieldId(field)}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(fieldId(field))?.focus();
              }}
              className="font-semibold text-red-700 underline hover:text-red-900"
            >
              {FIELD_NAMES[field]}: {errors[field]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Goal: two radio buttons, neither chosen at first. */
export function GoalField({ form, errors, update }: Omit<ControlProps, "options">) {
  const goalError = errors.intent;
  const goalErrorId = `${fieldId("intent")}-error`;
  const goalHintId = `${fieldId("intent")}-hint`;
  return (
    <fieldset
      aria-describedby={[goalHintId, goalError && goalErrorId].filter(Boolean).join(" ")}
      className="flex min-w-0 flex-col gap-3"
    >
      <legend className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-xl font-bold text-navy">
        {CRITERIA_TEXT.goalLegend}
        <span className="rounded-full bg-mist px-2.5 py-0.5 font-sans text-xs font-bold tracking-[0.06em] text-navy uppercase">
          {CRITERIA_TEXT.required}
        </span>
      </legend>
      <p id={goalHintId} className="mt-2 text-muted">
        {CRITERIA_TEXT.goalHint}
      </p>
      <div className="flex flex-col gap-2">
        {CRITERIA_TEXT.goals.map((goal, i) => (
          <label
            key={goal.value}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-ink hover:bg-ivory",
              form.intent === goal.value ? "border-navy bg-ivory" : goalError ? "border-red-700" : "border-sand",
            )}
          >
            <input
              // The first radio is what the error summary link focuses.
              id={i === 0 ? fieldId("intent") : undefined}
              type="radio"
              name="intent"
              value={goal.value}
              checked={form.intent === goal.value}
              onChange={() => update(["intent"], { ...form, intent: goal.value })}
              className="size-5 shrink-0 cursor-pointer accent-navy"
            />
            <span className="min-w-0">{goal.label}</span>
          </label>
        ))}
      </div>
      {goalError && (
        <p id={goalErrorId} className={errorText}>
          {goalError}
        </p>
      )}
    </fieldset>
  );
}

/** One must-have picker. */
export function MustHavePicker({ field, form, options, errors, update }: ControlProps & { field: MustHaveField }) {
  return (
    <ValuePicker
      id={fieldId(field)}
      legend={FIELD_LABELS[field]}
      options={options[field]}
      selected={form.mustHaves[field]}
      onChange={(keys) => update([field, ...exclusionFor(field)], { ...form, mustHaves: { ...form.mustHaves, [field]: keys } })}
      error={errors[field]}
    />
  );
}

const setMode = (
  { form, update }: Pick<ControlProps, "form" | "update">,
  dimension: PreferenceDimension,
  mode: PreferenceMode,
) => update([`prefer-${dimension}`, ...exclusionFor(dimension)], setPreferenceMode(form, dimension, mode));

/** An Industry or Title preference: No preference or Prefer, and under Prefer a picker. */
export function PickedPreferenceField({
  dimension,
  form,
  options,
  errors,
  update,
}: ControlProps & { dimension: PickedPreference }) {
  return (
    <PreferenceChoice
      dimension={dimension}
      mode={form.preferences[dimension].mode}
      onMode={(mode) => setMode({ form, update }, dimension, mode)}
    >
      <ValuePicker
        id={fieldId(`prefer-${dimension}`)}
        legend={CRITERIA_TEXT.preferLegends[dimension]}
        options={options[dimension]}
        selected={form.preferences[dimension].picked}
        onChange={(picked) =>
          update([`prefer-${dimension}`, ...exclusionFor(dimension)], {
            ...form,
            preferences: { ...form.preferences, [dimension]: { mode: "prefer", picked } },
          })
        }
        error={errors[`prefer-${dimension}`]}
      />
    </PreferenceChoice>
  );
}

/** The Company size preference: No preference or Prefer, and under Prefer From and To. */
export function EmployeesPreferenceField({ form, errors, update }: Omit<ControlProps, "options">) {
  const employees = form.preferences.employees;
  const employeesError = errors["prefer-employees"];
  const ids = { hint: `${fieldId("prefer-employees")}-hint`, error: `${fieldId("prefer-employees")}-error` };
  const input = (end: "from" | "to") => {
    const id = end === "from" ? fieldId("prefer-employees") : `${fieldId("prefer-employees")}-to`;
    return (
      <div key={end} className="flex w-32 flex-col gap-2">
        <label htmlFor={id} className="font-semibold text-ink">
          {CRITERIA_TEXT[end]}
        </label>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          autoComplete="off"
          value={employees[end]}
          onChange={(event) =>
            update(["prefer-employees"], {
              ...form,
              preferences: { ...form.preferences, employees: { ...employees, [end]: event.target.value } },
            })
          }
          aria-describedby={[ids.hint, employeesError && ids.error].filter(Boolean).join(" ")}
          aria-invalid={employeesError ? true : undefined}
          className={cn(inputClasses, "w-full")}
        />
      </div>
    );
  };

  return (
    <PreferenceChoice dimension="employees" mode={employees.mode} onMode={(mode) => setMode({ form, update }, "employees", mode)}>
      <div className="flex flex-col gap-3">
        <p id={ids.hint} className="text-[15px] text-slate">
          {CRITERIA_TEXT.employeesHint}
        </p>
        <div className="flex flex-wrap gap-4">{(["from", "to"] as const).map(input)}</div>
        {employeesError && (
          <p id={ids.error} className={errorText}>
            {employeesError}
          </p>
        )}
      </div>
    </PreferenceChoice>
  );
}

/** One exclusion picker. */
export function ExclusionPicker({ field, form, options, errors, update }: ControlProps & { field: ExclusionField }) {
  return (
    <ValuePicker
      id={fieldId(`exclude-${field}`)}
      legend={CRITERIA_TEXT.excludeLegends[field]}
      options={options[field]}
      selected={form.exclusions[field]}
      onChange={(keys) => update([`exclude-${field}`], { ...form, exclusions: { ...form.exclusions, [field]: keys } })}
      error={errors[`exclude-${field}`]}
    />
  );
}

/** "How many rows do you want?": the list size as typed. */
export function ListSizeField({ form, errors, update }: Omit<ControlProps, "options">) {
  const listSizeError = errors.listSize;
  const ids = { hint: `${fieldId("listSize")}-hint`, error: `${fieldId("listSize")}-error` };
  return (
    <>
      <label htmlFor={fieldId("listSize")} className="font-semibold text-ink">
        {CRITERIA_TEXT.listSizeLabel}
      </label>
      <p id={ids.hint} className="-mt-1 text-[15px] text-slate">
        {CRITERIA_TEXT.listSizeHint}
      </p>
      <input
        id={fieldId("listSize")}
        type="number"
        inputMode="numeric"
        min={LIST_SIZE_MIN}
        max={LIST_SIZE_MAX}
        step={1}
        autoComplete="off"
        value={form.listSize}
        onChange={(event) => update(["listSize"], { ...form, listSize: event.target.value })}
        aria-describedby={[ids.hint, listSizeError && ids.error].filter(Boolean).join(" ")}
        aria-invalid={listSizeError ? true : undefined}
        className={cn(inputClasses, "w-32")}
      />
      {listSizeError && (
        <p id={ids.error} className={errorText}>
          {listSizeError}
        </p>
      )}
    </>
  );
}

/**
 * One preference: No preference or Prefer, and, under Prefer, what to prefer (`children`).
 * No preference is the default and hides the inputs.
 */
function PreferenceChoice({
  dimension,
  mode,
  onMode,
  children,
}: {
  dimension: PreferenceDimension;
  mode: PreferenceMode;
  onMode: (mode: PreferenceMode) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col">
        <legend className="mb-3 text-base font-semibold text-ink">{PREFERENCE_LABELS[dimension]}</legend>
        <div className="flex flex-wrap gap-2">
          {CRITERIA_TEXT.modes.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 text-ink hover:bg-ivory",
                mode === option.value ? "border-navy bg-ivory" : "border-sand",
              )}
            >
              <input
                type="radio"
                name={`criteria-prefer-${dimension}-mode`}
                value={option.value}
                checked={mode === option.value}
                onChange={() => onMode(option.value)}
                className="size-5 shrink-0 cursor-pointer accent-navy"
              />
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>
      {mode === "prefer" && children}
    </div>
  );
}

const moveButtonClass =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-field bg-white text-navy hover:border-navy hover:bg-ivory disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-field disabled:hover:bg-white";

/**
 * "Rank my preferences by importance": when ticked, the active preferences in order, most
 * important first, with Move up and Move down. After a move, focus stays with the item that
 * moved (on the other button when it reaches the top or bottom) and screen readers hear its
 * new position, as in the profiles list.
 */
export function ImportanceOrder({ form, onChange }: { form: CriteriaForm; onChange: (form: CriteriaForm) => void }) {
  const active = activePreferences(form);
  const [message, setMessage] = useState("");
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const moved = useRef<{ dimension: PreferenceDimension; direction: "up" | "down" } | null>(null);

  // Runs after every render, but only acts once the list has re-rendered after a move.
  useEffect(() => {
    const move = moved.current;
    if (!move) return;
    moved.current = null;
    const position = active.indexOf(move.dimension);
    // At the top or bottom the button that was used is disabled, so focus the other one.
    const direction =
      move.direction === "up" ? (position === 0 ? "down" : "up") : position === active.length - 1 ? "up" : "down";
    buttons.current.get(`${move.dimension}-${direction}`)?.focus();
  });

  function move(dimension: PreferenceDimension, direction: "up" | "down") {
    const importanceOrder = moveImportance(form, dimension, direction);
    const position = activePreferences({ ...form, importanceOrder }).indexOf(dimension) + 1;
    moved.current = { dimension, direction };
    setMessage(CRITERIA_TEXT.moved(PREFERENCE_LABELS[dimension], position, active.length));
    onChange({ ...form, importanceOrder });
  }

  const helpId = "criteria-importance-help";
  return (
    <div className="mt-2 flex flex-col gap-3">
      <h4 className="font-serif text-lg font-bold text-navy">{CRITERIA_TEXT.importanceHeading}</h4>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
        <input
          type="checkbox"
          checked={form.rankByImportance}
          onChange={(event) => onChange({ ...form, rankByImportance: event.target.checked })}
          aria-describedby={helpId}
          className="size-5 shrink-0 cursor-pointer accent-navy"
        />
        {CRITERIA_TEXT.rankByImportance}
      </label>
      <p id={helpId} className="-mt-2 text-[15px] text-slate">
        {CRITERIA_TEXT.importanceHelp}
      </p>
      {form.rankByImportance &&
        (active.length === 0 ? (
          <p className="text-[15px] text-muted">{CRITERIA_TEXT.importanceEmpty}</p>
        ) : (
          <ol aria-label={CRITERIA_TEXT.importanceHeading} className="flex max-w-md flex-col gap-2">
            {active.map((dimension, index) => (
              <li
                key={dimension}
                className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-sand px-4 py-2"
              >
                <span className="min-w-0 text-ink">
                  <span className="font-semibold">{index + 1}.</span> {PREFERENCE_LABELS[dimension]}
                </span>
                <span className="flex gap-2">
                  {(["up", "down"] as const).map((direction) => (
                    <button
                      key={direction}
                      ref={(element) => {
                        const key = `${dimension}-${direction}`;
                        if (element) buttons.current.set(key, element);
                        else buttons.current.delete(key);
                      }}
                      type="button"
                      onClick={() => move(dimension, direction)}
                      disabled={direction === "up" ? index === 0 : index === active.length - 1}
                      aria-label={CRITERIA_TEXT.move(PREFERENCE_LABELS[dimension], direction)}
                      className={moveButtonClass}
                    >
                      <Icon name={direction === "up" ? "arrowUp" : "arrowDown"} size={20} />
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ol>
        ))}
      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  );
}
