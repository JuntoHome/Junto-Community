"use client";

import { useEffect, useReducer, useRef } from "react";
import type { BriefIntent } from "../../criteria/schema";
import {
  buildIntroRequest,
  type IntroFields,
  type IntroRequestInfo,
  initialIntroState,
  interpretIntroResponse,
  introReducer,
} from "../../ai";

const AI_ROUTE = "/api/translator/ai";

/**
 * The intro drafts (TR-49) and their one network call. A thin wrapper: every rule is in
 * `ai/intro-session.ts`. It lives in `TranslatorWizard`, so Start over and a new file clear the
 * drafts through the remount; nothing is stored, logged or put in the URL. `drafts` (by Record
 * ID, with the text as the user left it) is what TR-52 will export.
 *
 * The request is only `buildIntroRequest()`: `kind`, the six intro fields, the intent and the
 * optional note. It is aborted when the panel closes (`cancel()`) and when the wizard unmounts,
 * and the reducer drops any reply whose request number isn't the pending one.
 */
export function useIntroDrafts() {
  const [state, dispatch] = useReducer(introReducer, initialIntroState);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => () => inFlight.current?.abort(), []);

  async function run(info: IntroRequestInfo) {
    if (inFlight.current) return;
    const action = { type: "request", ...info } as const;
    // The number the reducer is about to give this request.
    const { requestId } = introReducer(state, action);
    dispatch(action);

    const controller = new AbortController();
    inFlight.current = controller;
    let status = 0;
    let body: string | null = null;
    try {
      const response = await fetch(AI_ROUTE, {
        method: "POST",
        // The route reads JSON only and refuses anything else with a 400.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildIntroRequest(info.intro, info.intent, info.goal)),
        signal: controller.signal,
      });
      status = response.status;
      body = await response.text();
    } catch {
      // A network failure (or an abort): a null body gives the "Couldn't reach the AI" message. Nothing is logged.
    }
    if (controller.signal.aborted) return;
    inFlight.current = null;
    dispatch({ ...interpretIntroResponse(status, body), requestId });
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
