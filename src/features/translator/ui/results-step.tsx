"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { CriteriaForm } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import type { FilterCounts } from "../ranking/filter";
import type { RankedRow, RankResult, ShortlistRow } from "../ranking";
import { checkPin, hasId, omit, type Overrides, pin, type PinContext, restore, unpin } from "../ranking/overrides";
import { REASON_TEXT } from "../ranking/reasons";
import { errorText } from "./criteria-controls";
import { CriteriaSummary } from "./criteria-summary";

/** "SYN-0001", "SYN-0001 and SYN-0016", "SYN-0001, SYN-0016 and SYN-0021". */
function joinIds(ids: readonly string[]): string {
  return ids.length <= 1 ? ids.join("") : `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

const TEXT = {
  /** "100 match. 0 left out by your exclusions. 399 didn't meet a must-have (0 only because of missing data)." */
  filterCounts: (counts: FilterCounts) =>
    `${counts.eligible} ${counts.eligible === 1 ? "matches" : "match"}. ` +
    `${counts.excluded} left out by your exclusions. ` +
    `${counts.failedMustHave} didn't meet a must-have (${counts.failedOnlyMissing} only because of missing data).`,
  /** "1. SYN-0001 (100)" */
  shortlistRow: (row: ShortlistRow) => `${row.rank}. ${row.record.normalized.recordId} (${row.displayScore})`,
  /** "Showing 40 of 100 matches." */
  showing: (shown: number, total: number) => `Showing ${shown} of ${total} ${total === 1 ? "match" : "matches"}.`,
  pin: "Pin",
  unpin: "Unpin",
  omit: "Omit",
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

/** How many shortlist rows the placeholder lists until the results table (TR-22). */
const PREVIEW_ROWS = 5;

/** The button an override was pressed on, so focus can go back to it after the lists change. */
type OverrideAction = "pin" | "omit" | "restore";
/** The list an override button is in: the shortlist lines or Omitted by you. */
type OverrideList = "shortlist" | "omitted";
type PendingFocus = { list: OverrideList; action: OverrideAction; recordId: string; index: number };

const buttonKey = (list: OverrideList, action: OverrideAction, recordId: string) => `${list}:${action}:${recordId}`;

/**
 * The Results step: the criteria summary (TR-16), then, once confirmed, the results. The
 * results table is TR-22 and the counts summary TR-23; until then placeholder lines give the
 * filter counts (TR-17), the first rows of the shortlist (TR-19) with their reasons (TR-20) and
 * how many of the matches it shows.
 *
 * Pin and omit (TR-21): each line has Pin (or Unpin) and Omit buttons, "Pin by Record ID" pins
 * any eligible record, including one below the cut, and "Omitted by you" lists the omitted rows
 * with Restore. The overrides live in the wizard; this step only asks for changes. After a
 * button, focus stays on that row, or moves to the row now in its place when it left the list,
 * and a live region says what changed. TR-22 moves these controls into the results table.
 *
 * The summary describes `results.brief` once there are results, the exact brief `rank()` got,
 * and the pending brief before that. It is never rebuilt from form state.
 */
export function ResultsStep({
  records,
  pendingBrief,
  pendingForm,
  results,
  pinContext,
  unpinned,
  onSave,
  onConfirm,
  onOverridesChange,
}: {
  records: readonly GroupedRecord[];
  pendingBrief: SearchBrief;
  /** The form that produced `pendingBrief`; the summary's editors start from it. */
  pendingForm: CriteriaForm;
  results: RankResult | null;
  /** What a typed Record ID is checked against. Null until there are results. */
  pinContext: PinContext | null;
  /** Pins the last brief change removed because their rows stopped matching. Empty for none. */
  unpinned: readonly string[];
  onSave: (brief: SearchBrief, form: CriteriaForm) => void;
  onConfirm: () => void;
  /** Changes the overrides, given the current ones. */
  onOverridesChange: (change: (current: Overrides) => Overrides) => void;
}) {
  // After Confirm and rank the button disappears, so move focus to what replaced it.
  const resultsRef = useRef<HTMLDivElement>(null);
  const focusResults = useRef(false);
  useEffect(() => {
    if (!focusResults.current || !results) return;
    focusResults.current = false;
    resultsRef.current?.focus();
  }, [results]);

  const [pinId, setPinId] = useState("");
  // The Pin by Record ID message; `count` makes the same message be announced again.
  const [pinMessage, setPinMessage] = useState({ text: "", error: false, count: 0 });
  // What the last Pin, Unpin, Omit or Restore button changed.
  const [announcement, setAnnouncement] = useState({ text: "", count: 0 });

  const shownRows = results ? results.shortlist.slice(0, PREVIEW_ROWS) : [];
  const omittedRows = results?.omittedRows ?? [];

  // After an override button, focus goes to the same button on that row once the lists have
  // changed. When the row left that list, it goes to the row now in its place (or the last
  // one), and to the results when the list is empty.
  const overrideButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusNext = useRef<PendingFocus | null>(null);
  useEffect(() => {
    const next = focusNext.current;
    if (!next) return;
    focusNext.current = null;
    const ids = (next.list === "shortlist" ? shownRows : omittedRows).map((row) => row.record.normalized.recordId);
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
    onOverridesChange(change);
    setAnnouncement((a) => ({ text: message, count: a.count + 1 }));
    focusNext.current = at;
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
    onOverridesChange((current) => pin(current, recordId));
    setPinMessage((m) => ({ text, error: false, count: m.count + 1 }));
    setPinId("");
  }

  const pinIds = { input: "translator-pin-id", hint: "translator-pin-id-hint", message: "translator-pin-id-message" };

  return (
    <div className="flex flex-col gap-8">
      <CriteriaSummary
        records={records}
        brief={results?.brief ?? pendingBrief}
        form={pendingForm}
        confirmed={results !== null}
        onSave={onSave}
        onConfirm={() => {
          focusResults.current = true;
          onConfirm();
        }}
      />
      {results && (
        <div ref={resultsRef} tabIndex={-1} className="border-t border-sand pt-6 focus:outline-none">
          {/* TODO(TR-22, TR-23): the results table from results.shortlist, and the counts summary. */}
          <p className="text-base text-muted">{TEXT.filterCounts(results.filter.counts)}</p>

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

          {shownRows.length > 0 && (
            <ol className="mt-4 flex flex-col gap-3 text-base text-muted">
              {shownRows.map((row, index) => {
                const id = row.record.normalized.recordId;
                const pinned = row.override === "pinned";
                return (
                  <li key={id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <span>{TEXT.shortlistRow(row)}</span>
                      {pinned && (
                        <span className="rounded-md bg-navy px-2 py-0.5 text-sm font-semibold text-white">
                          {REASON_TEXT.pinned}
                        </span>
                      )}
                      <button
                        ref={buttonRef(buttonKey("shortlist", "pin", id))}
                        type="button"
                        onClick={() =>
                          press(
                            { list: "shortlist", action: "pin", recordId: id, index },
                            (current) => (pinned ? unpin(current, id) : pin(current, id)),
                            pinned ? TEXT.unpinned(id) : TEXT.pinned(id),
                          )
                        }
                        className={buttonClasses("outline", "sm", "cursor-pointer px-4")}
                      >
                        {pinned ? TEXT.unpin : TEXT.pin}
                        <span className="sr-only"> {id}</span>
                      </button>
                      <button
                        ref={buttonRef(buttonKey("shortlist", "omit", id))}
                        type="button"
                        onClick={() =>
                          press(
                            { list: "shortlist", action: "omit", recordId: id, index },
                            (current) => omit(current, id),
                            TEXT.omitted(id),
                          )
                        }
                        className={buttonClasses("outline", "sm", "cursor-pointer px-4")}
                      >
                        {TEXT.omit}
                        <span className="sr-only"> {id}</span>
                      </button>
                    </div>
                    <p className="text-sm">{row.reasonText}</p>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="mt-2 text-base text-muted">
            {TEXT.showing(results.shortlist.length, results.ranked.length)}
          </p>

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

          <p role="status" className="sr-only">
            <span key={announcement.count}>{announcement.text}</span>
          </p>
        </div>
      )}
    </div>
  );
}
