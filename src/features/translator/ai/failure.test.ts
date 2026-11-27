import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { AI_CONVERSATIONS } from "../__fixtures__/ai-conversations";
import { createChatDriver, createRouteHarness, requestIntro, type RouteHarness } from "../__fixtures__/ai-harness";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { createScriptedAi, type FakeAi, loadAiScript } from "../__fixtures__/fake-ai";
import { type LoadedFile, loadFile } from "../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { toBrief } from "../criteria/from-form";
import { briefToFormState } from "../criteria/to-form";
import { aiTurnedOff, fallbackBrief, shouldSwitchToForm } from "./chat-session";
import { failureActions, FALLBACK_TEXT } from "./fallback";
import { INTERVIEW_TEXT } from "./interview";
import { pickIntroFields } from "./intro";
import { buildFileSummary, type FileSummary } from "./summary";

/**
 * Failure tests (TR-54): the Translator keeps working when the AI fails. Each test follows a
 * message the whole way, as the browser and the route run it (`__fixtures__/ai-harness.ts`): the
 * chat state, the request, the real route handler with the scripted fake AI behind it, the
 * response, `postAi()`, `interpretAiResult()` and the chat state again. The AI's failures come
 * from `walkthroughs/ai-failures.json` (`"timeout"`, `"invalid"`); the route's own refusals from
 * its dependencies (logged out: `401`; AI switched off: `503`).
 *
 * What the user sees is the chat state the panel renders: `error` is the message, and
 * `failureActions()` the buttons under it (TR-50). The panel itself has no tests (README, Tests).
 */

let file: LoadedFile;
let summary: FileSummary;
let consoleError: MockInstance<typeof console.error>;

beforeAll(async () => {
  file = await loadFile(toArrayBuffer(readFileSync(SAMPLE_PATH)));
  summary = buildFileSummary(file.records, file.importState.parsed.layout.id);
});

beforeEach(() => {
  // The route logs a code on each failure. Kept quiet here and checked below.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

/** What the route logged: each call's arguments. */
const logged = () => consoleError.mock.calls;

/** The Criteria step's chat after the business owner conversation: its proposal is the last valid brief. */
async function afterBusinessOwner(harness: RouteHarness) {
  const chat = createChatDriver(harness, summary);
  for (const message of AI_CONVERSATIONS.businessOwner.messages) await chat.send(message);
  expect(chat.state.lastValidBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
  return chat;
}

describe("failure: one timeout", () => {
  let harness: RouteHarness;
  let failing: FakeAi;
  beforeEach(() => {
    harness = createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script)));
    failing = createScriptedAi(loadAiScript("failures"));
  });

  it("shows the AI-failure message with Try again and Use the form, and keeps the last valid brief", async () => {
    const chat = await afterBusinessOwner(harness);
    harness.setAi(failing);
    const state = await chat.send("show 30 businesses");

    // The route: a 504 with its timeout text, after one attempt (no retry after a timeout).
    expect(failing.calls).toHaveLength(1);
    expect(harness.responses.at(-1)).toEqual({
      status: 504,
      json: { ok: false, error: "The AI took too long to answer. Try again, or use the form." },
    });
    expect(logged()).toEqual([["translator_ai_timeout"]]);

    // The chat: the message, the buttons, the message back in the box, the brief kept.
    expect(state.status).toBe("error");
    expect(state.error).toBe(FALLBACK_TEXT.aiFailure);
    expect(failureActions(state.failureKind ?? "ai-failure")).toEqual({
      tryAgain: true,
      useForm: true,
      logIn: false,
      startOverChat: false,
    });
    expect(state.draft).toBe("show 30 businesses");
    expect(state.items.map((item) => item.content)).not.toContain("show 30 businesses");
    expect(state.failures).toBe(1);
    expect(shouldSwitchToForm(state)).toBe(false);
    expect(state.lastValidBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
    expect(state.proposal).toStrictEqual(BUSINESS_OWNER_BRIEF);
  });

  it("Try again sends the same message with the last valid brief, and the AI's answer arrives", async () => {
    const chat = await afterBusinessOwner(harness);
    harness.setAi(failing);
    await chat.send("show 30 businesses");

    const back = createScriptedAi(loadAiScript("list-size"));
    harness.setAi(back);
    const state = await chat.tryAgain();

    const resent = JSON.parse(harness.bodies.at(-1) ?? "");
    expect(resent.messages.at(-1)).toEqual({ role: "user", content: "show 30 businesses" });
    expect(resent.currentBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
    expect(back.calls).toHaveLength(1);

    expect(state.status).toBe("idle");
    expect(state.error).toBeNull();
    expect(state.failures).toBe(0);
    expect(state.proposal).toStrictEqual({ ...BUSINESS_OWNER_BRIEF, listSize: 30 });
  });
});

describe("failure: two failures in a row", () => {
  it("open the form filled in with the last valid brief (TR-50)", async () => {
    const harness = createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script)));
    const chat = await afterBusinessOwner(harness);
    harness.setAi(createScriptedAi(loadAiScript("failures")));

    await chat.send("show 30 businesses");
    expect(shouldSwitchToForm(chat.state)).toBe(false);
    const state = await chat.tryAgain();

    expect(state.failures).toBe(2);
    expect(shouldSwitchToForm(state)).toBe(true);
    // The wizard fills the form with fallbackBrief() through briefToFormState(): the form gives
    // back exactly the last valid brief.
    const brief = fallbackBrief(state, null);
    expect(brief).toStrictEqual(BUSINESS_OWNER_BRIEF);
    expect(toBrief(briefToFormState(brief ?? BUSINESS_OWNER_BRIEF), file.options)).toStrictEqual({
      ok: true,
      brief: BUSINESS_OWNER_BRIEF,
    });
    expect(logged()).toEqual([["translator_ai_timeout"], ["translator_ai_timeout"]]);
  });

  it("on the Results step, give the form the confirmed brief, never the unconfirmed proposal", async () => {
    const harness = createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.roleChange.script)));
    const chat = createChatDriver(harness, summary, { mode: "revise", base: BUSINESS_OWNER_BRIEF });
    await chat.send(AI_CONVERSATIONS.roleChange.messages[0]);
    expect(chat.state.proposal?.preferences).toContainEqual({ field: "title", operator: "equals", value: "Operations Manager" });

    harness.setAi(createScriptedAi(loadAiScript("failures")));
    await chat.send("show 30 businesses");
    const state = await chat.tryAgain();

    expect(state.failures).toBe(2);
    expect(fallbackBrief(state, BUSINESS_OWNER_BRIEF, "revise")).toStrictEqual(BUSINESS_OWNER_BRIEF);
  });
});

