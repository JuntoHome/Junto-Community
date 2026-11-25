/**
 * Capability: run one interview turn.
 * Input: the file summary, the chat so far, the current brief (if any).
 * Output: the message to show + a SearchBrief proposal or null, or the code of the failed call.
 * Privacy: receives only FileSummary and chat text. Never rows.
 */
import { buildInterviewInstructions } from "./instructions";
import type { AiCall, ChatMessage, FileSummary, InterviewResult } from "./types";
import type { SearchBrief } from "../criteria/schema";

// TODO(TR-42): the response format and a validated SearchBrief proposal. Until then the reply is
// passed on as text and the AI never proposes a brief.

export async function runInterviewTurn(
  input: { summary: FileSummary; messages: ChatMessage[]; currentBrief?: SearchBrief },
  callAi: AiCall, // real client in the route, fake in tests
): Promise<InterviewResult> {
  const instructions = buildInterviewInstructions(input.summary, input.currentBrief);
  const raw = await callAi({ instructions, messages: input.messages, format: "text" });
  if (!raw.ok) return { ok: false, code: raw.code };
  return { ok: true, kind: "interview", reply: raw.value, proposal: null };
}
