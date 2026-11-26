"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import type { SearchBrief } from "../../criteria/schema";
import {
  buildChatRequest,
  buildFileSummary,
  canSend,
  chatReducer,
  type ChatMode,
  currentBriefFor,
  type FileSummary,
  GREETING,
  initialChatState,
  interpretResponse,
  settleRevision,
} from "../../ai";
import type { GroupedRecord } from "../../normalize/duplicates";

const AI_ROUTE = "/api/translator/ai";

/**
 * The chat's state and its one network call (TR-44). A thin wrapper: every rule is in
 * `ai/chat-session.ts`. State lives in React only: nothing is stored, logged or put in the URL.
 * The request carries only the file summary, the chat and the current brief (`buildChatRequest`).
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
 */
export function useChatSession({
  records,
  layout,
  getCurrentBrief,
  opening = GREETING,
  mode = "criteria",
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
}) {
  const [state, dispatch] = useReducer(chatReducer, opening, initialChatState);
  // Built once per file: the same records always give the same summary.
  const summary = useMemo(() => buildFileSummary(records, layout), [records, layout]);
  // The request in flight, if any. Set at once, so a double click can't send twice.
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function send() {
    if (inFlight.current || !canSend(state, state.draft)) return;
    const action = { type: "send", text: state.draft } as const;
    // The state the reducer is about to make, so the request holds exactly what is on screen.
    const sending = chatReducer(state, action);
    dispatch(action);
    const currentBrief = currentBriefFor(sending, getCurrentBrief(), mode);

    const controller = new AbortController();
    inFlight.current = controller;
    let status = 0;
    let body: string | null = null;
    try {
      const response = await fetch(AI_ROUTE, {
        method: "POST",
        // The route reads JSON only and refuses anything else with a 400.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildChatRequest(sending, summary, currentBrief)),
        signal: controller.signal,
      });
      status = response.status;
      body = await response.text();
    } catch {
      // A network failure (or an abort): `interpretResponse` turns a null body into the
      // "Couldn't reach the AI" message. Nothing is logged.
    }
    if (controller.signal.aborted) return;
    inFlight.current = null;
    const outcome = interpretResponse(status, body);
    // On the Results step, compared with the brief this request carried.
    dispatch({ ...(mode === "revise" ? settleRevision(outcome, currentBrief) : outcome), requestId: sending.requestId });
  }

  function resetChat() {
    inFlight.current?.abort();
    inFlight.current = null;
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

  return { state, send, edit, resetChat, removeChip, dismissProposal };
}
