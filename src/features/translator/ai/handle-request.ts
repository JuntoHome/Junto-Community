/**
 * Capability: handle one request to `/api/translator/ai`, from the admin check to the JSON reply.
 * Input: the request, and its dependencies (admin check, on/off switch, AI call, rate limit),
 * passed in so tests need no module mocks. The route passes the real ones.
 * Output: a JSON Response, `Cache-Control: no-store`. AiResponse on success, `{ ok: false, error }` otherwise.
 * Privacy: keeps nothing between calls and never logs content: not the request, not the AI's
 * reply, not a note. The only log is `translator_ai_<code>` with a fixed code.
 */
import { AI_REQUEST_TIMEOUT_MS, withTimeout } from "./guardrails";
import { runInterviewTurn } from "./interview";
import { INTRO_TEXT, runIntroDraft } from "./intro";
import { MAX_BODY_BYTES, parseAiRequest, type AiRequestProblem } from "./request-schema";
import type { AiCall, AiResponse, InterviewErrorCode, InterviewResult, IntroErrorCode, IntroResult } from "./types";

/** Requests one admin may make per rate-limit window (10 minutes, `src/lib/rate-limit.ts`). */
export const AI_REQUESTS_PER_WINDOW = 30;

const ROUTE_TEXT = {
  signedOut: "Please log in as a JCA admin to use the AI assistant.",
  forbidden: "This request isn't allowed.",
  unavailable: "The AI assistant is not available right now. Use the form instead.",
  badRequest: "The request couldn't be read. Refresh the page and try again.",
  bodyTooLarge: "This request is too large. Start a new chat and try again.",
  conversationTooLong: "This conversation is too long. Start a new chat to keep going.",
  messageTooLong: "Your message is too long. Keep it under 1,000 characters.",
  rateLimited: "You've sent a lot of requests. Wait a few minutes and try again.",
  timeout: "The AI took too long to answer. Try again, or use the form.",
  noAnswer: "The AI couldn't answer right now. Try again, or use the form.",
  unusable: "The AI gave an answer I couldn't use. Your last criteria are kept. Try again or use the form.",
} as const;

export type AiRouteDeps = {
  /** The logged-in admin, or null (logged out, or not on the admins list). */
  getAdmin: () => Promise<{ userId: string } | null>;
  /** Whether Chat with AI is switched on (client.ts). */
  aiEnabled: () => boolean;
  /** The AI call the capabilities use. */
  callAi: AiCall;
  /** True when this admin is over the limit. Counts the request. */
  rateLimit: (userId: string) => boolean;
};

/** Codes that may be logged. Nothing else is ever written to the console. */
type LogCode = InterviewErrorCode | IntroErrorCode | "rate_limited" | "bad_request";

/**
 * Writes `translator_ai_<code>`. One string literal per code, never built from a value, so the
 * static test (`__tests__/no-content-logging.test.ts`, TR-51) can prove nothing else is logged.
 */
function logCode(code: LogCode): void {
  switch (code) {
    case "timeout":
      console.error("translator_ai_timeout");
      return;
    case "upstream":
      console.error("translator_ai_upstream");
      return;
    case "empty":
      console.error("translator_ai_empty");
      return;
    case "unusable":
      console.error("translator_ai_unusable");
      return;
    case "intro_too_long":
      console.error("translator_ai_intro_too_long");
      return;
    case "rate_limited":
      console.error("translator_ai_rate_limited");
      return;
    case "bad_request":
      console.error("translator_ai_bad_request");
      return;
  }
}

const json = (body: AiResponse, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const fail = (error: string, status: number) => json({ ok: false, error }, status);

const PROBLEM_REPLY: Record<AiRequestProblem, [string, number]> = {
  "bad-request": [ROUTE_TEXT.badRequest, 400],
  "conversation-too-long": [ROUTE_TEXT.conversationTooLong, 413],
  "message-too-long": [ROUTE_TEXT.messageTooLong, 413],
  "note-too-long": [INTRO_TEXT.noteTooLong, 413], // the intro note (TR-48)
};

const AI_FAILURE_REPLY: Record<InterviewErrorCode | IntroErrorCode, [string, number]> = {
  timeout: [ROUTE_TEXT.timeout, 504],
  upstream: [ROUTE_TEXT.noAnswer, 502],
  empty: [ROUTE_TEXT.noAnswer, 502],
  unusable: [ROUTE_TEXT.unusable, 502], // the reply didn't match the format twice (TR-42)
  intro_too_long: [INTRO_TEXT.tooLong, 502], // the intro draft was over MAX_INTRO_WORDS (TR-48)
};

/** True when the request carries an Origin header from another site. */
function isCrossOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
  try {
    return new URL(origin).host !== host;
  } catch {
    return true; // "null" or garbage
  }
}

const isJson = (request: Request) =>
  request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() === "application/json";

/** The body as text, or null when it is over `maxBytes`. Stops reading as soon as it is. */
async function readTextWithLimit(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return text + decoder.decode();
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
}

export async function handleAiRequest(request: Request, deps: AiRouteDeps): Promise<Response> {
  const admin = await deps.getAdmin();
  if (!admin) return fail(ROUTE_TEXT.signedOut, 401);
  if (isCrossOrigin(request)) return fail(ROUTE_TEXT.forbidden, 403);
  if (!deps.aiEnabled()) return fail(ROUTE_TEXT.unavailable, 503);

  if (!isJson(request)) {
    logCode("bad_request");
    return fail(ROUTE_TEXT.badRequest, 400);
  }
  if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) return fail(ROUTE_TEXT.bodyTooLarge, 413);

  let body: unknown;
  try {
    const text = await readTextWithLimit(request, MAX_BODY_BYTES);
    if (text === null) return fail(ROUTE_TEXT.bodyTooLarge, 413);
    body = JSON.parse(text);
  } catch {
    logCode("bad_request");
    return fail(ROUTE_TEXT.badRequest, 400);
  }

  const parsed = parseAiRequest(body);
  if (!parsed.ok) {
    if (parsed.problem === "bad-request") logCode("bad_request");
    const [error, status] = PROBLEM_REPLY[parsed.problem];
    return fail(error, status);
  }

  if (deps.rateLimit(admin.userId)) {
    logCode("rate_limited");
    return fail(ROUTE_TEXT.rateLimited, 429);
  }

  const input = parsed.request;
  const run: Promise<InterviewResult | IntroResult> =
    input.kind === "interview" ? runInterviewTurn(input, deps.callAi) : runIntroDraft(input, deps.callAi);
  let result: InterviewResult | IntroResult;
  try {
    // The whole request, retry included. Each attempt has its own 12-second limit in the capability.
    result = await withTimeout(run, AI_REQUEST_TIMEOUT_MS, () => ({ ok: false, code: "timeout" }) as const);
  } catch {
    result = { ok: false, code: "upstream" }; // the AI call should never throw, but if it does
  }

  if (!result.ok) {
    logCode(result.code);
    const [error, status] = AI_FAILURE_REPLY[result.code];
    return fail(error, status);
  }
  return json(result, 200);
}
