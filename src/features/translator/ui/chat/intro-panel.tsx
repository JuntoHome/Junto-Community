"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { textareaClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { BriefIntent } from "../../criteria/schema";
import { INTRO_PANEL_TEXT as TEXT, type IntroFields, MAX_INTRO_NOTE_CHARS, placeholderCount } from "../../ai";
import type { IntroDrafts } from "./use-intro-drafts";

/** The six values in the order the "what will be sent" line names them. */
const FIELD_ORDER = ["company", "industry", "city", "state", "contactName", "contactTitle"] as const satisfies readonly (keyof IntroFields)[];

type CopyState = { kind: "idle" | "copied" | "manual"; count: number };

/**
 * Draft an intro (TR-49): a modal dialog for one business, opened from a Draft intro button on
 * the Results step. Render only: the rules are in `ai/intro-session.ts`, the state and the
 * request in `use-intro-drafts.ts`.
 *
 * A native `<dialog>` opened with `showModal()` (the repo has no dialog component, and no
 * library is added): the page behind it is inert, so focus stays inside; Esc and Close close it,
 * and the Results step puts focus back on the button that opened it.
 *
 * It shows, always, the agreed "what will be sent" line and under it the six values exactly as
 * they would be sent (`Not in file` for a null), then the optional note, Write draft, and the
 * editable draft with Copy. There is no send button and no `mailto:`: the user copies the draft
 * and sends it themselves.
 */
export function IntroPanel({
  recordId,
  intro,
  intent,
  session,
  onClose,
}: {
  recordId: string;
  /** From `pickIntroFields()`: exactly what the request will carry. */
  intro: IntroFields;
  /** The confirmed brief's intent, sent with the request (not put in the note). */
  intent: BriefIntent;
  session: IntroDrafts;
  /** The dialog closed (Esc or Close). */
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const ids = { title: useId(), note: useId(), noteHelp: useId(), noteCount: useId(), draft: useId(), fill: useId() };

  const draft = session.drafts[recordId];
  const waiting = session.state.pending?.recordId === recordId;
  const error = session.state.error?.recordId === recordId ? session.state.error : null;
  // Empty by default; a draft written before keeps the note it was written with.
  const [note, setNote] = useState(draft?.goal ?? "");
  const [copy, setCopy] = useState<CopyState>({ kind: "idle", count: 0 });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function write() {
    if (waiting) return;
    setCopy((c) => ({ kind: "idle", count: c.count }));
    session.write(recordId, intro, intent, note);
  }

  async function copyDraft() {
    if (!draft) return;
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(draft.draft);
      setCopy((c) => ({ kind: "copied", count: c.count + 1 }));
    } catch {
      // No clipboard access: select the text so the user can copy it with the keyboard.
      draftRef.current?.focus();
      draftRef.current?.select();
      setCopy((c) => ({ kind: "manual", count: c.count + 1 }));
    }
  }

  const fillCount = draft ? placeholderCount(draft.draft) : 0;
  const writeLabel = waiting ? TEXT.writing : !draft ? TEXT.write : draft.edited ? TEXT.writeAgainEdited : TEXT.writeAgain;
  const copyMessage = copy.kind === "copied" ? TEXT.copied : copy.kind === "manual" ? TEXT.copyManually : "";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={ids.title}
      aria-modal="true"
      onClose={onClose}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-xl border border-sand bg-white p-0 text-ink shadow-xl backdrop:bg-navy-deep/60"
    >
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={ids.title} className="font-serif text-2xl font-bold wrap-break-word text-navy">
            {TEXT.title(intro.company)}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={buttonClasses("outline", "sm", "shrink-0 cursor-pointer px-4")}
          >
            {TEXT.close}
          </button>
        </div>

        <section className="flex flex-col gap-3 rounded-lg border border-sand bg-ivory p-4">
          <p className="font-semibold text-navy">{TEXT.whatIsSent}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-base">
            {FIELD_ORDER.map((field) => (
              <div key={field} className="contents">
                <dt className="font-semibold text-slate">{TEXT.labels[field]}</dt>
                <dd className="min-w-0 wrap-break-word">
                  {intro[field] ?? <span className="text-subtle italic">{TEXT.notInFile}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="flex flex-col gap-2">
          <label htmlFor={ids.note} className="font-semibold text-navy">
            {TEXT.noteLabel}
          </label>
          <textarea
            id={ids.note}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={MAX_INTRO_NOTE_CHARS}
            rows={2}
            placeholder={TEXT.notePlaceholder}
            aria-describedby={`${ids.noteHelp} ${ids.noteCount}`}
            className={cn(textareaClasses, "w-full")}
          />
          <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-muted">
            <p id={ids.noteHelp}>{TEXT.noteSent}</p>
            <p id={ids.noteCount}>{TEXT.noteCount(note.length)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={write}
            // aria-disabled, not disabled, so focus stays on the button while it waits.
            aria-disabled={waiting || undefined}
            className={buttonClasses("navy", "md", cn("cursor-pointer", waiting && "cursor-wait opacity-60"))}
          >
            {writeLabel}
          </button>
        </div>

        {error && (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-700 bg-red-50 p-4 text-base">
            <p className="text-red-800">{error.message}</p>
            <button type="button" onClick={session.retry} className={buttonClasses("outline", "sm", "cursor-pointer")}>
              {TEXT.tryAgain}
            </button>
          </div>
        )}

        {draft && (
          <div className="flex flex-col gap-2">
            <label htmlFor={ids.draft} className="font-semibold text-navy">
              {TEXT.draftLabel}
            </label>
            <p id={ids.fill} className="text-base text-ink">
              {fillCount > 0 ? (
                <>
                  {TEXT.fillIn} <span className="font-semibold">{TEXT.toFillIn(fillCount)}</span>
                </>
              ) : (
                TEXT.nothingToFill
              )}
            </p>
            <textarea
              id={ids.draft}
              ref={draftRef}
              value={draft.draft}
              onChange={(event) => session.edit(recordId, event.target.value)}
              rows={12}
              aria-describedby={ids.fill}
              className={cn(textareaClasses, "w-full")}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void copyDraft()} className={buttonClasses("outline", "sm", "cursor-pointer")}>
                {TEXT.copy}
              </button>
              <p role="status" className="text-base text-ink">
                <span key={copy.count}>{copyMessage}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
