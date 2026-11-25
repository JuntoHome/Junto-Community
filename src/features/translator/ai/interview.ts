/**
 * Capability: run one interview turn.
 * Input: the file summary, the chat so far, the current brief (if any).
 * Output: the message to show + a validated SearchBrief proposal or null + a note when a proposal
 * was dropped; or the code of what failed (a failed call, or "unusable").
 * Privacy: receives only FileSummary and chat text. Never rows. Never logs: the route logs the code.
 *
 * The AI answers in structured output (`interviewReplyJsonSchema`, schema.ts), and every reply goes
 * through `parseInterviewReply()` (validate.ts). Each attempt may take AI_ATTEMPT_TIMEOUT_MS (12 s).
 * One retry, only when the reply isn't in the format ("shape"): never after a timeout or a failed
 * call, and never when a valid reply's proposal was dropped (that reply has a note to show).
 */
import { AI_ATTEMPT_TIMEOUT_MS, withTimeout } from "./guardrails";
import { buildInterviewInstructions } from "./instructions";
import { INTERVIEW_REPLY_FORMAT_NAME, interviewReplyJsonSchema } from "./schema";
import { parseInterviewReply } from "./validate";
import type { AiCall, AiCallResult, AiFormat, ChatMessage, FileSummary, InterviewResult } from "./types";
import type { SearchBrief } from "../criteria/schema";

export const INTERVIEW_TEXT = {
  /** Added as the last user turn of the one retry. Nothing else is added. */
  retry: "Your last reply didn't match the required format. Reply again using the format.",
} as const;

const FORMAT: AiFormat = { name: INTERVIEW_REPLY_FORMAT_NAME, schema: interviewReplyJsonSchema };

const TIMED_OUT: AiCallResult = { ok: false, code: "timeout" };

export async function runInterviewTurn(
  input: { summary: FileSummary; messages: ChatMessage[]; currentBrief?: SearchBrief },
  callAi: AiCall, // real client in the route, fake in tests
): Promise<InterviewResult> {
  const instructions = buildInterviewInstructions(input.summary, input.currentBrief);
  const attempt = (messages: ChatMessage[]) =>
    withTimeout(callAi({ instructions, messages, format: FORMAT }), AI_ATTEMPT_TIMEOUT_MS, () => TIMED_OUT);

  let raw = await attempt(input.messages);
  if (!raw.ok) return { ok: false, code: raw.code };
  let parsed = parseInterviewReply(raw.value, input.summary);

  if (!parsed.ok) {
    raw = await attempt([...input.messages, { role: "user", content: INTERVIEW_TEXT.retry }]);
    if (!raw.ok) return { ok: false, code: raw.code };
    parsed = parseInterviewReply(raw.value, input.summary);
    if (!parsed.ok) return { ok: false, code: "unusable" };
  }

  return { ok: true, kind: "interview", reply: parsed.reply.message, proposal: parsed.reply.proposal, note: parsed.note };
}
