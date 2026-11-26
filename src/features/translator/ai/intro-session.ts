/**
 * Capability: the intro panel's rules (TR-49), the same pattern as `chat-session.ts`. The panel
 * (`ui/chat/intro-panel.tsx`) and `ui/chat/use-intro-drafts.ts` only render and wire these up.
 * Input: the session state, the actions the hook dispatches, and the route's raw responses.
 * Output: the next state (the drafts, keyed by Record ID, for TR-52), the request body for
 * `/api/translator/ai`, and the panel's strings.
 * Privacy: the request holds only `kind`, the six intro fields (`pickIntroFields()`, TR-48), the
 * intent and the user's optional note. Drafts live in React state only: never stored, logged or
 * put in the URL. Nothing is ever sent to the business: the user copies the draft.
 * This module is pure (zod only, no React, no I/O).
 */
import { z } from "zod";
import type { BriefIntent } from "../criteria/schema";
import { type IntroFields, MAX_INTRO_NOTE_CHARS } from "./intro";
import type { AiRequest } from "./types";

// Every string the intro panel shows. Plain language, no em-dashes.
export const INTRO_PANEL_TEXT = {
  draftIntro: "Draft intro",
  noCompany: "No company name in the file",
  title: (company: string) => `Draft an intro for ${company}`,
  /** Verbatim, as agreed with the project lead. Never edit it; the note line goes below it. */
  whatIsSent: "These details will be sent to the AI: company, industry, city, state, contact name and title. Nothing else from your file.",
  labels: {
    company: "Company",
    industry: "Industry",
    city: "City",
    state: "State",
    contactName: "Contact name",
    contactTitle: "Contact title",
  } satisfies Record<keyof IntroFields, string>,
  notInFile: "Not in file",
  noteLabel: "Your note (optional)",
  notePlaceholder: "For example: I run a small fabrication shop and want to introduce our services.",
  noteSent: "Your note is sent too, if you write one.",
  /** "12 / 300" */
  noteCount: (length: number) => `${length} / ${MAX_INTRO_NOTE_CHARS}`,
  write: "Write draft",
  writing: "Writing...",
  writeAgain: "Write again",
  writeAgainEdited: "Write again (replaces your edits)",
  draftLabel: "Your draft",
  fillIn: "Fill in the parts in [brackets] before you send it.",
  /** "3 to fill in" */
  toFillIn: (count: number) => `${count} to fill in`,
  nothingToFill: "Nothing in brackets left to fill in.",
  copy: "Copy",
  copied: "Copied",
  copyManually: "Press Ctrl+C (or Cmd+C) to copy.",
  tryAgain: "Try again",
  close: "Close",
  cantReach: "Couldn't reach the AI. Check your connection and try again.",
} as const;

/** What one draft was written from: the record, its six intro fields, the intent and the note. */
export type IntroRequestInfo = { recordId: string; intro: IntroFields; intent: BriefIntent; goal: string };

/**
 * One draft, kept per Record ID until Start over. `draft` is the text as the user last left it
 * (TR-52 exports this), `aiDraft` the AI's text, and `edited` whether the two differ.
 */
export type IntroDraft = IntroRequestInfo & { draft: string; edited: boolean; aiDraft: string };

export type IntroSessionState = {
  /** The drafts, by Record ID. Writing again replaces that record's draft. */
  drafts: Readonly<Record<string, IntroDraft>>;
  /** Counts requests. A reply is used only if it carries the pending one, so a late reply is dropped. */
  requestId: number;
  /** The request in flight, if any. One at a time: the panel is a modal dialog. */
  pending: (IntroRequestInfo & { requestId: number }) | null;
  /** The last failure: whose, the route's text, and the request, so Try again resends it as it was. */
  error: { recordId: string; message: string; request: IntroRequestInfo } | null;
};

