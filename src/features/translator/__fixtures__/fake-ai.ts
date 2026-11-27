import { readFileSync } from "node:fs";
import { vi } from "vitest";
import { z } from "zod";
import { interviewReplySchema, type InterviewReply } from "../ai/schema";
import type { AiCall, AiCallResult, AiErrorCode } from "../ai/types";

/**
 * Scripted stand-ins for the OpenAI call, so no test ever reaches OpenAI. Two modes:
 *
 * - `createFakeAi(steps)` (TR-51): plays back one result per call, in order.
 * - `createScriptedAi(script)` (TR-53): answers by what the user said last, from a script that
 *   usually lives in `walkthroughs/ai-*.json` (`loadAiScript(name)`).
 *
 * Both return a `vi.fn`, so `toHaveBeenCalledTimes()` and `toHaveBeenCalledWith()` work, and
 * `calls` holds every call's `instructions`, `messages` and `format` for assertions (TR-54's
 * privacy checks read it). Both are strict: an unexpected call throws, so a test can't pass by
 * accident on the wrong reply.
 *
 * Test-only. App code must never import anything from __fixtures__.
 */

/** What every fake records about each call it gets. */
export type FakeAiCall = Parameters<AiCall>[0];

export type FakeAi = ReturnType<typeof vi.fn<AiCall>> & { calls: FakeAiCall[] };

/** A `vi.fn` AI call that records each call, then answers with `answer(input)`. */
function recordingFake(answer: (input: FakeAiCall) => AiCallResult): FakeAi {
  const calls: FakeAiCall[] = [];
  const fn = vi.fn<AiCall>(async (input) => {
    calls.push(input);
    return answer(input);
  });
  return Object.assign(fn, { calls });
}

// ---------------------------------------------------------------------------------------------
// Ordered mode (TR-51)
// ---------------------------------------------------------------------------------------------

/**
 * One step of an ordered script, one AI call's result:
 * - a string: the AI answers with that text (the intro's plain text, or interview JSON already as text);
 * - any other value (an object): the AI answers with it as JSON (an interview reply);
 * - `fail("timeout" | "upstream" | "empty")`: the call fails with that code;
 * - an `AiCallResult` (`{ ok, value }` or `{ ok: false, code }`): used as it is.
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

/** Plays back `script` in order, one step per call. Running past the end throws. */
export function createFakeAi(script: readonly FakeAiStep[]): FakeAi {
  const steps = [...script];
  let count = 0;
  return recordingFake(() => {
    count += 1;
    const step = steps.shift();
    if (step === undefined) throw new Error(`fake AI: no scripted reply left for call ${count}`);
    return toResult(step);
  });
}

// ---------------------------------------------------------------------------------------------
// Scripted mode (TR-53)
// ---------------------------------------------------------------------------------------------

/**
 * What the scripted AI answers:
 * - an `InterviewReply` (`{ message, proposal }`, the app's shape): sent as the real client
 *   would send it, JSON text in the transport format (TR-42), with `priorityOrder: null` when the
 *   proposal has none, so the reply goes through `fromTransport()` and `parseInterviewReply()`
 *   exactly as in production;
 * - `{ draft }`: the intro's plain text;
 * - `"invalid"`: text that isn't JSON, a reply in the wrong format;
 * - `"timeout"`: the call fails with `{ ok: false, code: "timeout" }`.
 */
export type ScriptedReply = InterviewReply | { draft: string } | "timeout" | "invalid";

/** One script line: when the last user message matches `whenUserSays`, answer with `reply`. */
export type ScriptStep = { whenUserSays: RegExp; reply: ScriptedReply };

/** The text `"invalid"` answers with. Not JSON, so the reply check refuses its shape. */
export const INVALID_REPLY_TEXT = "Sure! Here is your list of businesses.";

