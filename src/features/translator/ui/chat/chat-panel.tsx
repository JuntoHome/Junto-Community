"use client";

import { type KeyboardEvent, type Ref, useEffect, useId, useImperativeHandle, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { textareaClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { SearchBrief } from "../../criteria/schema";
import {
  aiTurnedOff,
  canSend,
  changesAnnouncement,
  CHAT_TEXT,
  type ChatItem,
  type ChatMode,
  characterCount,
  chipMarks,
  diffBriefs,
  failureActions,
  fallbackBrief,
  FALLBACK_TEXT,
  type FileSummary,
  isAddedNote,
  latestAnnouncement,
  limitReached,
  LOGIN_PATH,
  MAX_USER_MESSAGE_CHARS,
  REVISE_TEXT,
  shouldSwitchToForm,
} from "../../ai";
import type { GroupedRecord } from "../../normalize/duplicates";
import { ProposalCard } from "./proposal-card";
import { useChatSession } from "./use-chat-session";

/** What the Results step may do to its chat: add the explanation after a confirmed revision (TR-47). */
export type ChatPanelHandle = {
  /** Adds `text` as a note at the end of the chat, moves focus to it and has it announced. Never sent. */
  addNote: (text: string) => void;
};

/**
 * Chat with AI (TR-44): the conversation, the message box, Send and Start over chat. It only
 * renders and forwards events; the rules are in `ai/chat-session.ts` and the state and the
 * request in `use-chat-session.ts`.
 *
 * Screen readers: a separate, visually hidden live region says only the newest AI reply and its
 * note, so the history isn't read again. Errors use `role="alert"`. After sending, focus goes
 * back to the message box.
 *
 * When the AI has proposed a brief, the proposal card (TR-45) shows it under the conversation.
 * Its chips edit the proposal in the chat state; Confirm and rank and Edit in form hand the
 * current proposal to the Criteria step.
 *
 * `mode="revise"` is the compact chat on the Results step (TR-46). Its opening line is the
 * panel's heading, so the conversation list shows only from the first message on (the line is
 * still sent). The card compares the proposal with the confirmed brief (`diffBriefs()`), the
 * live region reads the changes after the reply, Cancel closes the card, and Confirm and rank
 * hands the proposal up and closes the card. Nothing is ranked before Confirm.
 *
 * `ref` gives `addNote()`: once the results re-rank, the Results step adds TR-47's explanation
 * (`explainChange()`) as a note. It takes focus, and the live region reads only that note.
 *
 * When the AI fails (TR-50) the message and its buttons come from `failureActions()`: Try again
 * (sends the failed message again, which is back in the box), Use the form (with
 * `fallbackBrief()`), Log in again (a new tab, so nothing here is lost), Start over chat. After
 * the second AI failure in a row, `onTwoFailures` gets the same brief (the Criteria step switches
 * to the form); a `503` calls `onAiUnavailable` (the wizard turns the AI off).
 */
export function ChatPanel({
  ref,
  records,
  layout,
  getCurrentBrief,
  mode = "criteria",
  opening,
  onUseForm,
  onTwoFailures,
  onAiUnavailable,
  simulateFailure = false,
  onConfirmProposal,
  onEditProposal,
}: {
  ref?: Ref<ChatPanelHandle>;
  records: readonly GroupedRecord[];
  layout: FileSummary["layout"];
  /** The wizard's brief, read at send time: the pending one (Criteria step) or the confirmed one (Results step). */
  getCurrentBrief: () => SearchBrief | null;
  mode?: ChatMode;
  /** The chat's first assistant message (the greeting by default). */
  opening?: string;
  /** Use the form, after a failure: `brief` is `fallbackBrief()`, to fill the form with (null: leave it as it is). */
  onUseForm: (brief: SearchBrief | null) => void;
  /** The second AI failure in a row, with `fallbackBrief()`. The Criteria step switches to the form; Results leaves it out. */
  onTwoFailures?: (brief: SearchBrief | null) => void;
  /** The route said the AI isn't available (`503`). */
  onAiUnavailable: () => void;
  /** TR-50 test mode: every message fails after 1.5 seconds, without calling the route. */
  simulateFailure?: boolean;
  /** Confirm and rank on the proposal card, with the proposal as it is on screen. */
  onConfirmProposal: (brief: SearchBrief) => void;
  /** Edit in form on the proposal card, with the proposal as it is on screen. */
  onEditProposal: (brief: SearchBrief) => void;
}) {
  const { state, send, edit, resetChat, removeChip, dismissProposal, addNote } = useChatSession({
    records,
    layout,
    getCurrentBrief,
    opening,
    mode,
    simulateFailure,
  });
  const { proposal } = state;
  const revise = mode === "revise";
  // On the Results step: what the proposal changes, compared with the confirmed brief now.
  const base = revise ? getCurrentBrief() : null;
  const changes = revise && proposal && base ? diffBriefs(base, proposal) : [];
  const marks = revise && proposal && base ? chipMarks(base, proposal) : {};
  // The opening line is the heading on the Results step, so the list starts at the first message.
  const shownItems = revise ? state.items.slice(1) : state.items;
  const latest = latestAnnouncement(state);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const inputId = useId();
  const helpId = useId();
  const counterId = useId();

  // Keep the newest item in view.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [state.items.length, state.status]);

  // After `addNote()`, focus goes to the note once it is on screen.
  const addedNoteRef = useRef<HTMLLIElement>(null);
  const focusAddedNote = useRef(false);
  useEffect(() => {
    if (!focusAddedNote.current || !addedNoteRef.current) return;
    focusAddedNote.current = false;
    addedNoteRef.current.focus();
  });
  useImperativeHandle(ref, () => ({
    addNote: (text: string) => {
      focusAddedNote.current = true;
      addNote(text);
    },
  }));
  const lastItemId = state.items.at(-1)?.id;

  // After a failure: two AI failures in a row, or the AI turned off. Once per failure.
  const failureKey = state.status === "error" ? state.requestId : -1;
  useEffect(() => {
    if (failureKey === -1) return;
    const brief = fallbackBrief(state, getCurrentBrief(), mode);
    // After this render: switching announces the change, and the announcer can't flush mid-render.
    if (aiTurnedOff(state)) queueMicrotask(onAiUnavailable);
    else if (shouldSwitchToForm(state)) queueMicrotask(() => onTwoFailures?.(brief));
    // Only when a new failure arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failureKey]);

  const waiting = state.status === "waiting";
  const full = limitReached(state);
  const counter = characterCount(state.draft);

  function submit() {
    if (!canSend(state, state.draft)) return;
    void send();
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter adds a line. Never while an input method is composing a character.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    submit();
  }

  function startOver() {
    resetChat();
    inputRef.current?.focus();
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {shownItems.length > 0 && (
        <ol
          ref={listRef}
          aria-label={CHAT_TEXT.conversation}
          className={cn(
            "flex flex-col gap-3 overflow-y-auto rounded-xl border border-sand bg-ivory p-4",
            revise ? "max-h-72" : "max-h-[28rem] min-h-48",
          )}
        >
          {shownItems.map((item) => (
            <ChatBubble
              key={item.id}
              item={item}
              noteRef={isAddedNote(item) && item.id === lastItemId ? addedNoteRef : undefined}
            />
          ))}
        </ol>
      )}

      <div aria-live="polite" className="sr-only">
        {/* After the reply only, so the changes aren't read while waiting. */}
        {latest && revise && proposal ? `${latest} ${changesAnnouncement(changes)}` : latest}
      </div>

      {proposal &&
        (revise && changes.length === 0 ? (
          // A Save in the criteria summary can make an open proposal the same as the brief.
          <p className="text-base text-ink">{REVISE_TEXT.noChange}</p>
        ) : (
          <ProposalCard
            proposal={proposal}
            onRemove={removeChip}
            onConfirm={() => {
              onConfirmProposal(proposal);
              // On the Criteria step the wizard moves on; on Results the card closes.
              if (revise) dismissProposal();
            }}
            onKeepChatting={revise ? undefined : () => inputRef.current?.focus()}
            onEditInForm={() => onEditProposal(proposal)}
            revise={
              revise
                ? {
                    changes,
                    marks,
                    onCancel: () => {
                      dismissProposal();
                      inputRef.current?.focus();
                    },
                  }
                : undefined
            }
          />
        ))}

      {state.error && state.failureKind && (
        <FailureMessage
          message={state.error}
          actions={failureActions(state.failureKind)}
          waiting={waiting}
          onTryAgain={submit}
          onUseForm={() => onUseForm(fallbackBrief(state, getCurrentBrief(), mode))}
          onStartOver={startOver}
        />
      )}

      {full && (
        <p role="status" className="text-base text-navy">
          {CHAT_TEXT.limitReached}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-base font-semibold text-navy">
          {CHAT_TEXT.messageLabel}
        </label>
        <p id={helpId} className="text-sm text-muted">
          {CHAT_TEXT.messageHelp}
        </p>
        <textarea
          id={inputId}
          ref={inputRef}
          value={state.draft}
          onChange={(event) => edit(event.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_USER_MESSAGE_CHARS}
          rows={revise ? 2 : 3}
          aria-describedby={counter ? `${helpId} ${counterId}` : helpId}
          className={cn(textareaClasses, "w-full")}
        />
        {counter && (
          <p id={counterId} className="self-end text-sm text-muted">
            {counter}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={!canSend(state, state.draft)}
          className={buttonClasses("navy", "md", "cursor-pointer")}
        >
          {waiting ? CHAT_TEXT.thinking : CHAT_TEXT.send}
        </button>
        <button type="button" onClick={startOver} className={buttonClasses("outline", "sm", "cursor-pointer")}>
          {CHAT_TEXT.startOver}
        </button>
      </div>
    </div>
  );
}

/** A failure's message and its buttons (TR-50). In an alert, so it is read out when it appears. */
function FailureMessage({
  message,
  actions,
  waiting,
  onTryAgain,
  onUseForm,
  onStartOver,
}: {
  message: string;
  actions: ReturnType<typeof failureActions>;
  waiting: boolean;
  onTryAgain: () => void;
  onUseForm: () => void;
  onStartOver: () => void;
}) {
  const button = buttonClasses("outline", "sm", "cursor-pointer");
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-700 bg-red-50 p-4 text-base">
      <p className="text-red-800">{message}</p>
      {actions.logIn && (
        <div className="flex flex-col items-start gap-1">
          {/* A new tab, so this page and everything on it stay as they are. */}
          <a href={LOGIN_PATH} target="_blank" rel="noopener noreferrer" className={buttonClasses("navy", "sm")}>
            {FALLBACK_TEXT.logInAgain}
          </a>
          <p className="text-sm text-ink">{FALLBACK_TEXT.logInHelp}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {actions.tryAgain && (
          <button type="button" onClick={onTryAgain} disabled={waiting} className={button}>
            {FALLBACK_TEXT.tryAgain}
          </button>
        )}
        {actions.startOverChat && (
          <button type="button" onClick={onStartOver} className={button}>
            {FALLBACK_TEXT.startOverChat}
          </button>
        )}
        {actions.useForm && (
          <button type="button" onClick={onUseForm} className={button}>
            {FALLBACK_TEXT.useForm}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * One item: the user's on the right, the AI's on the left, notes as a small muted centred line.
 * `noteRef` marks the newest added note (TR-47), which takes focus.
 */
function ChatBubble({ item, noteRef }: { item: ChatItem; noteRef?: Ref<HTMLLIElement> }) {
  if (item.role === "note") {
    return (
      <li
        ref={noteRef}
        tabIndex={noteRef ? -1 : undefined}
        className="self-center px-2 text-center text-sm text-muted focus:outline-none"
      >
        {item.content}
      </li>
    );
  }
  const mine = item.role === "user";
  return (
    <li
      className={
        mine
          ? "max-w-[85%] self-end whitespace-pre-wrap rounded-xl bg-navy px-4 py-2 text-base text-white"
          : "max-w-[85%] self-start whitespace-pre-wrap rounded-xl border border-sand bg-white px-4 py-2 text-base text-ink"
      }
    >
      <span className="sr-only">{mine ? CHAT_TEXT.you : CHAT_TEXT.ai} </span>
      {item.content}
    </li>
  );
}