export type IntroAction =
  | ({ type: "request" } & IntroRequestInfo)
  | { type: "received"; requestId: number; draft: string }
  | { type: "failed"; requestId: number; error: string }
  | { type: "edit"; recordId: string; text: string }
  /** Cancels a request in flight and clears the error (the panel closed). Drafts are kept. */
  | { type: "reset" };

export const initialIntroState: IntroSessionState = { drafts: {}, requestId: 0, pending: null, error: null };

/** Just the request's own fields, written out so nothing else is carried along. */
const infoOf = ({ recordId, intro, intent, goal }: IntroRequestInfo): IntroRequestInfo => ({ recordId, intro, intent, goal });

export function introReducer(state: IntroSessionState, action: IntroAction): IntroSessionState {
  switch (action.type) {
    case "request": {
      const requestId = state.requestId + 1;
      return { ...state, requestId, pending: { ...infoOf(action), requestId }, error: null };
    }

    case "received": {
      const { pending } = state;
      if (!pending || action.requestId !== pending.requestId) return state;
      const info = infoOf(pending);
      const draft: IntroDraft = { ...info, draft: action.draft, aiDraft: action.draft, edited: false };
      return { ...state, drafts: { ...state.drafts, [info.recordId]: draft }, pending: null };
    }

    case "failed": {
      const { pending } = state;
      if (!pending || action.requestId !== pending.requestId) return state;
      const request = infoOf(pending);
      return { ...state, pending: null, error: { recordId: request.recordId, message: action.error, request } };
    }

    case "edit": {
      const current = state.drafts[action.recordId];
      if (!current || current.draft === action.text) return state;
      const draft: IntroDraft = { ...current, draft: action.text, edited: action.text !== current.aiDraft };
      return { ...state, drafts: { ...state.drafts, [action.recordId]: draft } };
    }

    case "reset":
      // A fresh request number, so a reply to a request sent before the reset is ignored.
      return state.pending || state.error ? { ...state, requestId: state.requestId + 1, pending: null, error: null } : state;
  }
}

type IntroRequest = Extract<AiRequest, { kind: "intro" }>;

/**
 * The body for `/api/translator/ai`: exactly `kind`, `intro` (the six fields) and `intent`, plus
 * `goal` only when the note has text in it after trimming. Nothing else.
 */
export function buildIntroRequest(intro: IntroFields, intent: BriefIntent, goal: string): IntroRequest {
  const note = goal.trim();
  return { kind: "intro", intro, intent, ...(note && { goal: note }) };
}

/** What `interpretIntroResponse()` gives: a `received` or `failed` action, without the request it answers. */
export type IntroOutcome =
  | Omit<Extract<IntroAction, { type: "received" }>, "requestId">
  | Omit<Extract<IntroAction, { type: "failed" }>, "requestId">;

const introReplySchema = z.object({ ok: z.literal(true), kind: z.literal("intro"), draft: z.string().trim().min(1) });
const errorReplySchema = z.object({ ok: z.literal(false), error: z.string().trim().min(1) });

/**
 * Turns any route response into `received` or `failed`. `body` is the response's text, or null
 * when there was no response (a network failure). The route's own error text is shown as it is;
 * anything unreadable gives `cantReach`.
 */
export function interpretIntroResponse(status: number, body: string | null): IntroOutcome {
  let json: unknown;
  try {
    json = body === null ? null : JSON.parse(body);
  } catch {
    json = null;
  }
  const reply = introReplySchema.safeParse(json);
  if (status >= 200 && status < 300 && reply.success) return { type: "received", draft: reply.data.draft };
  const error = errorReplySchema.safeParse(json);
  return { type: "failed", error: error.success ? error.data.error : INTRO_PANEL_TEXT.cantReach };
}

/** A part in square brackets, such as `[Your name]` or `[contact details]`, on one line. */
const BRACKETED = /\[[^\]\n]+\]/g;

/** How many parts in [brackets] are left to fill in, each time one appears. */
export function placeholderCount(draft: string): number {
  return draft.match(BRACKETED)?.length ?? 0;
}
