/**
 * Capability: run one interview turn.
 * Input: the file summary, the chat so far, the current brief (if any).
 * Output: the message to show + a SearchBrief proposal or null, or the code of the failed call.
 * Privacy: receives only FileSummary and chat text. Never rows.
 */
import type { AiCall, ChatMessage, FileSummary, InterviewResult } from "./types";
import type { SearchBrief } from "../criteria/schema";

// TODO(TR-41, TR-42): real instructions built from the summary and the current brief, and a
// validated SearchBrief proposal. Until then the AI only chats and never proposes a brief.
const INTERVIEW_TEXT = {
  instructions: "You are a helpful assistant for a library business-contacts tool. Reply briefly.",
} as const;

export async function runInterviewTurn(
  input: { summary: FileSummary; messages: ChatMessage[]; currentBrief?: SearchBrief },
  callAi: AiCall, // real client in the route, fake in tests
): Promise<InterviewResult> {
  const raw = await callAi({ instructions: INTERVIEW_TEXT.instructions, messages: input.messages, format: "text" });
  if (!raw.ok) return { ok: false, code: raw.code };
  return { ok: true, kind: "interview", reply: raw.value, proposal: null };
}
