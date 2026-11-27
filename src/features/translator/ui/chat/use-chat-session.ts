"use client";

import { useEffect, useReducer, useRef } from "react";
import type { SearchBrief } from "../../criteria/schema";
import {
  buildChatRequest,
  buildFileSummary,
  canSend,
  chatReducer,
  type ChatMode,
  currentBriefFor,
  type FileSummary,
  failingFetch,
  GREETING,
  initialChatState,
  interpretAiResult,
  postAi,
  settleRevision,
  withheldNote,
} from "../../ai";
import type { GroupedRecord } from "../../normalize/duplicates";

/**
 * The chat's state and its one network call (TR-44). A thin wrapper: every rule is in
 * `ai/chat-session.ts`. State lives in React only: nothing is stored, logged or put in the URL.
 * The request carries only the file summary, the chat and the current brief (`buildChatRequest`),
 * the brief cut to the values the summary holds; the summary is built per message with that brief
 * (fix B), and a note says once which of the user's values the AI can't see.
 *
 * The request is aborted on Start over chat and when the panel unmounts (switching to the form,
 * or leaving the step), so a late reply never shows up. The reducer also drops any reply whose
 * request number isn't the current one.
 *
 * `removeChip()` (TR-45) removes a chip from the proposal card. It changes `proposal` and
 * `lastValidBrief` together, so the next message sends the edited brief as `currentBrief`. It
 * makes no request.
 *
 * The same hook runs the Results step's chat (TR-46): `opening` is its first line, `mode` is
 * "revise" (the confirmed brief is always the `currentBrief`, and a proposal that changes nothing
 * becomes a note), and `dismissProposal()` closes the card on Cancel or after a confirm.
 * `addNote()` puts TR-47's explanation in the chat after a confirm: a note, never sent, no request.
 *
 * The request goes through `postAi()` (TR-50), which says what kind of failure it was;
 * `interpretAiResult()` turns that into the action. With `simulateFailure` (`?aiFail=1` where the
 * simulation is allowed), `failingFetch` stands in for `fetch`: every message fails as a network
 * failure after 1.5 seconds, and the route is never called.
 *
 * The session limit (TR-51): `onSent` is called once for every request really sent to the route
 * (never for a simulated failure), and `limitReached` stops `send()` altogether.
 */
export function useChatSession({
  records,
  layout,
  getCurrentBrief,
  opening = GREETING,
  mode = "criteria",
  simulateFailure = false,
  onSent,
  limitReached = false,
}: {
  records: readonly GroupedRecord[];
  layout: FileSummary["layout"];
  /**
   * The wizard's brief, read when a message is sent: the pending one on the Criteria step, the
   * confirmed one on the Results step. `currentBriefFor()` decides what is sent.
   */
  getCurrentBrief: () => SearchBrief | null;
  /** The chat's first assistant message. */
  opening?: string;
  mode?: ChatMode;
  /** TR-50 test mode: every message fails after 1.5 seconds, without calling the route. */
  simulateFailure?: boolean;
  /** Called once per request really sent to the route, for the session limit (TR-51). */
  onSent?: () => void;
  /** The session's AI limit is reached (TR-51): nothing more is sent. */
  limitReached?: boolean;
}) {
  const [state, dispatch] = useReducer(chatReducer, opening, initialChatState);
  // The request in flight, if any. Set at once, so a double click can't send twice.
  const inFlight = useRef<AbortController | null>(null);
  // The withheld-values note last added to this chat (fix B), so it is added once, not per message.
  const lastNote = useRef<string | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function send() {
    if (inFlight.current || limitReached || !canSend(state, state.draft)) return;
    const action = { type: "send", text: state.draft } as const;
    // The state the reducer is about to make, so the request holds exactly what is on screen.
    const sending = chatReducer(state, action);
    dispatch(action);
    const currentBrief = currentBriefFor(sending, getCurrentBrief(), mode);
    // Built with the brief it goes with, so the summary holds every value the brief uses that the
    // file really has (fix B). The same records and brief always give the same summary.
    const summary = buildFileSummary(records, layout, currentBrief);
    const note = withheldNote(currentBrief, summary);
    if (note !== null && note !== lastNote.current) dispatch({ type: "add-note", content: note });
    lastNote.current = note;

    const controller = new AbortController();
    inFlight.current = controller;
    // A simulated failure never reaches the route, so it doesn't count toward the limit.
    if (!simulateFailure) onSent?.();
    // No content is logged, whatever happens.
    const result = await postAi(simulateFailure ? failingFetch : fetch, buildChatRequest(sending, summary, currentBrief), controller.signal);
    if (result.kind === "aborted" || controller.signal.aborted) return;
    inFlight.current = null;
    const outcome = interpretAiResult(result);
    // On the Results step, compared with the brief this request carried.
    dispatch({ ...(mode === "revise" ? settleRevision(outcome, currentBrief) : outcome), requestId: sending.requestId });
  }

  function resetChat() {
    inFlight.current?.abort();
    inFlight.current = null;
    lastNote.current = null;
    dispatch({ type: "reset" });
  }

  function edit(text: string) {
    dispatch({ type: "edit", text });
  }

  function removeChip(chipId: string) {
    dispatch({ type: "remove-chip", chipId });
  }

  function dismissProposal() {
    dispatch({ type: "dismiss-proposal" });
  }

  function addNote(content: string) {
    dispatch({ type: "add-note", content });
  }

  return { state, send, edit, resetChat, removeChip, dismissProposal, addNote };
}
