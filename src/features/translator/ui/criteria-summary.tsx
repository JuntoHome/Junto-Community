"use client";

import { type FormEvent, type ReactNode, type Ref, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { type BriefItemId, describeLines } from "../criteria/describe";
import { type CriteriaForm, type CriteriaFormErrors, type CriteriaFormField, toBrief } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import {
  type CriteriaOptions,
  type CriteriaUpdate,
  EmployeesPreferenceField,
  ExclusionPicker,
  FIELD_NAMES,
  FORM_FIELDS,
  fieldId,
  GoalField,
  ImportanceOrder,
  ListSizeField,
  MustHavePicker,
  PickedPreferenceField,
  useCriteriaOptions,
} from "./criteria-controls";

// Every string the summary shows. Plain language, no em-dashes.
const TEXT = {
  heading: "Your criteria",
  intro: "Check these before ranking. Change any item here: a change applies only when you save it.",
  confirmHint: "Nothing is ranked until you confirm.",
  confirm: "Confirm and rank",
  change: "Change",
  editorHeading: (name: string) => `Change ${name}`,
  save: "Save",
  cancel: "Cancel",
  otherErrors: "This change can't be saved, because it clashes with another criterion:",
  updated: "Updated.",
  updatedAndRefreshed: "Updated. Results refreshed.",
} as const;

type Controls = { form: CriteriaForm; options: CriteriaOptions; errors: CriteriaFormErrors; update: CriteriaUpdate };

/**
 * How each item the form can produce is changed: its name (for the Change button and the
 * editor's heading), the form inputs it edits, and those inputs, the same controls the Criteria
 * step uses. Preference items share one line, so their buttons say which part they change.
 * Items the form can't produce (assumptions, a location preference from Phase 2) have no editor.
 */
type Editor = {
  /** What the item is called: "Change location". */
  name: string;
  /** For a part of the Preferences line, the visible button text after "Change", the start of `name`. */
  short?: string;
  /** The form inputs the editor shows. */
  fields: readonly CriteriaFormField[];
  render: (controls: Controls) => ReactNode;
};

const EDITORS: Partial<Record<BriefItemId, Editor>> = {
  goal: { name: "goal", fields: ["intent"], render: (c) => <GoalField {...c} /> },
  "must-geo": {
    name: "location",
    fields: ["city", "state"],
    render: (c) => (
      <div className="grid gap-6 md:grid-cols-2">
        <MustHavePicker field="city" {...c} />
        <MustHavePicker field="state" {...c} />
      </div>
    ),
  },
  "must-industry": { name: "required industry", fields: ["industry"], render: (c) => <MustHavePicker field="industry" {...c} /> },
  "must-title": { name: "required title", fields: ["title"], render: (c) => <MustHavePicker field="title" {...c} /> },
  "pref-industry": {
    name: "industry preference",
    short: "industry",
    fields: ["prefer-industry"],
    render: (c) => <PickedPreferenceField dimension="industry" {...c} />,
  },
  "pref-title": {
    name: "title preference",
    short: "title",
    fields: ["prefer-title"],
    render: (c) => <PickedPreferenceField dimension="title" {...c} />,
  },
  "pref-employees": {
    name: "company size preference",
    short: "company size",
    fields: ["prefer-employees"],
    render: (c) => <EmployeesPreferenceField {...c} />,
  },
  priority: {
    name: "order of importance",
    short: "order",
    fields: [],
    render: (c) => <ImportanceOrder form={c.form} onChange={(next) => c.update([], next)} />,
  },
  "exclude-industry": {
    name: "industries to leave out",
    fields: ["exclude-industry"],
    render: (c) => <ExclusionPicker field="industry" {...c} />,
  },
  "exclude-title": { name: "titles to leave out", fields: ["exclude-title"], render: (c) => <ExclusionPicker field="title" {...c} /> },
  "exclude-city": { name: "cities to leave out", fields: ["exclude-city"], render: (c) => <ExclusionPicker field="city" {...c} /> },
  "list-size": {
    name: "list size",
    fields: ["listSize"],
    render: (c) => (
      <div className="flex flex-col gap-3">
        <ListSizeField {...c} />
      </div>
    ),
  },
};

/** The open inline editor: which item, the draft copy of the form it edits, and its errors. */
type Editing = { id: BriefItemId; editor: Editor; draft: CriteriaForm; errors: CriteriaFormErrors };

/**
 * The criteria summary (TR-16), at the top of the Results step: `brief` in plain language
 * (`describeLines()`), each item with a Change button. Change opens an inline editor for just
 * that item, with the Criteria step's controls, on a draft copy of `form`. Typing there changes
 * nothing; Save runs `toBrief()` on the draft and, when it is valid, hands the new brief and
 * form to `onSave`. Only one editor is open at a time: opening another cancels the first.
 *
 * `brief` must be the brief the current results were ranked against (or the pending one before
 * confirming), never one rebuilt from form state, so the summary always matches the results.
 * `form` is the form that produced it, so a Save changes only the item being edited.
 */
export function CriteriaSummary({
  records,
  brief,
  form,
  confirmed,
  onSave,
  onConfirm,
}: {
  records: readonly GroupedRecord[];
  brief: SearchBrief;
  form: CriteriaForm;
  /** Whether results are showing. A Save then re-ranks, and Confirm and rank is hidden. */
  confirmed: boolean;
  onSave: (brief: SearchBrief, form: CriteriaForm) => void;
  onConfirm: () => void;
}) {
  const options = useCriteriaOptions(records);
  const lines = describeLines(brief);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });

  const headingRef = useRef<HTMLHeadingElement>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const otherErrorsRef = useRef<HTMLDivElement>(null);
  const changeButtons = useRef(new Map<BriefItemId, HTMLButtonElement>());

  // Focus to move after the next render: into a newly opened editor, back to an item's Change
  // button after Save or Cancel (the heading if that item is gone), or to the first problem.
  const focusNext = useRef<{ to: "editor" } | { to: "item"; id: BriefItemId } | { to: "errors" } | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    focusNext.current = null;
    if (next.to === "editor") editorHeadingRef.current?.focus();
    else if (next.to === "item") (changeButtons.current.get(next.id) ?? headingRef.current)?.focus();
    else if (editing) {
      const own = editing.editor.fields.find((field) => editing.errors[field]);
      if (own) document.getElementById(fieldId(own))?.focus();
      else otherErrorsRef.current?.focus();
    }
  });

  function open(id: BriefItemId, editor: Editor) {
    // A fresh draft every time, so whatever an earlier editor held is dropped.
    setEditing({ id, editor, draft: form, errors: {} });
    focusNext.current = { to: "editor" };
  }

  function close(id: BriefItemId) {
    setEditing(null);
    focusNext.current = { to: "item", id };
  }

  /** Changes the draft, and drops the errors on the inputs it affects. */
  const update: CriteriaUpdate = (fields, next) =>
    setEditing((current) => {
      if (!current) return current;
      const errors = { ...current.errors };
      for (const field of fields) delete errors[field];
      return { ...current, draft: next, errors };
    });

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const result = toBrief(editing.draft, options);
    if (!result.ok) {
      setEditing({ ...editing, errors: result.fieldErrors });
      focusNext.current = { to: "errors" };
      return;
    }
    onSave(result.brief, editing.draft);
    setAnnouncement((a) => ({ text: confirmed ? TEXT.updatedAndRefreshed : TEXT.updated, count: a.count + 1 }));
    close(editing.id);
  }

  return (
    <section aria-labelledby="criteria-summary-heading" className="mt-5 flex flex-col gap-4 text-base">
      <div className="flex flex-col gap-2">
        <h3
          id="criteria-summary-heading"
          ref={headingRef}
          tabIndex={-1}
          className="font-serif text-xl font-bold text-navy focus:outline-none"
        >
          {TEXT.heading}
        </h3>
        <p className="text-muted">{TEXT.intro}</p>
      </div>

      <ul className="flex flex-col divide-y divide-sand rounded-xl border border-sand">
        {lines.map((line, index) => {
          const editable = line.items.flatMap((item) => {
            const editor = EDITORS[item.id];
            return editor ? [{ id: item.id, editor }] : [];
          });
          const lineEditing = editing && line.items.some((item) => item.id === editing.id) ? editing : null;
          return (
            <li key={`${line.items[0].id}-${index}`} className="flex min-w-0 flex-col gap-4 px-4 py-3 md:px-5">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p className="min-w-0 wrap-anywhere text-ink">{line.text}</p>
                {editable.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {editable.map(({ id, editor }) => (
                        <button
                          key={id}
                          ref={(element) => {
                            if (element) changeButtons.current.set(id, element);
                            else changeButtons.current.delete(id);
                          }}
                          type="button"
                          onClick={() => open(id, editor)}
                          aria-expanded={editing?.id === id}
                          className={buttonClasses("outline", "sm", "cursor-pointer px-4")}
                        >
                          {editor.short ? `${TEXT.change} ${editor.short}` : TEXT.change}
                          <span className="sr-only">
                            {" "}
                            {editor.short ? editor.name.slice(editor.short.length).trim() : editor.name}
                          </span>
                        </button>
                    ))}
                  </div>
                )}
              </div>
              {lineEditing && (
                <ItemEditor
                  editing={lineEditing}
                  options={options}
                  update={update}
                  onSave={save}
                  onCancel={() => close(lineEditing.id)}
                  headingRef={editorHeadingRef}
                  otherErrorsRef={otherErrorsRef}
                />
              )}
            </li>
          );
        })}
      </ul>

      {!confirmed && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-muted">{TEXT.confirmHint}</p>
          <button type="button" onClick={onConfirm} className={buttonClasses("navy", "md", "cursor-pointer")}>
            {TEXT.confirm}
          </button>
        </div>
      )}

      <p role="status" className="sr-only">
        <span key={announcement.count}>{announcement.text}</span>
      </p>
    </section>
  );
}

