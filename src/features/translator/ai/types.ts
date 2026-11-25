/**
 * Shared types for the Translator's Phase 2 AI (Chat with AI).
 *
 * The browser sends an AiRequest to `/api/translator/ai` and gets an AiResponse back.
 * The route checks the request with `aiRequestSchema` (request-schema.ts), which is typed
 * against AiRequest, so the two can't drift apart.
 * Privacy: an AiRequest holds only the file summary and the chat (interview), or the intro
 * fields of one chosen business and the user's goal (intro). Never rows.
 * This module is pure (types only).
 */
import type { SearchBrief } from "../criteria/schema";
import type { FileSummary } from "./summary";

/**
 * What the AI may know about the file. Defined once, in summary.ts (inferred from
 * `fileSummarySchema`), and re-exported here so the shared types stay in one place.
 */
export type { FileSummary, SummaryValue } from "./summary";

/** One chat turn. There is no "system" role: the instructions are set on the server only. */
export type ChatMessage = { role: "user" | "assistant"; content: string };

/**
 * The fields of one chosen business for the intro draft. Loose for now: TR-48 tightens it to
 * company name, industry, city, state, contact name and contact title.
 */
export type IntroFields = Record<string, unknown>;

/** What the browser sends to the route. */
export type AiRequest =
  | { kind: "interview"; summary: FileSummary; messages: ChatMessage[]; currentBrief?: SearchBrief }
  | { kind: "intro"; intro: IntroFields; goal: string };

/**
 * What the route sends back. `error` is a plain-language message for the user.
 * Interview: `proposal` has passed `parseInterviewReply()` (validate.ts), or is null. `note` says
 * why a proposal was dropped (TR-42), or is null.
 */
export type AiResponse =
  | { ok: true; kind: "interview"; reply: string; proposal: SearchBrief | null; note: string | null }
  | { ok: true; kind: "intro"; draft: string }
  | { ok: false; error: string };

/** Why an AI call failed. A fixed code, never the error's message (it can quote what was sent). */
export type AiErrorCode = "timeout" | "upstream" | "empty";

/** The result of one AI call: the reply's text, or why there is none. */
export type AiCallResult = { ok: true; value: string } | { ok: false; code: AiErrorCode };

/**
 * The reply format: plain text, or structured output with a JSON Schema (TR-42). The schema is
 * the transport schema from schema.ts, never the app's check.
 */
export type AiFormat = "text" | { name: "interview_reply"; schema: object };

/**
 * One call to the AI. The route passes the real OpenAI call (client.ts); tests pass a fake.
 * It never throws.
 */
export type AiCall = (input: { instructions: string; messages: ChatMessage[]; format: AiFormat }) => Promise<AiCallResult>;

/**
 * Why an interview turn failed: a failed call, or "unusable" when the AI's reply didn't match
 * the format twice in a row (TR-42).
 */
export type InterviewErrorCode = AiErrorCode | "unusable";

/** The result of a capability: its part of the AiResponse, or the code of the call that failed. */
export type InterviewResult = Extract<AiResponse, { kind: "interview" }> | { ok: false; code: InterviewErrorCode };
export type IntroResult = Extract<AiResponse, { kind: "intro" }> | { ok: false; code: AiErrorCode };
