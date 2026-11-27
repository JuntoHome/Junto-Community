import {
  buildChatRequest,
  type ChatMode,
  chatReducer,
  type ChatState,
  currentBriefFor,
  initialChatState,
  interpretAiResult,
  REVISE_TEXT,
  settleRevision,
  withheldNote,
} from "../ai/chat-session";
import { handleAiRequest, type AiRouteDeps } from "../ai/handle-request";
import type { IntroFields } from "../ai/intro";
import { buildIntroRequest, interpretIntroResult, type IntroOutcome } from "../ai/intro-session";
import { postAi, type FetchFn } from "../ai/post-ai";
import type { FileSummary } from "../ai/summary";
import type { AiCall } from "../ai/types";
import type { BriefIntent, SearchBrief } from "../criteria/schema";

/**
 * The browser and the route together, without React or a server (TR-54), so a test can follow a
 * message the whole way: the chat state, the request body, the real route handler
 * (`handleAiRequest()`, every check included) with a fake AI behind it, the response, and back
 * into the chat state.
 *
 * - `createRouteHarness()` gives a `fetch` for `postAi()` that hands each request to
 *   `handleAiRequest()` and records every request body and response. The route's dependencies
 *   can be changed between requests (`setAi()`, `deps`): log out, switch the AI off.
 * - `createChatDriver()` does what `send()` in `ui/chat/use-chat-session.ts` does, in the same
 *   order with the same functions: `send`, `currentBriefFor()`, `buildChatRequest()`, `postAi()`,
 *   `interpretAiResult()`, `settleRevision()` on the Results step, then the reply. `tryAgain()` is
 *   the Try again button: it sends the message the failure put back in the box. If the hook's
 *   `send()` changes, change this to match.
 * - `requestIntro()` does what `ui/chat/use-intro-drafts.ts` does for Write draft.
 *
 * The route turns an exception from the AI call into a `502`, which would hide the strict fake's
 * "no scripted reply" error as an ordinary AI failure. So the harness keeps those errors, and
 * `send()` and `requestIntro()` throw them in the test.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */

/** Where the harness pretends the app runs. The request carries it as its Origin, as a browser's would. */
export const HARNESS_ORIGIN = "http://localhost:3000";

export type RouteHarness = {
  /** The `fetch` to give `postAi()`. */
  fetch: FetchFn;
  /** The route's dependencies, used as they are at each request. */
  deps: AiRouteDeps;
  /** Puts `ai` behind the route from the next request on. */
  setAi: (ai: AiCall) => void;
  /** Every request body, as the text the browser sent. */
  bodies: string[];
  /** Every response: its status and its JSON. */
  responses: { status: number; json: unknown }[];
  /** Errors the AI call threw (the strict fake's "no scripted reply"), taken once. */
  takeAiErrors: () => unknown[];
};

export function createRouteHarness(ai: AiCall, overrides: Partial<Omit<AiRouteDeps, "callAi">> = {}): RouteHarness {
  let current = ai;
  const aiErrors: unknown[] = [];
  const bodies: string[] = [];
  const responses: RouteHarness["responses"] = [];

  const deps: AiRouteDeps = {
    getAdmin: async () => ({ userId: "admin-1" }),
    aiEnabled: () => true,
    rateLimit: () => false,
    ...overrides,
    callAi: async (input) => {
      try {
        return await current(input);
      } catch (error) {
        aiErrors.push(error);
        throw error;
      }
    },
  };

  const fetch: FetchFn = async (url, init) => {
    bodies.push(String(init.body));
    const headers = new Headers(init.headers);
    headers.set("Origin", HARNESS_ORIGIN);
    const response = await handleAiRequest(new Request(new URL(url, HARNESS_ORIGIN), { ...init, headers }), deps);
    responses.push({ status: response.status, json: await response.clone().json() });
    return response;
  };

  return {
    fetch,
    deps,
    setAi: (next) => {
      current = next;
    },
    bodies,
    responses,
    takeAiErrors: () => aiErrors.splice(0),
  };
}

/** Throws the first error the fake AI threw during the last request, if any. */
function throwAiErrors(harness: RouteHarness) {
  const [error] = harness.takeAiErrors();
  if (error !== undefined) throw error;
}

export type ChatDriver = {
  /** The chat state now, as the panel would render it. */
  readonly state: ChatState;
  /** Types `text` in the box and presses Send. */
  send: (text: string) => Promise<ChatState>;
  /** Presses Try again: sends what the failure put back in the box. */
  tryAgain: () => Promise<ChatState>;
};

/**
 * A chat panel on the Criteria step (`criteria`, `base` the pending brief) or the Results step
 * (`revise`, `base` the confirmed brief), sending through `harness`. `summary` is a fixed summary,
 * or, as the hook does it, a function that builds one for the brief being sent
 * (`(brief) => buildFileSummary(records, layout, brief)`, fix B).
 */
export function createChatDriver(
  harness: RouteHarness,
  summary: FileSummary | ((currentBrief: SearchBrief | undefined) => FileSummary),
  { mode = "criteria", base = null }: { mode?: ChatMode; base?: SearchBrief | null } = {},
): ChatDriver {
  let state = initialChatState(mode === "revise" ? REVISE_TEXT.opening : undefined);
  let lastNote: string | null = null;

  async function sendDraft(): Promise<ChatState> {
    const sending = chatReducer(state, { type: "send", text: state.draft });
    if (sending === state) throw new Error("The chat can't send this message (canSend is false).");
    state = sending;
    const currentBrief = currentBriefFor(sending, base, mode);
    const summaryNow = typeof summary === "function" ? summary(currentBrief) : summary;
    const note = withheldNote(currentBrief, summaryNow);
    if (note !== null && note !== lastNote) state = chatReducer(state, { type: "add-note", content: note });
    lastNote = note;
    const result = await postAi(harness.fetch, buildChatRequest(sending, summaryNow, currentBrief), new AbortController().signal);
    throwAiErrors(harness);
    if (result.kind === "aborted") throw new Error("The request was aborted.");
    const outcome = interpretAiResult(result);
    state = chatReducer(state, {
      ...(mode === "revise" ? settleRevision(outcome, currentBrief) : outcome),
      requestId: sending.requestId,
    });
    return state;
  }

  return {
    get state() {
      return state;
    },
    send: (text) => {
      state = chatReducer(state, { type: "edit", text });
      return sendDraft();
    },
    tryAgain: sendDraft,
  };
}

/** Write draft in the intro panel: the request body, the route, and what the panel gets back. */
export async function requestIntro(
  harness: RouteHarness,
  intro: IntroFields,
  intent: BriefIntent,
  goal = "",
): Promise<IntroOutcome> {
  const result = await postAi(harness.fetch, buildIntroRequest(intro, intent, goal), new AbortController().signal);
  throwAiErrors(harness);
  if (result.kind === "aborted") throw new Error("The request was aborted.");
  return interpretIntroResult(result);
}