/**
 * The inline editor for one item: its controls on the draft, Save and Cancel. Problems on its
 * own inputs show under them; a clash with another criterion (for example leaving out a city
 * that is also required) is listed above the buttons, since that input isn't shown here.
 */
function ItemEditor({
  editing,
  options,
  update,
  onSave,
  onCancel,
  headingRef,
  otherErrorsRef,
}: {
  editing: Editing;
  options: CriteriaOptions;
  update: CriteriaUpdate;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  headingRef: Ref<HTMLHeadingElement>;
  otherErrorsRef: Ref<HTMLDivElement>;
}) {
  const { editor } = editing;
  const headingId = `criteria-summary-editor-${editing.id}`;
  const otherErrors = FORM_FIELDS.filter((field) => editing.errors[field] && !editor.fields.includes(field));
  return (
    <form
      onSubmit={onSave}
      noValidate
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-5 rounded-lg border border-navy bg-ivory p-4 md:p-5"
    >
      <h4 id={headingId} ref={headingRef} tabIndex={-1} className="font-serif text-lg font-bold text-navy focus:outline-none">
        {TEXT.editorHeading(editor.name)}
      </h4>
      {editor.render({ form: editing.draft, options, errors: editing.errors, update })}
      {otherErrors.length > 0 && (
        <div
          ref={otherErrorsRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border-2 border-red-700 bg-white p-4 text-red-700 focus:outline-none"
        >
          <p className="font-bold">{TEXT.otherErrors}</p>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {otherErrors.map((field) => (
              <li key={field}>
                {FIELD_NAMES[field]}: {editing.errors[field]}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={buttonClasses("navy", "sm", "cursor-pointer")}>
          {TEXT.save}
        </button>
        <button type="button" onClick={onCancel} className={buttonClasses("outline", "sm", "cursor-pointer")}>
          {TEXT.cancel}
        </button>
      </div>
    </form>
  );
}
