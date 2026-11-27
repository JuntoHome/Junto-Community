"use client";

import { type FormEvent, type RefObject, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { type CriteriaForm, type CriteriaFormErrors, EXCLUSION_FIELDS, type MustHaveField, toBrief } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import { briefToFormState } from "../criteria/to-form";
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
import { FALLBACK_TEXT, type FileSummary } from "../ai";
import { type AiBudget, ChatPanel } from "./chat/chat-panel";
import { CHOOSER_TEXT, CriteriaChooser, SwitchLink } from "./criteria-chooser";
import { type CriteriaMode, MODE_ANNOUNCEMENT } from "./criteria-mode";

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

type CriteriaFormProps = {
  records: readonly GroupedRecord[];
  form: CriteriaForm;
  onFormChange: (form: CriteriaForm) => void;
  onContinue: (brief: SearchBrief, form: CriteriaForm) => void;
};

/**
 * The Criteria step (TR-43). With the AI on, it starts with the chooser: Chat with AI or the
 * form. The user can switch between them at any time; the form's values live in the wizard, so
 * switching never clears them. With the AI off, the form shows directly, exactly as in Phase 1,
 * with no chooser and no link to the chat.
 *
 * The wizard holds `mode`, so going back to Criteria from Results shows the mode already chosen,
 * and Start over or a new workbook resets it. After a choice or a switch, focus moves to the
 * heading of what opened (the chat's heading, or the step's heading for the form) and
 * `onAnnounce` tells screen readers which one it is.
 *
 * The chat (TR-44) keeps its conversation while the step is on screen: once opened, it stays
 * mounted (hidden) while the form shows, so "Chat with AI instead" goes back to the same chat
 * (TR-50). Leaving the step unmounts it: the request in flight is aborted and the chat starts
 * again from the greeting next time.
 *
 * When the AI fails (TR-50): Use the form fills the form with the chat's `fallbackBrief()` (the
 * last valid proposal, else the pending brief; the form is left as it is when there is none) and
 * switches to it. After the second AI failure in a row it does the same on its own, with the
 * `switchedToForm` note above the form. A `503` calls `onAiUnavailable`: the wizard turns the AI
 * off and the form shows with its note. `formNote` is shown above the form.
 *
 * The proposal card (TR-45): Confirm and rank hands the proposal to `onConfirmProposal` (the
 * wizard ranks it the way Continue and Confirm and rank do for the form). Edit in form fills
 * the form with `briefToFormState(proposal)` and switches to it; Continue from there is a form
 * brief like any other.
 */
export function CriteriaStep({
  aiEnabled,
  layout,
  pendingBrief,
  mode,
  onModeChange,
  onAnnounce,
  focusStepHeading,
  onConfirmProposal,
  formNote,
  onFormNoteChange,
  onAiUnavailable,
  simulateAiFailure,
  aiBudget,
  ...formProps
}: CriteriaFormProps & {
  /** The session's AI request count (TR-51). */
  aiBudget: AiBudget;
  /** The AI may be used: on from the server and not turned off this session (TR-50). */
  aiEnabled: boolean;
  /** The note above the form (TR-50), or null. */
  formNote: string | null;
  onFormNoteChange: (note: string | null) => void;
  /** The route said the AI isn't available (`503`). */
  onAiUnavailable: () => void;
  /** TR-50 test mode: every chat message fails, without calling the route. */
  simulateAiFailure: boolean;
  /** The workbook's layout id, for the file summary the chat sends (TR-44). */
  layout: FileSummary["layout"];
  /** The brief waiting to be ranked, if any. The chat sends it as the current brief until the AI proposes one. */
  pendingBrief: SearchBrief | null;
  mode: CriteriaMode;
  onModeChange: (mode: CriteriaMode) => void;
  /** Says the text in the page's live region. */
  onAnnounce: (text: string) => void;
  /** Moves focus to the step's "Criteria" heading, the heading above the form. */
  focusStepHeading: () => void;
  /** Confirm and rank on the AI's proposal card (TR-45). */
  onConfirmProposal: (brief: SearchBrief, firstRequest: string | null) => void;
}) {
  const chatHeadingRef = useRef<HTMLHeadingElement>(null);
  // Counts choices and switches, so focus moves after one but not when the step first shows.
  const [switches, setSwitches] = useState(0);
  useEffect(() => {
    if (switches === 0) return;
    if (mode === "chat") chatHeadingRef.current?.focus();
    else if (mode === "form") focusStepHeading();
    // Only after a switch: `mode` changes in the same render, `focusStepHeading` never matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [switches]);

  // Once the chat has been opened it stays mounted, hidden behind the form, so its history is kept.
  const [chatOpened, setChatOpened] = useState(mode === "chat");

  function switchTo(next: Exclude<CriteriaMode, "choose">) {
    if (next === "chat") {
      setChatOpened(true);
      onFormNoteChange(null);
    }
    onModeChange(next);
    setSwitches((n) => n + 1);
    onAnnounce(MODE_ANNOUNCEMENT[next]);
  }

  /** Use the form after a failure, or the automatic switch: the form filled in with `brief`, if there is one. */
  function fallBackToForm(brief: SearchBrief | null, note: string | null) {
    if (brief) formProps.onFormChange(briefToFormState(brief));
    onFormNoteChange(note);
    switchTo("form");
  }

  if (aiEnabled && mode === "choose") {
    return <CriteriaChooser onChat={() => switchTo("chat")} onForm={() => switchTo("form")} />;
  }

  // The AI off always means the form, whatever the mode says.
  const showForm = !aiEnabled || mode === "form";
  return (
    <>
      {showForm && (
        <>
          {aiEnabled && (
            <div className="mt-3">
              <SwitchLink onClick={() => switchTo("chat")}>{CHOOSER_TEXT.useChat}</SwitchLink>
            </div>
          )}
          {/* Always rendered, so a note is announced when it appears. */}
          <div role="status">
            {formNote && <p className="mt-4 rounded-lg border border-gold bg-ivory p-3 text-base text-ink">{formNote}</p>}
          </div>
          <CriteriaFormPanel {...formProps} />
        </>
      )}
      {aiEnabled && chatOpened && (
        <ChatSection
          hidden={showForm}
          headingRef={chatHeadingRef}
          layout={layout}
          pendingBrief={pendingBrief}
          records={formProps.records}
          simulateAiFailure={simulateAiFailure}
          aiBudget={aiBudget}
          onUseForm={(brief) => fallBackToForm(brief, null)}
          onTwoFailures={(brief) => fallBackToForm(brief, FALLBACK_TEXT.switchedToForm)}
          onAiUnavailable={onAiUnavailable}
          onConfirmProposal={onConfirmProposal}
          onEditProposal={(brief) => {
            formProps.onFormChange(briefToFormState(brief));
            switchTo("form");
          }}
          onSwitchToForm={() => switchTo("form")}
        />
      )}
    </>
  );
}

/** The Criteria step's chat (TR-44), hidden rather than unmounted while the form shows (TR-50). */
function ChatSection({
  hidden,
  headingRef,
  layout,
  pendingBrief,
  records,
  simulateAiFailure,
  aiBudget,
  onUseForm,
  onTwoFailures,
  onAiUnavailable,
  onConfirmProposal,
  onEditProposal,
  onSwitchToForm,
}: {
  hidden: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  layout: FileSummary["layout"];
  pendingBrief: SearchBrief | null;
  records: readonly GroupedRecord[];
  simulateAiFailure: boolean;
  aiBudget: AiBudget;
  onUseForm: (brief: SearchBrief | null) => void;
  onTwoFailures: (brief: SearchBrief | null) => void;
  onAiUnavailable: () => void;
  onConfirmProposal: (brief: SearchBrief, firstRequest: string | null) => void;
  onEditProposal: (brief: SearchBrief) => void;
  onSwitchToForm: () => void;
}) {
  return (
    <section hidden={hidden} aria-labelledby="criteria-chat-heading" className="mt-5 flex flex-col items-start gap-3 text-base">
      <h3
        id="criteria-chat-heading"
        ref={headingRef}
        tabIndex={-1}
        className={`${sectionHeading} focus:outline-none`}
      >
        {CHOOSER_TEXT.chatHeading}
      </h3>
      <ChatPanel
        records={records}
        layout={layout}
        getCurrentBrief={() => pendingBrief}
        simulateFailure={simulateAiFailure}
        aiBudget={aiBudget}
        onUseForm={onUseForm}
        onTwoFailures={onTwoFailures}
        onAiUnavailable={onAiUnavailable}
        onConfirmProposal={onConfirmProposal}
        onEditProposal={onEditProposal}
      />
      <SwitchLink onClick={onSwitchToForm}>{CHOOSER_TEXT.useForm}</SwitchLink>
    </section>
  );
}

/**
 * The Criteria form (TR-14, TR-15): the goal, must-haves, preferences with an optional
 * importance order, exclusions and list size. The pickers offer the values found in `records`,
 * with counts. On Continue the form becomes a SearchBrief through `toBrief()`; nothing is
 * posted. The form's state is held by the wizard, so it survives leaving the step, and each
 * change touches only its own section. The controls are shared with the criteria summary's
 * inline editors (TR-16), in `criteria-controls.tsx`.
 *
 * There is no geography preference here on purpose: the issue doesn't ask for one, and city
 * and state are must-haves. The schema and ranking (TR-18) still support it for Phase 2's AI.
 */
function CriteriaFormPanel({ records, form, onFormChange, onContinue }: CriteriaFormProps) {
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
