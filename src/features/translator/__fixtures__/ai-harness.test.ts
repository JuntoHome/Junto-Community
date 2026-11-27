import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { EXAMPLE_SUMMARY } from "./summary";
import { createChatDriver, createRouteHarness } from "./ai-harness";
import { createScriptedAi, loadAiScript } from "./fake-ai";

/**
 * The browser-and-route harness itself (TR-54): a request really goes through the route's
 * checks, and the strict fake's "no scripted reply" still fails the test instead of turning
 * into the route's ordinary 502.
 */

let consoleError: MockInstance<typeof console.error>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  consoleError.mockRestore();
});

describe("createRouteHarness", () => {
  it("throws the fake's error for a message no script line matches", async () => {
    const chat = createChatDriver(createRouteHarness(createScriptedAi(loadAiScript("ambiguous"))), EXAMPLE_SUMMARY);
    await expect(chat.send("Something nobody scripted")).rejects.toThrow('fake-ai: no scripted reply for "Something nobody scripted"');
  });

  it("sends each request through the route's checks: a summary the strict schema refuses gets a 400 and no AI call", async () => {
    const ai = createScriptedAi(loadAiScript("ambiguous"));
    const harness = createRouteHarness(ai);
    const chat = createChatDriver(harness, { ...EXAMPLE_SUMMARY, companies: ["Test Company 01"] } as typeof EXAMPLE_SUMMARY);
    await chat.send("Phoenix area");
    expect(harness.responses.map((response) => response.status)).toEqual([400]);
    expect(ai.calls).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith("translator_ai_bad_request");
  });
});