describe("failure: output in the wrong format twice", () => {
  it("gives { ok: false } with the plain message from the route, after exactly one retry (TR-42)", async () => {
    const harness = createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script)));
    const chat = await afterBusinessOwner(harness);
    const failing = createScriptedAi(loadAiScript("failures"));
    harness.setAi(failing);
    const state = await chat.send("show something odd");

    // One attempt and one retry, the retry adding only the retry line.
    expect(failing.calls).toHaveLength(2);
    expect(failing.calls[1].messages).toEqual([
      ...failing.calls[0].messages,
      { role: "user", content: INTERVIEW_TEXT.retry },
    ]);
    expect(harness.responses.at(-1)).toEqual({
      status: 502,
      json: { ok: false, error: "The AI gave an answer I couldn't use. Your last criteria are kept. Try again or use the form." },
    });
    expect(logged()).toEqual([["translator_ai_unusable"]]);

    // The chat shows the AI-failure message (TR-50 shows one text for every AI failure) and keeps the brief.
    expect(state.error).toBe(FALLBACK_TEXT.aiFailure);
    expect(state.failureKind).toBe("ai-failure");
    expect(state.lastValidBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
  });
});

describe("failure: the route refuses before the AI is called", () => {
  it("401: the login message with Log in again, not counted as an AI failure, and the AI never called", async () => {
    const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
    const harness = createRouteHarness(ai, { getAdmin: async () => null });
    const chat = createChatDriver(harness, summary);
    const state = await chat.send(AI_CONVERSATIONS.businessOwner.messages[0]);

    expect(harness.responses).toEqual([{ status: 401, json: { ok: false, error: "Please log in as a JCA admin to use the AI assistant." } }]);
    expect(ai.calls).toHaveLength(0);
    expect(state.error).toBe(FALLBACK_TEXT.sessionExpired);
    expect(failureActions(state.failureKind ?? "ai-failure")).toEqual({ tryAgain: true, useForm: true, logIn: true, startOverChat: false });
    expect(state.failures).toBe(0);
    expect(aiTurnedOff(state)).toBe(false);
  });

  it("401 after logging out mid-chat: the login message, and Try again works once logged in again", async () => {
    let loggedIn = true;
    const harness = createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script)), {
      getAdmin: async () => (loggedIn ? { userId: "admin-1" } : null),
    });
    const chat = createChatDriver(harness, summary);
    const [first, second, third] = AI_CONVERSATIONS.businessOwner.messages;
    await chat.send(first);
    loggedIn = false;
    expect((await chat.send(second)).error).toBe(FALLBACK_TEXT.sessionExpired);
    loggedIn = true;
    expect((await chat.tryAgain()).error).toBeNull();
    expect((await chat.send(third)).proposal).toStrictEqual(BUSINESS_OWNER_BRIEF);
  });

  it("503: the AI-unavailable message, no buttons, and the AI turned off for the session", async () => {
    const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
    const harness = createRouteHarness(ai, { aiEnabled: () => false });
    const chat = createChatDriver(harness, summary);
    const state = await chat.send(AI_CONVERSATIONS.businessOwner.messages[0]);

    expect(harness.responses).toEqual([
      { status: 503, json: { ok: false, error: "The AI assistant is not available right now. Use the form instead." } },
    ]);
    expect(ai.calls).toHaveLength(0);
    expect(state.error).toBe(FALLBACK_TEXT.unavailable);
    expect(failureActions(state.failureKind ?? "ai-failure")).toEqual({ tryAgain: false, useForm: false, logIn: false, startOverChat: false });
    expect(aiTurnedOff(state)).toBe(true);
    expect(state.failures).toBe(0);
  });

  it("401 and 503 in the intro panel: the login message, and the route's own text", async () => {
    const row = file.records.find((record) => record.normalized.recordId === "SYN-0001");
    if (!row) throw new Error("SYN-0001 is missing");
    const picked = pickIntroFields({ record: row });
    if (!picked.ok) throw new Error(picked.error);
    const ai = createScriptedAi(loadAiScript("intro"));

    const loggedOut = createRouteHarness(ai, { getAdmin: async () => null });
    expect(await requestIntro(loggedOut, picked.intro, "business_owner")).toEqual({ type: "failed", error: FALLBACK_TEXT.sessionExpired });

    const off = createRouteHarness(ai, { aiEnabled: () => false });
    expect(await requestIntro(off, picked.intro, "business_owner")).toEqual({ type: "failed", error: FALLBACK_TEXT.unavailable });
    expect(ai.calls).toHaveLength(0);
  });
});
