/**
 * Capability: the chat's rules (TR-44). The chat panel and `use-chat-session.ts` only render
 * and wire these up. The proposal card (TR-45) uses `PROPOSAL_TEXT` and the `remove-chip` action.
 * The chat on the Results step (TR-46) is the same chat in "revise" mode: its own opening line,
 * the confirmed brief as `currentBrief`, `settleRevision()` and `REVISE_TEXT`. After a revision
 * is confirmed, the `add-note` action puts TR-47's explanation (`explainChange()`) in the chat.
 * When the AI fails (TR-50): `interpretAiResult()` turns `postAi()`'s result into an action, the
 * state counts AI failures in a row, `shouldSwitchToForm()` and `aiTurnedOff()` say what the UI
 * should do, and `fallbackBrief()` is the brief the form is filled in with.
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
import { type BriefChange, diffBriefs } from "./diff-brief";
import { failureMessage } from "./fallback";
import { type AiFailureKind, countsAsAiFailure, type PostAiResult } from "./post-ai";
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

// The strings of the chat on the Results step (TR-46). Plain language, no em-dashes.
export const REVISE_TEXT = {
  /** The panel's heading, and the chat's first assistant message (sent, so the AI knows it was asked). */
  opening: "Want to change something? Tell me.",
  changed: "Changed:",
  several: "The AI changed more than one thing. Check each one before you confirm.",
  noChange: "Your criteria are the same, so nothing to update.",
  cancel: "Cancel",
  marks: { new: "(new)", changed: "(changed)" },
} as const;

/**
 * Which brief the chat sends as `currentBrief`:
 * - `criteria` (the Criteria step, TR-44): the AI's last valid proposal, else the wizard's brief.
 * - `revise` (the Results step, TR-46): always the confirmed brief, read when the message is
 *   sent, so a Save in the criteria summary made in between is included. A proposal there is
 *   compared with it (`diffBriefs()`) and never becomes the base until it is confirmed.
 */
export type ChatMode = "criteria" | "revise";

/** The character counter shows from this many characters. */
export const COUNTER_FROM = 800;

export type ChatItem = { id: string; role: "user" | "assistant" | "note"; content: string };

export type ChatState = {
  /** The first assistant message: `GREETING`, or `REVISE_TEXT.opening` on the Results step. Reset keeps it. */
  opening: string;
  items: ChatItem[];
  status: "idle" | "waiting" | "error";
  /** The last failure's text, shown under the list. */
  error: string | null;
  /** The last failure's kind (TR-50), which decides the buttons under the message. Null after a reply. */
  failureKind: AiFailureKind | null;
  /**
   * AI failures in a row (`ai-failure` or `network`, TR-50). A reply resets it; a login expiry, a
   * rate limit or another refusal leaves it as it is. At 2 the Criteria step switches to the form.
   */
  failures: number;
  /** The route said the AI isn't available (`503`): the wizard turns the AI off for the session. */
  aiOff: boolean;
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
  | { type: "failed"; requestId: number; error: string; kind: AiFailureKind }
  /** A chip removed on the proposal card: `chipId` is from `briefChips(state.proposal)`. No AI call. */
  | { type: "remove-chip"; chipId: string }
  /** The proposal card closes (TR-46): Cancel, or a revision confirmed. The chat is kept. */
  | { type: "dismiss-proposal" }
  /**
   * An app note added after the chat's own turns (TR-47): the explanation after a confirmed
   * revision. A note like any other, so it is never sent. No AI call.
   */
  | { type: "add-note"; content: string }
  | { type: "reset" };

/** What `interpretAiResult()` gives: a `received` or `failed` action, without the request it answers. */
export type ChatOutcome =
  | Omit<Extract<ChatAction, { type: "received" }>, "requestId">
  | Omit<Extract<ChatAction, { type: "failed" }>, "requestId">;

type InterviewRequest = Extract<AiRequest, { kind: "interview" }>;

const GREETING_ID = "greeting";

/** The id prefix of a note added with `add-note`, so the live region can read it on its own. */
const ADDED_NOTE_PREFIX = "added-note-";

/** Whether `item` is a note added with `add-note` (TR-47's explanation). */
export function isAddedNote(item: ChatItem): boolean {
  return item.role === "note" && item.id.startsWith(ADDED_NOTE_PREFIX);
}

/** A new chat: only the opening line (the greeting by default), nothing typed, nothing proposed. */
export function initialChatState(opening: string = GREETING): ChatState {
  return {
    opening,
    items: [{ id: GREETING_ID, role: "assistant", content: opening }],
    status: "idle",
    error: null,
    failureKind: null,
    failures: 0,
    aiOff: false,
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
        failureKind: null,
        failures: 0,
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
        failureKind: action.kind,
        failures: countsAsAiFailure(action.kind) ? state.failures + 1 : state.failures,
        aiOff: state.aiOff || action.kind === "unavailable",
        // The failed message goes back in the box. Anything typed while waiting is kept after it.
        draft: [failed?.content, state.draft].filter(Boolean).join("\n"),
      };
    }

    case "remove-chip": {
      if (!state.proposal) return state;
      const proposal = removeChip(state.proposal, action.chipId);
      return proposal === state.proposal ? state : { ...state, proposal, lastValidBrief: proposal };
    }

    case "dismiss-proposal":
      return state.proposal ? { ...state, proposal: null } : state;

    case "add-note": {
      if (action.content.trim() === "") return state;
      // Items only grow until a reset, so the count makes the id unique in this list.
      const item: ChatItem = { id: `${ADDED_NOTE_PREFIX}${state.items.length}`, role: "note", content: action.content };
      return { ...state, items: [...state.items, item] };
    }

    case "reset":
      // A fresh request number, so a reply to a request sent before the reset is ignored.
      return { ...initialChatState(state.opening), requestId: state.requestId + 1 };
  }
}

