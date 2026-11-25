"use client";

import { type KeyboardEvent, useEffect, useId, useRef } from "react";
import { buttonClasses } from "@/components/ui/button";
import { textareaClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import type { SearchBrief } from "../../criteria/schema";
import {
  canSend,
  CHAT_TEXT,
  type ChatItem,
  characterCount,
  type FileSummary,
  latestAnnouncement,
  limitReached,
  MAX_USER_MESSAGE_CHARS,
} from "../../ai";
import type { GroupedRecord } from "../../normalize/duplicates";
import { useChatSession } from "./use-chat-session";

/**
 * Chat with AI (TR-44): the conversation, the message box, Send and Start over chat. It only
 * renders and forwards events; the rules are in `ai/chat-session.ts` and the state and the
 * request in `use-chat-session.ts`.
 *
 * Screen readers: a separate, visually hidden live region says only the newest AI reply and its
 * note, so the history isn't read again. Errors use `role="alert"`. After sending, focus goes
 * back to the message box.
 */
export function ChatPanel({
  records,
  layout,
  pendingBrief,
  onUseForm,
}: {
  records: readonly GroupedRecord[];
  layout: FileSummary["layout"];
  pendingBrief: SearchBrief | null;
  /** Switches the Criteria step to the form. */
  onUseForm: () => void;
}) {
  const { state, send, edit, resetChat } = useChatSession({ records, layout, pendingBrief });
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
      <ol
        ref={listRef}
        aria-label={CHAT_TEXT.conversation}
        className="flex max-h-[28rem] min-h-48 flex-col gap-3 overflow-y-auto rounded-xl border border-sand bg-ivory p-4"
      >
        {state.items.map((item) => (
          <ChatBubble key={item.id} item={item} />
        ))}
      </ol>

      <div aria-live="polite" className="sr-only">
        {latestAnnouncement(state)}
      </div>

      {state.proposal && (
        // TODO(TR-45): replace this line with the confirm view.
        <p className="text-base font-semibold text-navy">{CHAT_TEXT.proposalReady}</p>
      )}

      {state.error && (
        <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-red-700 bg-red-50 p-4 text-base">
          <p className="text-red-800">{state.error}</p>
          <button type="button" onClick={onUseForm} className={buttonClasses("outline", "sm", "cursor-pointer")}>
            {CHAT_TEXT.useForm}
          </button>
        </div>
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
          rows={3}
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

/** One item: the user's on the right, the AI's on the left, notes as a small muted centred line. */
function ChatBubble({ item }: { item: ChatItem }) {
  if (item.role === "note") {
    return <li className="self-center px-2 text-center text-sm text-muted">{item.content}</li>;
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
