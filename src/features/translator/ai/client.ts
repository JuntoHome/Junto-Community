import "server-only";

/**
 * The OpenAI client for the Translator's AI. Server only: the build fails if browser code
 * imports this file. It is the only Translator file that imports `openai` or reads `process.env`.
 * Privacy: sends what the capability gives it and asks OpenAI not to store the response
 * (`store: false`). Never logs, and never returns an error's message: it can quote what was sent.
 */
import OpenAI, { APIConnectionTimeoutError } from "openai";
import { AI_TIMEOUT_MS } from "./guardrails";
import type { AiCall } from "./types";

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
 * The real AiCall. One request, no retries (the SDK's default 2 retries would turn the
 * 20-second limit into a minute). Never throws: a timeout, an API error or an empty reply
 * becomes `{ ok: false, code }`.
 */
export function createOpenAiCall(): AiCall {
  return async ({ instructions, messages }) => {
    try {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: AI_TIMEOUT_MS, maxRetries: 0 });
      const response = await client.responses.create({
        model: aiModel(),
        instructions,
        input: messages.map(({ role, content }) => ({ role, content })),
        store: false,
      });
      const value = response.output_text?.trim() ?? "";
      return value ? { ok: true, value } : { ok: false, code: "empty" };
    } catch (error) {
      return { ok: false, code: error instanceof APIConnectionTimeoutError ? "timeout" : "upstream" };
    }
  };
}
