"use client";

import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
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
  toBrief,
} from "../criteria/from-form";
import { type BriefIntent, LIST_SIZE_MAX, LIST_SIZE_MIN, type SearchBrief } from "../criteria/schema";
import { FIELD_LABELS } from "../import/fields";
import type { GroupedRecord } from "../normalize/duplicates";
import { type FieldOption, fieldOptions } from "../normalize/field-options";
import { ValuePicker } from "./value-picker";

// Every string on this step. Plain language, no em-dashes.
const TEXT = {
  goalLegend: "Goal",
  goalHint: "What is the list for?",
  goals: [
    { value: "business_owner", label: "Find prospective customers or partners" },
    { value: "job_seeker", label: "Find potential employers" },
  ] satisfies { value: BriefIntent; label: string }[],
  required: "Required",
  mustHavesHeading: "Must-haves",
  mustHavesHelp:
    "Only rows that match every must-have are kept. Rows with a blank value for a must-have are left out.",
  mustHavesOptional: "All optional. Leave a field with nothing selected to keep every value.",
  moreMustHaves: "More must-haves (optional)",
  preferencesHeading: "Preferences",
  preferencesHelp: "These change the order of the list. They don't remove rows.",
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
  exclusionsHeading: "Leave out",
  exclusionsHelp: "Rows with these values are removed. A blank value is never removed.",
  excludeLegends: {
    industry: "Industries to leave out",
    title: "Titles to leave out",
    city: "Cities to leave out",
  } satisfies Record<ExclusionField, string>,
  listSizeHeading: "List size",
  listSizeLabel: "How many rows do you want?",
  listSizeHint: `A whole number from ${LIST_SIZE_MIN} to ${LIST_SIZE_MAX}.`,
  summaryTitle: "The criteria aren't ready yet. Please fix the following:",
  continue: "Continue",
} as const;

/** City and state first; industry and title under "More must-haves". */
const MAIN_FIELDS = ["city", "state"] as const satisfies readonly MustHaveField[];
const MORE_FIELDS = ["industry", "title"] as const satisfies readonly MustHaveField[];

/** What each preference is called on this step. */
const PREFERENCE_LABELS: Record<PreferenceDimension, string> = {
  industry: FIELD_LABELS.industry,
  title: FIELD_LABELS.title,
  employees: "Company size",
};

/** The id of the control an error summary link focuses. */
const fieldId = (field: CriteriaFormField) => `criteria-${field}`;

const FIELD_NAMES: Record<CriteriaFormField, string> = {
  intent: TEXT.goalLegend,
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
  listSize: TEXT.listSizeHeading,
};

/** In the order the form shows them, for the error summary. */
const FORM_FIELDS: readonly CriteriaFormField[] = [
  "intent",
  ...MUST_HAVE_FIELDS,
  ...PREFERENCE_DIMENSIONS.map((d) => `prefer-${d}` as const),
  ...EXCLUSION_FIELDS.map((f) => `exclude-${f}` as const),
  "listSize",
];

/** The exclusion input for a field, when there is one: a conflict shows there. */
const exclusionFor = (field: string): CriteriaFormField[] =>
  (EXCLUSION_FIELDS as readonly string[]).includes(field) ? [`exclude-${field as ExclusionField}`] : [];

const sectionHeading = "font-serif text-xl font-bold text-navy";
const errorText = "text-[15px] font-medium text-red-700";

/**
 * The Criteria step (TR-14, TR-15): the goal, must-haves, preferences with an optional
 * importance order, exclusions and list size. The pickers offer the values found in `records`,
 * with counts. On Continue the form becomes a SearchBrief through `toBrief()`; nothing is
 * posted. The form's state is held by the wizard, so it survives leaving the step, and each
 * change touches only its own section.
 *
 * There is no geography preference here on purpose: the issue doesn't ask for one, and city
 * and state are must-haves. The schema and ranking (TR-18) still support it for Phase 2's AI.
 */
