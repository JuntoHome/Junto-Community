"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { type FileSummary, REVISE_TEXT } from "../ai";
import type { CriteriaForm } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import type { MappingRow } from "../import/describe-mapping";
import type { GroupedRecord } from "../normalize/duplicates";
import type { ImportSummary } from "../normalize/summary";
import type { RankedRow, RankResult } from "../ranking";
import { buildCounts } from "../ranking/counts";
import { diagnoseEmpty } from "../ranking/diagnose";
import { checkPin, hasId, omit, type Overrides, pin, type PinContext, restore, unpin } from "../ranking/overrides";
import { ChatPanel } from "./chat/chat-panel";
import { CountsSummary } from "./counts-summary";
import { errorText } from "./criteria-controls";
import { CRITERIA_SUMMARY_HEADING_ID, CriteriaSummary, type CriteriaSummaryHandle } from "./criteria-summary";
import { NoResults } from "./no-results";
import { ResultsTable, type ResultsView, type RowControls } from "./results-table";

/** "SYN-0001", "SYN-0001 and SYN-0016", "SYN-0001, SYN-0016 and SYN-0021". */
function joinIds(ids: readonly string[]): string {
  return ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

const TEXT = {
  editCriteria: "Edit criteria",
  continueToExport: "Continue to export",
  restore: "Restore",
  pinByIdLabel: "Pin by Record ID",
  pinByIdHint: "A pinned record shows at the top of the list, even if its score would leave it out.",
  pinByIdButton: "Pin record",
  omittedHeading: (count: number) => `Omitted by you (${count})`,
  /** "SYN-0001 (100)" */
  omittedRow: (row: RankedRow) => `${row.record.normalized.recordId} (${row.displayScore})`,
  pinned: (id: string) => `${id} is pinned and shows at the top of the list.`,
  pinnedAndRestored: (id: string) => `${id} is pinned and shows at the top of the list. It is no longer omitted.`,
  alreadyPinned: (id: string) => `${id} is already pinned.`,
  unpinned: (id: string) => `${id} is no longer pinned.`,
  omitted: (id: string) => `${id} is omitted. It is listed under Omitted by you.`,
  restored: (id: string) => `${id} is back in the results.`,
  /** After a brief change: "SYN-0001 was unpinned because it no longer matches your criteria." */
  droppedPins: (ids: readonly string[]) =>
    ids.length === 1
      ? `${ids[0]} was unpinned because it no longer matches your criteria.`
      : `${joinIds(ids)} were unpinned because they no longer match your criteria.`,
} as const;

/** The button an override was pressed on, so focus can go back to it after the lists change. */
type OverrideAction = "pin" | "omit" | "restore";
/** The list an override button is in: the shortlist's table or cards (TR-22), or Omitted by you. */
type OverrideList = ResultsView | "omitted";
type PendingFocus = { list: OverrideList; action: OverrideAction; recordId: string; index: number };

const buttonKey = (list: OverrideList, action: OverrideAction, recordId: string) => `${list}:${action}:${recordId}`;

/**
 * The Results step: the criteria summary (TR-16), then, once confirmed, the results.
 *
 * Above the shortlist: the counts summary (TR-23, from the rows read to the rows in the
 * shortlist and export), Edit criteria (focus to the summary's heading) and "Pin by Record
 * ID". Then the shortlist as a table, or cards on a phone (`ResultsTable`, TR-22), then
 * "Omitted by you" with Restore. An empty shortlist shows the no-results helper instead of the
 * table (TR-24, `NoResults` with `diagnoseEmpty()`), whose Edit buttons open that item in the
 * summary through its `openItem()`. Last, Continue to export opens the Export step (TR-25);
 * it isn't shown for an empty shortlist.
 *
 * Pin and omit (TR-21): each shortlist row has Pin (or Unpin) and Omit buttons, "Pin by Record
 * ID" pins any eligible record, including one below the cut, and "Omitted by you" lists the
 * omitted rows with Restore. The overrides live in the wizard; this step only asks for changes.
 * After a button, focus stays on that row's button, or moves to the row now in its place when
 * it left the list, and a live region says what changed.
 *
 * The summary describes `results.brief` once there are results, the exact brief `rank()` got,
 * and the pending brief before that. It is never rebuilt from form state.
 *
 * With the AI on and results showing, "Want to change something? Tell me." (TR-46) sits under
 * the summary: a compact chat of its own (not the Criteria step's), whose proposals are compared
 * with the confirmed brief. Nothing re-ranks until Confirm and rank on its card, which goes
 * through the same wizard path as the Criteria step's card (`onConfirmRevision`). Then the card
 * closes and "Updated. Now first: ..." names the new first row, takes focus and is announced.
 * The summary's inline edits keep working as before: both change the same confirmed brief.
 */
export function ResultsStep({
  aiEnabled,
  layout,
  onConfirmRevision,
  onEditRevision,
  onUseForm,
  records,
  importSummary,
  pendingBrief,
  pendingForm,
  results,
  pinContext,
  mapping,
  unpinned,
  onSave,
  onConfirm,
  onOverridesChange,
  onContinueToExport,
}: {
  /** Chat with AI may run: shows the chat for changes once there are results. */
  aiEnabled: boolean;
  /** The workbook's layout id, for the file summary the chat sends. */
  layout: FileSummary["layout"];
  /** Confirm and rank on the chat's card: confirms `brief` and re-ranks (TR-46). */
  onConfirmRevision: (brief: SearchBrief) => void;
  /** Edit in form on the chat's card: opens the Criteria step's form filled in with `brief`. */
  onEditRevision: (brief: SearchBrief) => void;
  /** Use the form, after a chat error: opens the Criteria step's form. */
  onUseForm: () => void;
  records: readonly GroupedRecord[];
  /** `summarizeImport()` for the loaded workbook, for the counts summary. */
  importSummary: ImportSummary;
  pendingBrief: SearchBrief;
  /** The form that produced `pendingBrief`; the summary's editors start from it. */
  pendingForm: CriteriaForm;
  results: RankResult | null;
  /** What a typed Record ID is checked against. Null until there are results. */
  pinContext: PinContext | null;
  /** `describeMapping()` for the loaded file, for the shortlist's Missing column. */
  mapping: readonly MappingRow[];
  /** Pins the last brief change removed because their rows stopped matching. Empty for none. */
  unpinned: readonly string[];
  onSave: (brief: SearchBrief, form: CriteriaForm) => void;
  onConfirm: () => void;
  /** Changes the overrides, given the current ones. */
  onOverridesChange: (change: (current: Overrides) => Overrides) => void;
  /** Opens the Export step. */
  onContinueToExport: () => void;
}) {
  // After Confirm and rank the button disappears, so move focus to what replaced it.
  const resultsRef = useRef<HTMLDivElement>(null);
  const focusResults = useRef(false);
  useEffect(() => {
    if (!focusResults.current || !results) return;
    focusResults.current = false;
    resultsRef.current?.focus();
  }, [results]);

  // The brief a chat change confirmed (TR-46). While the results come from it, "Updated. Now
  // first: ..." shows under the chat; a summary Save (a new brief) or a pin or omit clears it.
  const [revisedBrief, setRevisedBrief] = useState<SearchBrief | null>(null);
  const updatedRef = useRef<HTMLParagraphElement>(null);
  const focusUpdated = useRef(false);
  useEffect(() => {
    if (!focusUpdated.current || !updatedRef.current) return;
    focusUpdated.current = false;
    updatedRef.current.focus();
  });
  const first = results?.shortlist[0];
  const updatedText =
    results && revisedBrief === results.brief
      ? first
        ? REVISE_TEXT.updated(first.record.normalized.company.known ? first.record.normalized.company.value : null, first.record.normalized.recordId)
        : REVISE_TEXT.updatedEmpty
      : null;

  const [pinId, setPinId] = useState("");
  // The Pin by Record ID message; `count` makes the same message be announced again.
  const [pinMessage, setPinMessage] = useState({ text: "", error: false, count: 0 });
  // What the last Pin, Unpin, Omit or Restore button changed.
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });

  // Recomputed from the same `results` as the table, so the two always agree.
  const counts = useMemo(() => (results ? buildCounts(importSummary, results) : null), [importSummary, results]);
  const shownRows = results?.shortlist ?? [];
  const omittedRows = results?.omittedRows ?? [];
  // Only worked out for an empty shortlist, from the same `results` as the counts.
  const diagnosis = useMemo(
    () => (results && results.shortlist.length === 0 ? diagnoseEmpty(records, results.brief, results) : null),
    [records, results],
  );
  // The no-results helper's Edit buttons open an item in the criteria summary.
  const summaryRef = useRef<CriteriaSummaryHandle>(null);

  // After an override button, focus goes to the same button on that row once the lists have
  // changed. When the row left that list, it goes to the row now in its place (or the last
  // one), and to the results when the list is empty.
  const overrideButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef<PendingFocus | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    focusNext.current = null;
    const ids = (next.list === "omitted" ? omittedRows : shownRows).map((row) => row.record.normalized.recordId);
    const target = ids.includes(next.recordId) ? next.recordId : ids[Math.min(next.index, ids.length - 1)];
    const button = target === undefined ? undefined : overrideButtons.current.get(buttonKey(next.list, next.action, target));
    (button ?? resultsRef.current)?.focus();
  });

  /** Registers an override button, so focus can be moved to it. */
  const buttonRef = (key: string) => (element: HTMLButtonElement | null) => {
    if (element) overrideButtons.current.set(key, element);
    else overrideButtons.current.delete(key);
  };

  /** Applies an override button's change, announces it and keeps focus on its row. */
  function press(at: PendingFocus, change: (current: Overrides) => Overrides, message: string) {
    setRevisedBrief(null);
    onOverridesChange(change);
    setAnnouncement((a) => ({ text: message, count: a.count + 1 }));
    focusNext.current = at;
  }

  /** The table's and cards' Pin and Omit buttons. */
  const rowControls: RowControls = {
    buttonRef: (view, action, recordId) => buttonRef(buttonKey(view, action, recordId)),
    onPin: (view, row, index) => {
      const id = row.record.normalized.recordId;
      const pinned = row.override === "pinned";
      press(
        { list: view, action: "pin", recordId: id, index },
        (current) => (pinned ? unpin(current, id) : pin(current, id)),
        pinned ? TEXT.unpinned(id) : TEXT.pinned(id),
      );
    },
    onOmit: (view, row, index) => {
      const id = row.record.normalized.recordId;
      press({ list: view, action: "omit", recordId: id, index }, (current) => omit(current, id), TEXT.omitted(id));
    },
  };

  /** Edit criteria: scrolls to the criteria summary and moves focus to its heading. */
  function editCriteria() {
    const heading = document.getElementById(CRITERIA_SUMMARY_HEADING_ID);
    if (!heading) return;
    heading.scrollIntoView({ block: "start" });
    heading.focus({ preventScroll: true });
  }

  function pinById(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!results || !pinContext) return;
    const check = checkPin(pinId, pinContext);
    if (!check.ok) {
      setPinMessage((m) => ({ text: check.message, error: true, count: m.count + 1 }));
      return;
    }
    const { recordId } = check;
    const text = hasId(results.overrides.pinned, recordId)
      ? TEXT.alreadyPinned(recordId)
      : hasId(results.overrides.omitted, recordId)
        ? TEXT.pinnedAndRestored(recordId)
        : TEXT.pinned(recordId);
    setRevisedBrief(null);
    onOverridesChange((current) => pin(current, recordId));
    setPinMessage((m) => ({ text, error: false, count: m.count + 1 }));
    setPinId("");
  }

  const pinIds = { input: "translator-pin-id", hint: "translator-pin-id-hint", message: "translator-pin-id-message" };

  return (
    <div className="flex flex-col gap-8">
      <CriteriaSummary
        ref={summaryRef}
        records={records}
        brief={results?.brief ?? pendingBrief}
        form={pendingForm}
        afterRanking={results !== null}
        onSave={onSave}
        onConfirm={() => {
          focusResults.current = true;
          onConfirm();
        }}
      />
      {aiEnabled && results && (
        <section aria-labelledby="translator-revise-heading" className="flex flex-col gap-3 border-t border-sand pt-6">
          <h3 id="translator-revise-heading" className="font-serif text-xl font-bold text-navy">
            {REVISE_TEXT.opening}
          </h3>
          <ChatPanel
            records={records}
            layout={layout}
            mode="revise"
            opening={REVISE_TEXT.opening}
            getCurrentBrief={() => results.brief}
            onUseForm={onUseForm}
            onConfirmProposal={(brief) => {
              setRevisedBrief(brief);
              focusUpdated.current = true;
              onConfirmRevision(brief);
            }}
            onEditProposal={onEditRevision}
          />
          {/* Always rendered, so the line is announced when it appears. */}
          <div role="status">
            {updatedText && (
              <p ref={updatedRef} tabIndex={-1} className="font-semibold text-navy focus:outline-none">
                {updatedText}
              </p>
            )}
          </div>
        </section>
      )}
      {results && counts && (
        <div ref={resultsRef} tabIndex={-1} className="border-t border-sand pt-6 focus:outline-none">
          <CountsSummary counts={counts} />

          <div className="mt-5 flex">
            <button type="button" onClick={editCriteria} className={buttonClasses("outline", "sm", "cursor-pointer")}>
              {TEXT.editCriteria}
            </button>
          </div>

          <form onSubmit={pinById} noValidate className="mt-5 flex flex-col gap-2">
            <label htmlFor={pinIds.input} className="font-semibold text-ink">
              {TEXT.pinByIdLabel}
            </label>
            <p id={pinIds.hint} className="-mt-1 text-[15px] text-slate">
              {TEXT.pinByIdHint}
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                id={pinIds.input}
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={pinId}
                onChange={(event) => setPinId(event.target.value)}
                aria-describedby={`${pinIds.hint} ${pinIds.message}`}
                aria-invalid={pinMessage.error ? true : undefined}
                className={cn(inputClasses, "w-56 max-w-full")}
              />
              <button type="submit" className={buttonClasses("outline", "sm", "cursor-pointer")}>
                {TEXT.pinByIdButton}
              </button>
            </div>
            <p id={pinIds.message} aria-live="polite" className={pinMessage.error ? errorText : "text-[15px] text-ink"}>
              <span key={pinMessage.count}>{pinMessage.text}</span>
            </p>
          </form>

          {/* Always rendered, so the notice is announced when it appears. */}
          <div role="status">
            {unpinned.length > 0 && (
              <p className="mt-4 rounded-lg border border-gold bg-ivory p-3 text-base text-ink">
                {TEXT.droppedPins(unpinned)}
              </p>
            )}
          </div>

          <div className="mt-4">
            {diagnosis ? (
              <NoResults diagnosis={diagnosis} onEdit={(id) => summaryRef.current?.openItem(id)} />
            ) : (
              <ResultsTable rows={shownRows} mapping={mapping} controls={rowControls} />
            )}
          </div>

          {omittedRows.length > 0 && (
            <section aria-labelledby="translator-omitted-heading" className="mt-6">
              <h3 id="translator-omitted-heading" className="font-serif text-xl font-bold text-navy">
                {TEXT.omittedHeading(omittedRows.length)}
              </h3>
              <ul className="mt-2 flex flex-col gap-2 text-base text-muted">
                {omittedRows.map((row, index) => {
                  const id = row.record.normalized.recordId;
                  return (
                    <li key={id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span>{TEXT.omittedRow(row)}</span>
                      <button
                        ref={buttonRef(buttonKey("omitted", "restore", id))}
                        type="button"
                        onClick={() =>
                          press(
                            { list: "omitted", action: "restore", recordId: id, index },
                            (current) => restore(current, id),
                            TEXT.restored(id),
                          )
                        }
                        className={buttonClasses("outline", "sm", "cursor-pointer px-4")}
                      >
                        {TEXT.restore}
                        <span className="sr-only"> {id}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {shownRows.length > 0 && (
            <div className="mt-8 flex border-t border-sand pt-6">
              <button type="button" onClick={onContinueToExport} className={buttonClasses("navy", "md", "cursor-pointer")}>
                {TEXT.continueToExport}
              </button>
            </div>
          )}

          <p role="status" className="sr-only">
            <span key={announcement.count}>{announcement.text}</span>
          </p>
        </div>
      )}
    </div>
  );
}