/** The interview reply as OpenAI's structured output gives it: every key there, `null` for "not given". */
function toTransport(reply: InterviewReply): string {
  const { proposal } = reply;
  return JSON.stringify({
    message: reply.message,
    proposal: proposal === null ? null : { ...proposal, priorityOrder: proposal.priorityOrder ?? null },
  });
}

function scriptedResult(reply: ScriptedReply): AiCallResult {
  if (reply === "timeout") return { ok: false, code: "timeout" };
  if (reply === "invalid") return { ok: true, value: INVALID_REPLY_TEXT };
  if ("draft" in reply) return { ok: true, value: reply.draft };
  return { ok: true, value: toTransport(reply) };
}

/**
 * An AI call that answers by the **last user message** of each call: the first script line whose
 * pattern matches it gives the reply. Lines can match more than once. No match throws
 * `fake-ai: no scripted reply for "<message>"`, so a conversation can't drift onto a reply it
 * wasn't written for.
 */
export function createScriptedAi(script: readonly ScriptStep[]): FakeAi {
  return recordingFake(({ messages }) => {
    const said = messages.findLast((message) => message.role === "user")?.content ?? "";
    const step = script.find(({ whenUserSays }) => whenUserSays.test(said));
    if (!step) throw new Error(`fake-ai: no scripted reply for "${said}"`);
    return scriptedResult(step.reply);
  });
}

/** The brief keys OpenAI's structured output always sends (the transport schema, TR-42). `priorityOrder` is added as null. */
const TRANSPORT_BRIEF_KEYS = ["intent", "mustHaves", "preferences", "exclusions", "listSize", "assumptions"] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A scripted interview reply: an `InterviewReply` whose proposal (when there is one) writes out
 * every transport key. `searchBriefSchema` has defaults (`listSize` 40, empty lists), so without
 * this a script that left out `listSize` would quietly send 40, which the real AI never does.
 */
const scriptedInterviewReply = z
  .unknown()
  .refine(
    (raw) =>
      !isPlainObject(raw) ||
      !isPlainObject(raw.proposal) ||
      TRANSPORT_BRIEF_KEYS.every((key) => key in (raw.proposal as Record<string, unknown>)),
    `A scripted proposal must give every one of ${TRANSPORT_BRIEF_KEYS.join(", ")}.`,
  )
  .pipe(interviewReplySchema);

/**
 * A script file, `walkthroughs/ai-<name>.json`: a description for the reader and the steps.
 * JSON can't hold a RegExp, so a pattern is `{ "pattern": "...", "flags": "i" }`. The `g` and `y`
 * flags are refused: they make `RegExp.test()` remember where it stopped, so the same message
 * could match once and then not. An interview reply must pass `interviewReplySchema`, with every
 * brief key written out (`scriptedInterviewReply`).
 */
const aiScriptFileSchema = z.strictObject({
  description: z.string().min(1),
  steps: z
    .array(
      z.strictObject({
        whenUserSays: z.strictObject({
          pattern: z.string().min(1),
          flags: z.string().regex(/^[imsu]*$/, "Use only the i, m, s and u flags.").default(""),
        }),
        reply: z.union([
          scriptedInterviewReply,
          z.strictObject({ draft: z.string().min(1) }),
          z.literal("timeout"),
          z.literal("invalid"),
        ]),
      }),
    )
    .min(1),
});

/** Checks a parsed script file and turns its patterns into RegExps. Throws on a malformed file. */
export function parseAiScript(raw: unknown): ScriptStep[] {
  const file = aiScriptFileSchema.parse(raw);
  return file.steps.map(({ whenUserSays, reply }) => ({
    whenUserSays: new RegExp(whenUserSays.pattern, whenUserSays.flags),
    reply,
  }));
}

/** Reads `walkthroughs/ai-<name>.json` and checks it (`parseAiScript()`). */
export function loadAiScript(name: string): ScriptStep[] {
  if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`fake-ai: bad script name "${name}"`);
  const text = readFileSync(new URL(`./walkthroughs/ai-${name}.json`, import.meta.url), "utf8");
  return parseAiScript(JSON.parse(text));
}
