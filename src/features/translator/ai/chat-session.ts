/**
 * Capability: the chat's rules (TR-44). The chat panel and `use-chat-session.ts` only render
 * and wire these up. The proposal card (TR-45) uses `PROPOSAL_TEXT` and the `remove-chip` action.
 * Input: the chat state, the actions the hook dispatches, and the route's raw responses.
 * Output: the next chat state, the request body for `/api/translator/ai`, whether Send may run,
 * and what screen readers hear.
 * Privacy: the request holds only the file summary, the user and assistant turns, and the
 * current brief. Never rows, IDs or the file. Notes are app messages: they stay on screen and
 * are never sent. Nothing here stores or logs anything.
 * This module is pure (zod only, no React, no I/O).
 */
import { z } from "zod";
import { removeChip } from "../criteria/chips";
import { type SearchBrief, searchBriefSchema } from "../criteria/schema";
import { MAX_MESSAGES, MAX_USER_MESSAGE_CHARS } from "./request-schema";
import type { FileSummary } from "./summary";
import type { AiRequest, ChatMessage } from "./types";

/** The first AI message, shown at once with no network call, and sent so the AI knows it was asked. */
export const GREETING = "What would make this list useful to you? For example, finding customers in Phoenix.";

// The chat's strings. Plain language, no em-dashes.
export const CHAT_TEXT = {
  greeting: GREETING,
  conversation: "Conversation",
  you: "You:",
  ai: "AI:",
  messageLabel: "Your message",
  messageHelp: "Press Enter to send, Shift+Enter for a new line.",
  send: "Send",
  thinking: "Thinking...",
  startOver: "Start over chat",
  useForm: "Use the form",
  cantReach: "Couldn't reach the AI. Check your connection and try again.",
  limitReached: "This chat is getting long. Start over chat to keep going, or use the form.",
} as const;

// The proposal card's strings (TR-45). Plain language, no em-dashes.
export const PROPOSAL_TEXT = {
  heading: "Here's what I understood",
  assumptionsHelp: "These are guesses. Remove any that are wrong.",
  remove: (label: string) => `Remove ${label}`,
  removed: (label: string) => `Removed ${label}.`,
  confirm: "Confirm and rank",
  needsCriterion: "Add at least one must-have or preference, or use the form.",
  keepChatting: "Keep chatting",
  editInForm: "Edit in form",
} as const;

/** The character counter shows from this many characters. */
export const COUNTER_FROM = 800;

export type ChatItem = { id: string; role: "user" | "assistant" | "note"; content: string };

export type ChatState = {
  items: ChatItem[];
  status: "idle" | "waiting" | "error";
  /** The last failure's text, shown under the list. */
  error: string | null;
  /**
   * The AI's latest proposal, shown on the proposal card (TR-45). Kept until a new one or a
   * reset. Removing a chip changes it here.
   */
  proposal: SearchBrief | null;
  /**
   * The last brief the AI proposed that passed the checks, sent back as `currentBrief`. A chip
   * removal changes it too, so the AI's next turn starts from the edited brief.
   */
  lastValidBrief: SearchBrief | null;
  /** Counts requests. A reply is used only if it carries the current one, so a late reply is dropped. */
  requestId: number;
  /** What is in the message box. A failed message comes back here, so Send retries it. */
  draft: string;
};

export type ChatAction =
  | { type: "edit"; text: string }
  | { type: "send"; text: string }
  | { type: "received"; requestId: number; reply: string; note: string | null; proposal: SearchBrief | null }
  | { type: "failed"; requestId: number; error: string }
  /** A chip removed on the proposal card: `chipId` is from `briefChips(state.proposal)`. No AI call. */
  | { type: "remove-chip"; chipId: string }
  | { type: "reset" };

/** What `interpretResponse()` gives: a `received` or `failed` action, without the request it answers. */
export type ChatOutcome =
  | Omit<Extract<ChatAction, { type: "received" }>, "requestId">
  | Omit<Extract<ChatAction, { type: "failed" }>, "requestId">;

type InterviewRequest = Extract<AiRequest, { kind: "interview" }>;

const GREETING_ID = "greeting";

/** A new chat: only the greeting, nothing typed, nothing proposed. */
export function initialChatState(): ChatState {
  return {
    items: [{ id: GREETING_ID, role: "assistant", content: GREETING }],
    status: "idle",
    error: null,
    proposal: null,
    lastValidBrief: null,
    requestId: 0,
    draft: "",
  };
}

/** The turns the AI sees: user and assistant items, as `{ role, content }`. Notes stay on screen only. */
function chatMessages(items: readonly ChatItem[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const { role, content } of items) {
    if (role !== "note") messages.push({ role, content });
  }
  return messages;
}

/**
 * True when one more message would make the request longer than the route allows
 * (`MAX_MESSAGES`), so the user sees `CHAT_TEXT.limitReached` instead of a 413.
 */
export function limitReached(state: ChatState): boolean {
  return chatMessages(state.items).length + 1 > MAX_MESSAGES;
}

