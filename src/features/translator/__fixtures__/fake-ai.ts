import { vi } from "vitest";
import type { AiCall, AiCallResult, AiErrorCode } from "../ai/types";

/**
 * A scripted stand-in for the OpenAI call (TR-51), so no test ever reaches OpenAI. TR-53 extends it.
 *
 * Each step of the script is one AI call's result, played back in order:
 * - a string: the AI answers with that text (the intro's plain text, or interview JSON already as text);
 * - any other value (an object): the AI answers with it as JSON (an interview reply);
 * - `fail("timeout" | "upstream" | "empty")`: the call fails with that code;
 * - an `AiCallResult` (`{ ok, value }` or `{ ok: false, code }`): used as it is.
 *
 * It is a `vi.fn`, so `toHaveBeenCalledTimes()` and `toHaveBeenCalledWith()` work, and `calls`
 * holds every call's `instructions`, `messages` and `format` for assertions. Running past the end
 * of the script throws, so a test that makes an unexpected extra call fails loudly.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */
export type FakeAiStep = string | AiCallResult | FailStep | object;

type FailStep = { __fakeAiFailure: AiErrorCode };

/** A step that makes the call fail with `code`. */
export const fail = (code: AiErrorCode): FailStep => ({ __fakeAiFailure: code });

const isFailStep = (step: FakeAiStep): step is FailStep => typeof step === "object" && step !== null && "__fakeAiFailure" in step;

const isCallResult = (step: FakeAiStep): step is AiCallResult =>
  typeof step === "object" && step !== null && "ok" in step && (("value" in step && typeof step.value === "string") || "code" in step);

function toResult(step: FakeAiStep): AiCallResult {
  if (typeof step === "string") return { ok: true, value: step };
  if (isFailStep(step)) return { ok: false, code: step.__fakeAiFailure };
  if (isCallResult(step)) return step;
  return { ok: true, value: JSON.stringify(step) };
}

export type FakeAi = ReturnType<typeof vi.fn<AiCall>> & { calls: Parameters<AiCall>[0][] };

export function createFakeAi(script: readonly FakeAiStep[]): FakeAi {
  const steps = [...script];
  const calls: Parameters<AiCall>[0][] = [];
  const fn = vi.fn<AiCall>(async (input) => {
    calls.push(input);
    const step = steps.shift();
    if (step === undefined) throw new Error(`fake AI: no scripted reply left for call ${calls.length}`);
    return toResult(step);
  });
  return Object.assign(fn, { calls });
}