export function CriteriaStep({
  records,
  form,
  onFormChange,
  onContinue,
}: {
  records: readonly GroupedRecord[];
  form: CriteriaForm;
  onFormChange: (form: CriteriaForm) => void;
  onContinue: (brief: SearchBrief) => void;
}) {
  const options = useMemo(
    () =>
      Object.fromEntries(MUST_HAVE_FIELDS.map((field) => [field, fieldOptions(records, field)])) as Record<
        MustHaveField,
        FieldOption[]
      >,
    [records],
  );
  const [errors, setErrors] = useState<CriteriaFormErrors>({});
  const errorFields = FORM_FIELDS.filter((field) => errors[field]);

  // After a Continue that didn't go through, take keyboard and screen reader users to the summary.
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  /** Changes the form, and drops the errors on the inputs it affects. */
  function update(fields: readonly CriteriaFormField[], next: CriteriaForm) {
    onFormChange(next);
    if (!fields.some((field) => errors[field])) return;
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of fields) delete next[field];
      return next;
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toBrief(form, options);
    if (result.ok) {
      setErrors({});
      onContinue(result.brief);
    } else {
      setErrors(result.fieldErrors);
      setFailedSubmits((n) => n + 1);
    }
  }

  const mustHavePicker = (field: MustHaveField) => (
    <ValuePicker
      key={field}
      id={fieldId(field)}
      legend={FIELD_LABELS[field]}
      options={options[field]}
      selected={form.mustHaves[field]}
      onChange={(keys) =>
        update([field, ...exclusionFor(field)], { ...form, mustHaves: { ...form.mustHaves, [field]: keys } })
      }
      error={errors[field]}
    />
  );

  const setMode = (dimension: PreferenceDimension, mode: PreferenceMode) =>
    update([`prefer-${dimension}`, ...exclusionFor(dimension)], setPreferenceMode(form, dimension, mode));

  const pickedPreference = (dimension: PickedPreference) => (
    <PreferenceChoice
      key={dimension}
      dimension={dimension}
      mode={form.preferences[dimension].mode}
      onMode={(mode) => setMode(dimension, mode)}
    >
      <ValuePicker
        id={fieldId(`prefer-${dimension}`)}
        legend={TEXT.preferLegends[dimension]}
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

  const employees = form.preferences.employees;
  const employeesError = errors["prefer-employees"];
  const employeesIds = { hint: `${fieldId("prefer-employees")}-hint`, error: `${fieldId("prefer-employees")}-error` };
  const employeesInput = (end: "from" | "to") => (
    <div key={end} className="flex w-32 flex-col gap-2">
      <label htmlFor={end === "from" ? fieldId("prefer-employees") : `${fieldId("prefer-employees")}-to`} className="font-semibold text-ink">
        {TEXT[end]}
      </label>
      <input
        id={end === "from" ? fieldId("prefer-employees") : `${fieldId("prefer-employees")}-to`}
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
        aria-describedby={[employeesIds.hint, employeesError && employeesIds.error].filter(Boolean).join(" ")}
        aria-invalid={employeesError ? true : undefined}
        className={cn(inputClasses, "w-full")}
      />
    </div>
  );

  const exclusionPicker = (field: ExclusionField) => (
    <ValuePicker
      key={field}
      id={fieldId(`exclude-${field}`)}
      legend={TEXT.excludeLegends[field]}
      options={options[field]}
      selected={form.exclusions[field]}
      onChange={(keys) => update([`exclude-${field}`], { ...form, exclusions: { ...form.exclusions, [field]: keys } })}
      error={errors[`exclude-${field}`]}
    />
  );

  const goalError = errors.intent;
  const goalErrorId = `${fieldId("intent")}-error`;
  const goalHintId = `${fieldId("intent")}-hint`;
  const listSizeError = errors.listSize;
  const listSizeIds = { hint: `${fieldId("listSize")}-hint`, error: `${fieldId("listSize")}-error` };

  return (
    <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-8 text-base">
      {errorFields.length > 0 && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-xl border-2 border-red-700 bg-white p-5 focus:outline-none md:p-6"
        >
          <h3 className="text-lg font-bold text-red-700">{TEXT.summaryTitle}</h3>
          <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-red-700">
            {errorFields.map((field) => (
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
      )}

      <fieldset
        aria-describedby={[goalHintId, goalError && goalErrorId].filter(Boolean).join(" ")}
        className="flex min-w-0 flex-col gap-3"
      >
        <legend className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-serif text-xl font-bold text-navy">
          {TEXT.goalLegend}
          <span className="rounded-full bg-mist px-2.5 py-0.5 font-sans text-xs font-bold tracking-[0.06em] text-navy uppercase">
            {TEXT.required}
          </span>
        </legend>
        <p id={goalHintId} className="mt-2 text-muted">
          {TEXT.goalHint}
        </p>
        <div className="flex flex-col gap-2">
          {TEXT.goals.map((goal, i) => (
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

      <section aria-labelledby="criteria-must-haves" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-must-haves" className={sectionHeading}>
            {TEXT.mustHavesHeading}
          </h3>
          <p className="text-muted">{TEXT.mustHavesHelp}</p>
          <p className="text-muted">{TEXT.mustHavesOptional}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">{MAIN_FIELDS.map(mustHavePicker)}</div>
        <h4 className="mt-2 font-serif text-lg font-bold text-navy">{TEXT.moreMustHaves}</h4>
        <div className="grid gap-6 md:grid-cols-2">{MORE_FIELDS.map(mustHavePicker)}</div>
      </section>

      <section aria-labelledby="criteria-preferences" className="flex flex-col gap-4 border-t border-sand pt-6">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-preferences" className={sectionHeading}>
            {TEXT.preferencesHeading}
          </h3>
          <p className="text-muted">{TEXT.preferencesHelp}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">{(["industry", "title"] as const).map(pickedPreference)}</div>
        <PreferenceChoice
          dimension="employees"
          mode={employees.mode}
          onMode={(mode) => setMode("employees", mode)}
        >
          <div className="flex flex-col gap-3">
            <p id={employeesIds.hint} className="text-[15px] text-slate">
              {TEXT.employeesHint}
            </p>
            <div className="flex flex-wrap gap-4">{(["from", "to"] as const).map(employeesInput)}</div>
            {employeesError && (
              <p id={employeesIds.error} className={errorText}>
                {employeesError}
              </p>
            )}
          </div>
        </PreferenceChoice>

        <ImportanceOrder form={form} onChange={(next) => update([], next)} />
      </section>

      <section aria-labelledby="criteria-exclusions" className="flex flex-col gap-4 border-t border-sand pt-6">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-exclusions" className={sectionHeading}>
            {TEXT.exclusionsHeading}
          </h3>
          <p className="text-muted">{TEXT.exclusionsHelp}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">{EXCLUSION_FIELDS.map(exclusionPicker)}</div>
      </section>

      <section aria-labelledby="criteria-list-size" className="flex flex-col gap-3 border-t border-sand pt-6">
        <h3 id="criteria-list-size" className={sectionHeading}>
          {TEXT.listSizeHeading}
        </h3>
        <label htmlFor={fieldId("listSize")} className="font-semibold text-ink">
          {TEXT.listSizeLabel}
        </label>
        <p id={listSizeIds.hint} className="-mt-1 text-[15px] text-slate">
          {TEXT.listSizeHint}
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
          aria-describedby={[listSizeIds.hint, listSizeError && listSizeIds.error].filter(Boolean).join(" ")}
          aria-invalid={listSizeError ? true : undefined}
          className={cn(inputClasses, "w-32")}
        />
        {listSizeError && (
          <p id={listSizeIds.error} className={errorText}>
            {listSizeError}
          </p>
        )}
      </section>

      <div className="flex flex-col items-start gap-3 border-t border-sand pt-6">
        <button type="submit" className={buttonClasses("navy", "md", "cursor-pointer")}>
          {TEXT.continue}
        </button>
      </div>
    </form>
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
          {TEXT.modes.map((option) => (
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
function ImportanceOrder({ form, onChange }: { form: CriteriaForm; onChange: (form: CriteriaForm) => void }) {
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
    setMessage(TEXT.moved(PREFERENCE_LABELS[dimension], position, active.length));
    onChange({ ...form, importanceOrder });
  }

  const helpId = "criteria-importance-help";
  return (
    <div className="mt-2 flex flex-col gap-3">
      <h4 className="font-serif text-lg font-bold text-navy">{TEXT.importanceHeading}</h4>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-ink">
        <input
          type="checkbox"
          checked={form.rankByImportance}
          onChange={(event) => onChange({ ...form, rankByImportance: event.target.checked })}
          aria-describedby={helpId}
          className="size-5 shrink-0 cursor-pointer accent-navy"
        />
        {TEXT.rankByImportance}
      </label>
      <p id={helpId} className="-mt-2 text-[15px] text-slate">
        {TEXT.importanceHelp}
      </p>
      {form.rankByImportance &&
        (active.length === 0 ? (
          <p className="text-[15px] text-muted">{TEXT.importanceEmpty}</p>
        ) : (
          <ol aria-label={TEXT.importanceHeading} className="flex max-w-md flex-col gap-2">
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
                      aria-label={TEXT.move(PREFERENCE_LABELS[dimension], direction)}
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