/** Whether `text` may be sent now: not while waiting, not blank, not too long, not past the message limit. */
export function canSend(state: ChatState, text: string): boolean {
  return (
    state.status !== "waiting" &&
    text.trim().length > 0 &&
    text.length <= MAX_USER_MESSAGE_CHARS &&
    !limitReached(state)
  );
}

/** The counter under the message box, such as "820 / 1,000", or null below `COUNTER_FROM` characters. */
export function characterCount(text: string): string | null {
  if (text.length < COUNTER_FROM) return null;
  return `${text.length.toLocaleString("en-US")} / ${MAX_USER_MESSAGE_CHARS.toLocaleString("en-US")}`;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "edit":
      return { ...state, draft: action.text };

    case "send": {
      if (!canSend(state, action.text)) return state;
      const requestId = state.requestId + 1;
      return {
        ...state,
        items: [...state.items, { id: `user-${requestId}`, role: "user", content: action.text.trim() }],
        status: "waiting",
        error: null,
        requestId,
        draft: "",
      };
    }

    case "received": {
      if (action.requestId !== state.requestId || state.status !== "waiting") return state;
      const items: ChatItem[] = [
        ...state.items,
        { id: `assistant-${action.requestId}`, role: "assistant", content: action.reply },
      ];
      if (action.note) items.push({ id: `note-${action.requestId}`, role: "note", content: action.note });
      return {
        ...state,
        items,
        status: "idle",
        error: null,
        ...(action.proposal && { proposal: action.proposal, lastValidBrief: action.proposal }),
      };
    }

    case "failed": {
      if (action.requestId !== state.requestId || state.status !== "waiting") return state;
      const failedId = `user-${action.requestId}`;
      const failed = state.items.find((item) => item.id === failedId);
      return {
        ...state,
        items: state.items.filter((item) => item.id !== failedId),
        status: "error",
        error: action.error,
        // The failed message goes back in the box. Anything typed while waiting is kept after it.
        draft: [failed?.content, state.draft].filter(Boolean).join("\n"),
      };
    }

    case "remove-chip": {
      if (!state.proposal) return state;
      const proposal = removeChip(state.proposal, action.chipId);
      return proposal === state.proposal ? state : { ...state, proposal, lastValidBrief: proposal };
    }

    case "reset":
      // A fresh request number, so a reply to a request sent before the reset is ignored.
      return { ...initialChatState(), requestId: state.requestId + 1 };
  }
}

/** The brief sent as `currentBrief`: the AI's last valid one, otherwise the wizard's pending one. */
export function currentBriefFor(state: ChatState, pendingBrief: SearchBrief | null): SearchBrief | undefined {
  return state.lastValidBrief ?? pendingBrief ?? undefined;
}

/**
 * The body for `/api/translator/ai`: `kind`, `summary`, `messages` and, when there is one,
 * `currentBrief` (the route refuses `null`, so the key is left out). Nothing else.
 */
export function buildChatRequest(
  state: ChatState,
  summary: FileSummary,
  currentBrief: SearchBrief | undefined,
): InterviewRequest {
  return {
    kind: "interview",
    summary,
    messages: chatMessages(state.items),
    ...(currentBrief && { currentBrief }),
  };
}

const interviewReplySchema = z.object({
  ok: z.literal(true),
  kind: z.literal("interview"),
  reply: z.string().min(1),
  proposal: searchBriefSchema.nullable(),
  note: z.string().min(1).nullable(),
});

const errorReplySchema = z.object({ ok: z.literal(false), error: z.string().trim().min(1) });

/**
 * Turns any route response into `received` or `failed`. `body` is the response's text, or null
 * when the request didn't get a response (a network failure). A body that isn't JSON, or that
 * has neither a usable reply nor an `error`, gives `CHAT_TEXT.cantReach`. The route's own error
 * text is shown as it is. The status isn't needed: the body says what happened.
 */
export function interpretResponse(status: number, body: string | null): ChatOutcome {
  let json: unknown;
  try {
    json = body === null ? null : JSON.parse(body);
  } catch {
    json = null;
  }
  const reply = interviewReplySchema.safeParse(json);
  if (status >= 200 && status < 300 && reply.success) {
    const { reply: text, note, proposal } = reply.data;
    return { type: "received", reply: text, note, proposal };
  }
  const error = errorReplySchema.safeParse(json);
  return { type: "failed", error: error.success ? error.data.error : CHAT_TEXT.cantReach };
}

/**
 * What the live region says: the AI's newest reply and its note, if any, after the last thing
 * the user sent. Empty until the first reply, so the greeting and the history are never read
 * out again.
 */
export function latestAnnouncement(state: ChatState): string {
  let lastUser = state.items.length - 1;
  while (lastUser >= 0 && state.items[lastUser].role !== "user") lastUser -= 1;
  if (lastUser === -1) return "";
  const latest = state.items.slice(lastUser + 1).map((item) => item.content);
  return latest.length > 0 ? `${CHAT_TEXT.ai} ${latest.join(" ")}` : "";
}
