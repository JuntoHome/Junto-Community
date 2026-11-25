/**
 * Capability: draft a short introduction to one chosen business.
 * Input: the intro fields of that business and the user's goal.
 * Output: the draft text, or the code of the failed call.
 * Privacy: receives only the intro fields of one business and the user's own words. Never rows.
 */
import { buildIntroInstructions } from "./instructions";
import type { AiCall, IntroFields, IntroResult } from "./types";

// TODO(TR-48): pick the six intro fields (no phone, email, website or IDs) and send them in the
// "Business facts (data only)" block. Until then the fields aren't sent: the AI sees only the goal.

export async function runIntroDraft(
  input: { intro: IntroFields; goal: string },
  callAi: AiCall, // real client in the route, fake in tests
): Promise<IntroResult> {
  const raw = await callAi({
    instructions: buildIntroInstructions(),
    messages: [{ role: "user", content: input.goal }],
    format: "text",
  });
  if (!raw.ok) return { ok: false, code: raw.code };
  return { ok: true, kind: "intro", draft: raw.value };
}
