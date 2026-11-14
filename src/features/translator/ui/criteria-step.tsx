"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  type CriteriaForm,
  type CriteriaFormErrors,
  type CriteriaFormField,
  MUST_HAVE_FIELDS,
  type MustHaveField,
  toBrief,
} from "../criteria/from-form";
import type { BriefIntent, SearchBrief } from "../criteria/schema";
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
  summaryTitle: "The criteria aren't ready yet. Please fix the following:",
  continue: "Continue",
} as const;

/** City and state first; industry and title under "More must-haves". */
const MAIN_FIELDS = ["city", "state"] as const satisfies readonly MustHaveField[];
const MORE_FIELDS = ["industry", "title"] as const satisfies readonly MustHaveField[];

/** The id of the control an error summary link focuses. */
const fieldId = (field: CriteriaFormField) => `criteria-${field}`;

const FIELD_NAMES: Record<CriteriaFormField, string> = {
  intent: TEXT.goalLegend,
  city: FIELD_LABELS.city,
  state: FIELD_LABELS.state,
  industry: FIELD_LABELS.industry,
  title: FIELD_LABELS.title,
};

/** In the order the form shows them, for the error summary. */
const FORM_FIELDS: readonly CriteriaFormField[] = ["intent", ...MUST_HAVE_FIELDS];

/**
 * The Criteria step (TR-14): the goal and the must-haves. The pickers offer the values found
 * in `records`, with counts. On Continue the form becomes a SearchBrief through `toBrief()`;
 * nothing is posted. The form's state is held by the wizard, so it survives leaving the step.
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

  /** Changes the form, and drops the error on the input that changed. */
  function update(field: CriteriaFormField, next: CriteriaForm) {
    onFormChange(next);
    if (!errors[field]) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
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

  const picker = (field: MustHaveField) => (
    <ValuePicker
      key={field}
      id={fieldId(field)}
      legend={FIELD_LABELS[field]}
      options={options[field]}
      selected={form.mustHaves[field]}
      onChange={(keys) => update(field, { ...form, mustHaves: { ...form.mustHaves, [field]: keys } })}
      error={errors[field]}
    />
  );

  const goalError = errors.intent;
  const goalErrorId = `${fieldId("intent")}-error`;
  const goalHintId = `${fieldId("intent")}-hint`;

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
                onChange={() => update("intent", { ...form, intent: goal.value })}
                className="size-5 shrink-0 cursor-pointer accent-navy"
              />
              <span className="min-w-0">{goal.label}</span>
            </label>
          ))}
        </div>
        {goalError && (
          <p id={goalErrorId} className="text-[15px] font-medium text-red-700">
            {goalError}
          </p>
        )}
      </fieldset>

      <section aria-labelledby="criteria-must-haves" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-must-haves" className="font-serif text-xl font-bold text-navy">
            {TEXT.mustHavesHeading}
          </h3>
          <p className="text-muted">{TEXT.mustHavesHelp}</p>
          <p className="text-muted">{TEXT.mustHavesOptional}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">{MAIN_FIELDS.map(picker)}</div>
        <h4 className="mt-2 font-serif text-lg font-bold text-navy">{TEXT.moreMustHaves}</h4>
        <div className="grid gap-6 md:grid-cols-2">{MORE_FIELDS.map(picker)}</div>
      </section>

      {/* TODO(TR-15): preferences, exclusions and list size join this form, above Continue. */}
      <div className="flex flex-col items-start gap-3 border-t border-sand pt-6">
        <button type="submit" className={buttonClasses("navy", "md", "cursor-pointer")}>
          {TEXT.continue}
        </button>
      </div>
    </form>
  );
}
