"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { type CriteriaForm, type CriteriaFormErrors, EXCLUSION_FIELDS, type MustHaveField, toBrief } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import {
  CRITERIA_TEXT,
  type CriteriaUpdate,
  EmployeesPreferenceField,
  ErrorSummary,
  ExclusionPicker,
  GoalField,
  ImportanceOrder,
  ListSizeField,
  MustHavePicker,
  PickedPreferenceField,
  useCriteriaOptions,
} from "./criteria-controls";

// The strings only this step shows. The controls' own are in criteria-controls.tsx. Plain language, no em-dashes.
const TEXT = {
  mustHavesHeading: "Must-haves",
  mustHavesHelp:
    "Only rows that match every must-have are kept. Rows with a blank value for a must-have are left out.",
  mustHavesOptional: "All optional. Leave a field with nothing selected to keep every value.",
  moreMustHaves: "More must-haves (optional)",
  preferencesHeading: "Preferences",
  preferencesHelp: "These change the order of the list. They don't remove rows.",
  exclusionsHeading: "Leave out",
  exclusionsHelp: "Rows with these values are removed. A blank value is never removed.",
  summaryTitle: "The criteria aren't ready yet. Please fix the following:",
  continue: "Continue",
} as const;

/** City and state first; industry and title under "More must-haves". */
const MAIN_FIELDS = ["city", "state"] as const satisfies readonly MustHaveField[];
const MORE_FIELDS = ["industry", "title"] as const satisfies readonly MustHaveField[];

const sectionHeading = "font-serif text-xl font-bold text-navy";

/**
 * The Criteria step (TR-14, TR-15): the goal, must-haves, preferences with an optional
 * importance order, exclusions and list size. The pickers offer the values found in `records`,
 * with counts. On Continue the form becomes a SearchBrief through `toBrief()`; nothing is
 * posted. The form's state is held by the wizard, so it survives leaving the step, and each
 * change touches only its own section. The controls are shared with the criteria summary's
 * inline editors (TR-16), in `criteria-controls.tsx`.
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
  onContinue: (brief: SearchBrief, form: CriteriaForm) => void;
}) {
  const options = useCriteriaOptions(records);
  const [errors, setErrors] = useState<CriteriaFormErrors>({});

  // After a Continue that didn't go through, take keyboard and screen reader users to the summary.
  const summaryRef = useRef<HTMLDivElement>(null);
  const [failedSubmits, setFailedSubmits] = useState(0);
  useEffect(() => {
    if (failedSubmits > 0) summaryRef.current?.focus();
  }, [failedSubmits]);

  /** Changes the form, and drops the errors on the inputs it affects. */
  const update: CriteriaUpdate = (fields, next) => {
    onFormChange(next);
    if (!fields.some((field) => errors[field])) return;
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of fields) delete next[field];
      return next;
    });
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = toBrief(form, options);
    if (result.ok) {
      setErrors({});
      onContinue(result.brief, form);
    } else {
      setErrors(result.fieldErrors);
      setFailedSubmits((n) => n + 1);
    }
  }

  const controls = { form, options, errors, update };

  return (
    <form onSubmit={submit} noValidate className="mt-5 flex flex-col gap-8 text-base">
      <ErrorSummary title={TEXT.summaryTitle} errors={errors} summaryRef={summaryRef} />

      <GoalField {...controls} />

      <section aria-labelledby="criteria-must-haves" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-must-haves" className={sectionHeading}>
            {TEXT.mustHavesHeading}
          </h3>
          <p className="text-muted">{TEXT.mustHavesHelp}</p>
          <p className="text-muted">{TEXT.mustHavesOptional}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {MAIN_FIELDS.map((field) => (
            <MustHavePicker key={field} field={field} {...controls} />
          ))}
        </div>
        <h4 className="mt-2 font-serif text-lg font-bold text-navy">{TEXT.moreMustHaves}</h4>
        <div className="grid gap-6 md:grid-cols-2">
          {MORE_FIELDS.map((field) => (
            <MustHavePicker key={field} field={field} {...controls} />
          ))}
        </div>
      </section>

      <section aria-labelledby="criteria-preferences" className="flex flex-col gap-4 border-t border-sand pt-6">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-preferences" className={sectionHeading}>
            {TEXT.preferencesHeading}
          </h3>
          <p className="text-muted">{TEXT.preferencesHelp}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {(["industry", "title"] as const).map((dimension) => (
            <PickedPreferenceField key={dimension} dimension={dimension} {...controls} />
          ))}
        </div>
        <EmployeesPreferenceField {...controls} />

        <ImportanceOrder form={form} onChange={(next) => update([], next)} />
      </section>

      <section aria-labelledby="criteria-exclusions" className="flex flex-col gap-4 border-t border-sand pt-6">
        <div className="flex flex-col gap-2">
          <h3 id="criteria-exclusions" className={sectionHeading}>
            {TEXT.exclusionsHeading}
          </h3>
          <p className="text-muted">{TEXT.exclusionsHelp}</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {EXCLUSION_FIELDS.map((field) => (
            <ExclusionPicker key={field} field={field} {...controls} />
          ))}
        </div>
      </section>

      <section aria-labelledby="criteria-list-size" className="flex flex-col gap-3 border-t border-sand pt-6">
        <h3 id="criteria-list-size" className={sectionHeading}>
          {CRITERIA_TEXT.listSizeHeading}
        </h3>
        <ListSizeField {...controls} />
      </section>

      <div className="flex flex-col items-start gap-3 border-t border-sand pt-6">
        <button type="submit" className={buttonClasses("navy", "md", "cursor-pointer")}>
          {TEXT.continue}
        </button>
      </div>
    </form>
  );
}
