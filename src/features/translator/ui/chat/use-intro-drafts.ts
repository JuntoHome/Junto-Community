"use client";

import { useEffect, useReducer, useRef } from "react";
import type { BriefIntent } from "../../criteria/schema";
import {
  buildIntroRequest,
  type IntroFields,
  type IntroRequestInfo,
  initialIntroState,
  interpretIntroResult,
  introReducer,
  postAi,
} from "../../ai";

/**
 * The intro drafts (TR-49) and their one network call. A thin wrapper: every rule is in
 * `ai/intro-session.ts`. It lives in `TranslatorWizard`, so Start over and a new file clear the
 * drafts through the remount; nothing is stored, logged or put in the URL. `drafts` (by Record
 * ID, with the text as the user left it) is what TR-52 will export.
 *
 * The request is only `buildIntroRequest()`: `kind`, the six intro fields, the intent and the
 * optional note. It is aborted when the panel closes (`cancel()`) and when the wizard unmounts,
 * and the reducer drops any reply whose request number isn't the pending one.
 *
 * The request goes through `postAi()` (TR-50). A `503` calls `onUnavailable`, so the wizard turns
 * the AI off for the session. The failure simulation (`?aiFail=1`) doesn't affect intro drafts.
 */
export function useIntroDrafts({
  onUnavailable,
  onSent,
  limitReached = false,
}: {
  onUnavailable?: () => void;
  /** Called once per request sent to the route, for the session limit (TR-51). */
  onSent?: () => void;
  /** The session's AI limit is reached (TR-51): nothing more is sent. */
  limitReached?: boolean;
} = {}) {
  const [state, dispatch] = useReducer(introReducer, initialIntroState);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function run(info: IntroRequestInfo) {
    if (inFlight.current || limitReached) return;
    const action = { type: "request", ...info } as const;
    // The number the reducer is about to give this request.
    const { requestId } = introReducer(state, action);
    dispatch(action);

    const controller = new AbortController();
    inFlight.current = controller;
    onSent?.();
    // No content is logged, whatever happens.
    const result = await postAi(fetch, buildIntroRequest(info.intro, info.intent, info.goal), controller.signal);
    if (result.kind === "aborted" || controller.signal.aborted) return;
    inFlight.current = null;
    dispatch({ ...interpretIntroResult(result), requestId });
    if (result.kind === "unavailable") onUnavailable?.();
  }

  /** Writes (or writes again) the draft for one record. */
  function write(recordId: string, intro: IntroFields, intent: BriefIntent, goal: string) {
    void run({ recordId, intro, intent, goal });
  }

  /** Try again after an error: resends the failed request exactly as it was. */
  function retry() {
    if (state.error) void run(state.error.request);
  }

  /** Saves the user's edits to a draft. */
  function edit(recordId: string, text: string) {
    dispatch({ type: "edit", recordId, text });
  }

  /** The panel closed: aborts a request in flight and clears the error. Drafts are kept. */
  function cancel() {
    inFlight.current?.abort();
    inFlight.current = null;
    dispatch({ type: "reset" });
  }

  return { state, drafts: state.drafts, write, retry, edit, cancel };
}

/** What the Results step gets from the wizard. */
export type IntroDrafts = ReturnType<typeof useIntroDrafts>;