/**
 * The brief sent as `currentBrief` (see `ChatMode`). `base` is the wizard's brief: the pending
 * one on the Criteria step, the confirmed one on the Results step.
 */
export function currentBriefFor(
  state: ChatState,
  base: SearchBrief | null,
  mode: ChatMode = "criteria",
): SearchBrief | undefined {
  return (mode === "revise" ? base : (state.lastValidBrief ?? base)) ?? undefined;
}

/**
 * For the Results step's chat (TR-46): a proposal that changes nothing compared with `base` (the
 * brief the request carried) becomes the note `REVISE_TEXT.noChange`, so no card is shown.
 * Anything else is passed on unchanged.
 */
export function settleRevision(outcome: ChatOutcome, base: SearchBrief | undefined): ChatOutcome {
  if (outcome.type !== "received" || !outcome.proposal || !base) return outcome;
  return diffBriefs(base, outcome.proposal).length === 0 ? { ...outcome, proposal: null, note: REVISE_TEXT.noChange } : outcome;
}

/** What screen readers hear about a revision: "Changed: List size: 40 to 30; ...", and the warning for several. */
export function changesAnnouncement(changes: readonly BriefChange[]): string {
  if (changes.length === 0) return "";
  const list = `${REVISE_TEXT.changed} ${changes.map((change) => change.text).join("; ")}.`;
  return changes.length > 1 ? `${list} ${REVISE_TEXT.several}` : list;
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

/**
 * Turns `postAi()`'s result (anything but `aborted`, which the hook drops) into `received` or
 * `failed`. A failure carries its kind and the message for it (`failureMessage()`: the AI-failure
 * text, the login text, or the route's own text for 413, 429 and 400). A `200` whose JSON isn't a
 * usable interview reply counts as the AI failing.
 */
export function interpretAiResult(result: Exclude<PostAiResult, { kind: "aborted" }>): ChatOutcome {
  if (result.kind === "ok") {
    const reply = interviewReplySchema.safeParse(result.json);
    if (reply.success) {
      const { reply: text, note, proposal } = reply.data;
      return { type: "received", reply: text, note, proposal };
    }
    return { type: "failed", kind: "ai-failure", error: failureMessage("ai-failure", null) };
  }
  return { type: "failed", kind: result.kind, error: failureMessage(result.kind, result.error) };
}

/**
 * True right after the second AI failure in a row (TR-50): the Criteria step then switches to the
 * form on its own. The Results step never does; it shows the message with Use the form.
 */
export function shouldSwitchToForm(state: ChatState): boolean {
  return state.status === "error" && state.failures >= 2;
}

/** True once the route has said the AI isn't available (`503`): the wizard turns the AI off. */
export function aiTurnedOff(state: ChatState): boolean {
  return state.aiOff;
}

/**
 * The brief the form is filled in with after Use the form or the automatic switch (TR-50):
 * - `criteria`: the AI's last proposal that passed the checks, else `base` (the pending brief).
 * - `revise` (the Results step): always `base`, the confirmed brief, so the form shows what the
 *   results on screen were ranked with. A proposal there was never confirmed.
 * Null when there is none (the form is then left as it is).
 */
export function fallbackBrief(state: ChatState, base: SearchBrief | null, mode: ChatMode = "criteria"): SearchBrief | null {
  return mode === "revise" ? base : (state.lastValidBrief ?? base);
}

/**
 * What the live region says: the AI's newest reply and its note, if any, after the last thing
 * the user sent. Empty until the first reply, so the greeting and the history are never read
 * out again. When the newest item is a note added with `add-note` (TR-47), only that note, so
 * the reply isn't read again.
 */
export function latestAnnouncement(state: ChatState): string {
  const last = state.items.at(-1);
  if (last && isAddedNote(last)) return last.content;
  let lastUser = state.items.length - 1;
  while (lastUser >= 0 && state.items[lastUser].role !== "user") lastUser -= 1;
  if (lastUser === -1) return "";
  const latest = state.items.slice(lastUser + 1).map((item) => item.content);
  return latest.length > 0 ? `${CHAT_TEXT.ai} ${latest.join(" ")}` : "";
}
