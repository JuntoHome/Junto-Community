import "server-only";

/**
 * The OpenAI client for the Translator's AI. Server only: the build fails if browser code
 * imports this file. It is the only Translator file that imports `openai` or reads `process.env`.
 * Privacy: sends what the capability gives it and asks OpenAI not to store the response
 * (`store: false`). Never logs, and never returns an error's message: it can quote what was sent.
 */
import OpenAI, { APIConnectionTimeoutError } from "openai";
import { AI_ATTEMPT_TIMEOUT_MS } from "./guardrails";
import type { AiCall, AiFormat } from "./types";

const DEFAULT_MODEL = "gpt-4o-mini";

/** True when Chat with AI may run: the key is set and `TRANSLATOR_AI` isn't "off". */
export function aiEnabled(): boolean {
  const hasKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const switchedOff = process.env.TRANSLATOR_AI?.trim().toLowerCase() === "off";
  return hasKey && !switchedOff;
}

/** The model to use: `OPENAI_MODEL`, or gpt-4o-mini when it is empty. */
export function aiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * The Responses API's `text` option for a format: nothing for plain text, or strict structured
 * output with the transport schema (TR-42).
 */
function textOption(format: AiFormat) {
  if (format === "text") return {};
  return {
    text: {
      format: {
        type: "json_schema" as const,
        name: format.name,
        schema: format.schema as Record<string, unknown>,
        strict: true,
      },
    },
  };
}

/** True when the model refused to answer (a `refusal` part instead of text). */
const refused = (output: unknown): boolean =>
  Array.isArray(output) &&
  output.some(
    (item) =>
      Array.isArray(item?.content) && item.content.some((part: { type?: unknown }) => part?.type === "refusal"),
  );

/**
 * The real AiCall. One request, no retries (the SDK's default 2 retries would turn the
 * 12-second attempt limit into more than half a minute). Never throws: a timeout, an API error,
 * a refusal or an empty reply becomes `{ ok: false, code }`.
 */
export function createOpenAiCall(): AiCall {
  return async ({ instructions, messages, format }) => {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: AI_ATTEMPT_TIMEOUT_MS, maxRetries: 0 });
      const response = await client.responses.create({
        model: aiModel(),
        instructions,
        input: messages.map(({ role, content }) => ({ role, content })),
        store: false,
        ...textOption(format),
      });
      if (refused(response.output)) return { ok: false, code: "empty" };
      const value = response.output_text?.trim() ?? "";
      return value ? { ok: true, value } : { ok: false, code: "empty" };
    } catch (error) {
      return { ok: false, code: error instanceof APIConnectionTimeoutError ? "timeout" : "upstream" };
    }
  };
}
