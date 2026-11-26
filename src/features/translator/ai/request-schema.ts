/**
 * Capability: read the body the browser sent to `/api/translator/ai`.
 * Input: the parsed JSON (unknown).
 * Output: a checked AiRequest, or why it was refused: unreadable, or over a size limit.
 * Privacy: checks shape and size only. It never logs or keeps what it reads.
 * This module is pure (zod only, no React, no I/O).
 */
import { z } from "zod";
import { BRIEF_INTENTS, searchBriefSchema } from "../criteria/schema";
import { introFieldsSchema, MAX_INTRO_NOTE_CHARS } from "./intro";
import { fileSummarySchema } from "./summary";
import type { AiRequest, ChatMessage } from "./types";

/** Most chat turns one request may carry. A longer chat starts over. */
export const MAX_MESSAGES = 30;
/** Longest message the user may type, in characters. */
export const MAX_USER_MESSAGE_CHARS = 1000;
/** Longest assistant turn the browser may send back, in characters. */
export const MAX_ASSISTANT_MESSAGE_CHARS = 4000;
/** Largest request body, in bytes (100 KB). */
export const MAX_BODY_BYTES = 100 * 1024;

/** Text with something in it besides spaces. */
const text = z.string().trim().min(1);

const chatMessageSchema = z.strictObject({
  // Only these two: a "system" turn could replace the server's instructions.
  role: z.enum(["user", "assistant"]),
  content: text,
});

const interviewRequestSchema = z.strictObject({
  kind: z.literal("interview"),
  // Strict (summary.ts): any key that isn't in FileSummary, such as `rows`, is refused.
  summary: fileSummarySchema,
  messages: z.array(chatMessageSchema).min(1),
  currentBrief: searchBriefSchema.optional(),
});

const introRequestSchema = z.strictObject({
  kind: z.literal("intro"),
  // Strict (intro.ts): only the six intro fields. Any other key, such as `phone`, is refused.
  intro: introFieldsSchema,
  intent: z.enum(BRIEF_INTENTS),
  // The user's optional note. Its length is checked in parseAiRequest, so it gets its own message.
  goal: z.string().trim().optional(),
});

/**
 * The request shape, without the size limits (parseAiRequest checks those, so a long chat
 * gets its own message instead of "couldn't be read"). Typed against AiRequest.
 */
export const aiRequestSchema: z.ZodType<AiRequest, unknown> = z.discriminatedUnion("kind", [
  interviewRequestSchema,
  introRequestSchema,
]);

/** Why a request was refused. */
export type AiRequestProblem = "bad-request" | "conversation-too-long" | "message-too-long" | "note-too-long";

export type ParsedAiRequest = { ok: true; request: AiRequest } | { ok: false; problem: AiRequestProblem };

const longestAllowed = (message: ChatMessage) =>
  message.role === "user" ? MAX_USER_MESSAGE_CHARS : MAX_ASSISTANT_MESSAGE_CHARS;

/** Checks a parsed JSON body: shape first, then the message limits. */
export function parseAiRequest(body: unknown): ParsedAiRequest {
  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) return { ok: false, problem: "bad-request" };
  const request = parsed.data;

  if (request.kind === "intro") {
    // The note is typed by the user (TR-48): at most MAX_INTRO_NOTE_CHARS.
    return (request.goal?.length ?? 0) > MAX_INTRO_NOTE_CHARS
      ? { ok: false, problem: "note-too-long" }
      : { ok: true, request };
  }

  if (request.messages.length > MAX_MESSAGES) return { ok: false, problem: "conversation-too-long" };
  // An assistant turn is ours, sent back by the browser. One that long means the chat has run on.
  if (request.messages.some((m) => m.role === "assistant" && m.content.length > longestAllowed(m))) {
    return { ok: false, problem: "conversation-too-long" };
  }
  if (request.messages.some((m) => m.role === "user" && m.content.length > longestAllowed(m))) {
    return { ok: false, problem: "message-too-long" };
  }
  return { ok: true, request };
}
