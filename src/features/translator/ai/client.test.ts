import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A stand-in for the OpenAI SDK: tests never reach OpenAI.
const sdk = vi.hoisted(() => {
  class APIConnectionTimeoutError extends Error {}
  const create = vi.fn();
  const options: unknown[] = [];
  class OpenAI {
    responses = { create };
    constructor(opts: unknown) {
      options.push(opts);
    }
  }
  return { APIConnectionTimeoutError, OpenAI, create, options };
});

vi.mock("openai", () => ({
  default: sdk.OpenAI,
  OpenAI: sdk.OpenAI,
  APIConnectionTimeoutError: sdk.APIConnectionTimeoutError,
}));

import { aiEnabled, aiFailureSimulationAllowed, aiModel, createOpenAiCall } from "./client";

const CALL = { instructions: "Reply briefly.", messages: [{ role: "user" as const, content: "Hello" }], format: "text" as const };

beforeEach(() => {
  sdk.create.mockReset();
  sdk.options.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aiEnabled", () => {
  it.each([
    [undefined, undefined, false],
    ["", undefined, false],
    ["   ", undefined, false],
    [undefined, "on", false],
    ["sk-test", undefined, true],
    ["sk-test", "", true],
    ["sk-test", "on", true],
    ["sk-test", "off", false],
    ["sk-test", " OFF ", false],
    ["", "off", false],
  ])("key %j, TRANSLATOR_AI %j: %s", (key, flag, expected) => {
    vi.stubEnv("OPENAI_API_KEY", key);
    vi.stubEnv("TRANSLATOR_AI", flag);
    expect(aiEnabled()).toBe(expected);
  });
});

describe("aiFailureSimulationAllowed (TR-50)", () => {
  it.each([
    ["production", "production", false],
    ["production", "development", false],
    ["preview", "production", true],
    ["development", "production", true],
    [undefined, "development", true],
    [undefined, "test", true],
    [undefined, "production", false],
    ["something-else", "development", false],
  ])("VERCEL_ENV %s with NODE_ENV %s gives %s", (vercelEnv, nodeEnv, expected) => {
    vi.stubEnv("VERCEL_ENV", vercelEnv);
    vi.stubEnv("NODE_ENV", nodeEnv);
    expect(aiFailureSimulationAllowed()).toBe(expected);
  });
});

describe("aiModel", () => {
  it("uses OPENAI_MODEL, or gpt-4o-mini when it is empty", () => {
    vi.stubEnv("OPENAI_MODEL", undefined);
    expect(aiModel()).toBe("gpt-4o-mini");
    vi.stubEnv("OPENAI_MODEL", " ");
    expect(aiModel()).toBe("gpt-4o-mini");
    vi.stubEnv("OPENAI_MODEL", "gpt-test");
    expect(aiModel()).toBe("gpt-test");
  });
});

describe("createOpenAiCall", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "gpt-test");
  });

  it("sends one request with a 12-second timeout, no retries and store: false", async () => {
    sdk.create.mockResolvedValue({ output_text: "  Hi there.  " });
    await expect(createOpenAiCall()(CALL)).resolves.toEqual({ ok: true, value: "Hi there." });
    expect(sdk.options).toEqual([{ apiKey: "sk-test", timeout: 12_000, maxRetries: 0 }]);
    expect(sdk.create).toHaveBeenCalledWith({
      model: "gpt-test",
      instructions: "Reply briefly.",
      input: [{ role: "user", content: "Hello" }],
      store: false,
    });
  });

  it("asks for strict structured output with the given schema", async () => {
    sdk.create.mockResolvedValue({ output_text: '{"message":"Hi","proposal":null}' });
    const schema = { type: "object", properties: {}, required: [], additionalProperties: false };
    const result = await createOpenAiCall()({ ...CALL, format: { name: "interview_reply", schema } });
    expect(result).toEqual({ ok: true, value: '{"message":"Hi","proposal":null}' });
    expect(sdk.create).toHaveBeenCalledWith({
      model: "gpt-test",
      instructions: "Reply briefly.",
      input: [{ role: "user", content: "Hello" }],
      store: false,
      text: { format: { type: "json_schema", name: "interview_reply", schema, strict: true } },
    });
  });

  it("maps a refusal to empty", async () => {
    sdk.create.mockResolvedValue({
      output_text: "",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "I can't help with that." }] }],
    });
    await expect(createOpenAiCall()({ ...CALL, format: { name: "interview_reply", schema: {} } })).resolves.toEqual({
      ok: false,
      code: "empty",
    });
  });

  it("maps an SDK timeout to timeout", async () => {
    sdk.create.mockRejectedValue(new sdk.APIConnectionTimeoutError("Request timed out."));
    await expect(createOpenAiCall()(CALL)).resolves.toEqual({ ok: false, code: "timeout" });
  });

  it("maps any other error to upstream, without its message", async () => {
    sdk.create.mockRejectedValue(new Error("429 Rate limit reached. Your prompt was: Hello"));
    const result = await createOpenAiCall()(CALL);
    expect(result).toEqual({ ok: false, code: "upstream" });
    expect(JSON.stringify(result)).not.toContain("Hello");
  });

  it("maps an empty reply to empty", async () => {
    sdk.create.mockResolvedValue({ output_text: "   " });
    await expect(createOpenAiCall()(CALL)).resolves.toEqual({ ok: false, code: "empty" });
    sdk.create.mockResolvedValue({});
    await expect(createOpenAiCall()(CALL)).resolves.toEqual({ ok: false, code: "empty" });
  });

  it("never logs", async () => {
    const spies = (["log", "info", "warn", "error"] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
    sdk.create.mockRejectedValue(new Error("boom"));
    await createOpenAiCall()(CALL);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
