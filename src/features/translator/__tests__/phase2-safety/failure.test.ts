import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, expect, it, type MockInstance, vi } from "vitest";
import { AI_CONVERSATIONS } from "../../__fixtures__/ai-conversations";
import { createChatDriver, createRouteHarness, requestIntro, type RouteHarness } from "../../__fixtures__/ai-harness";
import { toArrayBuffer } from "../../__fixtures__/build-workbook";
import { createScriptedAi, loadAiScript } from "../../__fixtures__/fake-ai";
import { type LoadedFile, loadFile } from "../../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../../__fixtures__/records";
import {
  aiTurnedOff,
  type ChatAction,
  chatReducer,
  type ChatState,
  fallbackBrief,
  initialChatState,
  interpretAiResult,
  shouldSwitchToForm,
} from "../../ai/chat-session";
import { failureActions, FALLBACK_TEXT } from "../../ai/fallback";
import { INTERVIEW_TEXT, runInterviewTurn } from "../../ai/interview";
import { pickIntroFields } from "../../ai/intro";
import { buildFileSummary, type FileSummary } from "../../ai/summary";
import { BUSINESS_OWNER_BRIEF } from "../../criteria/examples";
import { type CriteriaForm, toBrief } from "../../criteria/from-form";
import { briefToFormState } from "../../criteria/to-form";
import { readSource, REPO_ROOT, stripComments } from "../source-files";

/**
 * Phase 2 safety evidence: the Translator keeps working when the AI fails (TR-54).
 *
 * **Screens aren't rendered.** The project has no React Testing Library, so these tests check
 * the state and logic the screens are drawn from: the chat state (`error` is the message the
 * panel shows, `failureActions()` the buttons under it), `shouldSwitchToForm()`,
 * `fallbackBrief()` and `briefToFormState()`. That the panel really shows them, and that the
 * Criteria step really switches to the form, is checked by hand (docs/translator/QA-CHECKLIST.md,
 * section 12).
 *
 * Most tests follow a message the whole way, as the browser and the route run it
 * (`__fixtures__/ai-harness.ts`): the chat state, the request body, the real route handler with
 * the scripted fake AI behind it (`walkthroughs/ai-failures.json`: `"timeout"`, `"invalid"`),
 * `postAi()`, `interpretAiResult()` and the chat state again. The chat state tests at the end
 * were moved here from `ai/chat-session.test.ts` (TR-50).
 */

let file: LoadedFile;
let summary: FileSummary;
let consoleError: MockInstance<typeof console.error>;

beforeAll(async () => {
  file = await loadFile(toArrayBuffer(readFileSync(SAMPLE_PATH)));
  summary = buildFileSummary(file.records, file.importState.parsed.layout.id);
});

beforeEach(() => {
  // The route logs a code on each failure. Kept quiet here and checked where it matters.
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

/** What the route logged: each call's arguments. */
const logged = () => consoleError.mock.calls;

const TIMED_OUT = "show 30 businesses";

/** A Criteria step chat after the business owner conversation: its proposal is the last valid brief. */
async function afterBusinessOwner(harness: RouteHarness) {
  const chat = createChatDriver(harness, summary);
  for (const message of AI_CONVERSATIONS.businessOwner.messages) await chat.send(message);
  expect(chat.state.lastValidBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
  return chat;
}

const businessOwnerHarness = () => createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script)));

/** The form the business owner brief gives, written out: picked values are match keys. */
const BUSINESS_OWNER_FORM: CriteriaForm = {
  intent: "business_owner",
  mustHaves: { city: ["phoenix"], state: ["az"], industry: [], title: [] },
  preferences: {
    industry: { mode: "prefer", picked: ["fabrication"] },
    title: { mode: "prefer", picked: ["owner"] },
    employees: { mode: "prefer", from: "10", to: "99" },
  },
  rankByImportance: false,
  importanceOrder: ["industry", "title", "employees"],
  exclusions: { industry: [], title: [], city: [] },
  listSize: "40",
  assumptions: [],
};

// ---------------------------------------------------------------------------------------------
// Through the browser and the route
// ---------------------------------------------------------------------------------------------

it("failure: one timeout keeps the last valid brief", async () => {
  const harness = businessOwnerHarness();
  const chat = await afterBusinessOwner(harness);
  const failing = createScriptedAi(loadAiScript("failures"));
  harness.setAi(failing);
  const state = await chat.send(TIMED_OUT);

  // The route: a 504 after one attempt (no retry after a timeout), and only its code logged.
  expect(failing.calls).toHaveLength(1);
  expect(harness.responses.at(-1)).toEqual({
    status: 504,
    json: { ok: false, error: "The AI took too long to answer. Try again, or use the form." },
  });
  expect(logged()).toEqual([["translator_ai_timeout"]]);

  // The chat: the ai-failure kind, the exact message, its buttons, the text back for Try again.
  expect(state.status).toBe("error");
  expect(state.failureKind).toBe("ai-failure");
  expect(state.error).toBe("The AI didn't respond. Your criteria so far are kept. You can try again or use the form.");
  expect(failureActions("ai-failure")).toEqual({ tryAgain: true, useForm: true, logIn: false, startOverChat: false });
  expect(state.draft).toBe(TIMED_OUT);
  expect(state.items.map((item) => item.content)).not.toContain(TIMED_OUT);
  expect(state.failures).toBe(1);
  expect(shouldSwitchToForm(state)).toBe(false);
  expect(state.lastValidBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
  expect(state.proposal).toStrictEqual(BUSINESS_OWNER_BRIEF);
});

it("failure: try again resends the same message", async () => {
  const harness = businessOwnerHarness();
  const chat = await afterBusinessOwner(harness);
  harness.setAi(createScriptedAi(loadAiScript("failures")));
  await chat.send(TIMED_OUT);
  const failedBody = JSON.parse(harness.bodies.at(-1) ?? "");

  // The AI is back: Try again sends what the failure put back in the box.
  harness.setAi(createScriptedAi(loadAiScript("list-size")));
  const state = await chat.tryAgain();
  const resent = JSON.parse(harness.bodies.at(-1) ?? "");

  expect(resent.messages.at(-1)).toEqual({ role: "user", content: TIMED_OUT });
  expect(resent.messages).toEqual(failedBody.messages);
  expect(resent.currentBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
  expect(state.status).toBe("idle");
  expect(state.error).toBeNull();
  expect(state.failures).toBe(0);
  expect(state.proposal).toStrictEqual({ ...BUSINESS_OWNER_BRIEF, listSize: 30 });
});

it("failure: two failures switch to the form, pre-filled", async () => {
  const harness = businessOwnerHarness();
  const chat = await afterBusinessOwner(harness);
  harness.setAi(createScriptedAi(loadAiScript("failures")));

  await chat.send(TIMED_OUT);
  expect(shouldSwitchToForm(chat.state)).toBe(false);
  const state = await chat.tryAgain();

  expect(state.failures).toBe(2);
  expect(shouldSwitchToForm(state)).toBe(true);
  // The Criteria step fills the form with briefToFormState(fallbackBrief()).
  expect(fallbackBrief(state, null)).toStrictEqual(BUSINESS_OWNER_BRIEF);
  const form = briefToFormState(state.lastValidBrief ?? BUSINESS_OWNER_BRIEF);
  expect(form).toEqual(BUSINESS_OWNER_FORM);
  // That form gives back exactly the last valid brief on Continue.
  expect(toBrief(form, file.options)).toStrictEqual({ ok: true, brief: BUSINESS_OWNER_BRIEF });
  expect(logged()).toEqual([["translator_ai_timeout"], ["translator_ai_timeout"]]);
});

it("failure: on Results, two failures don't leave the page", async () => {
  const harness = createRouteHarness(createScriptedAi(loadAiScript(AI_CONVERSATIONS.roleChange.script)));
  const chat = createChatDriver(harness, summary, { mode: "revise", base: BUSINESS_OWNER_BRIEF });
  await chat.send(AI_CONVERSATIONS.roleChange.messages[0]);
  expect(chat.state.proposal).not.toBeNull();

  harness.setAi(createScriptedAi(loadAiScript("failures")));
  await chat.send(TIMED_OUT);
  const state = await chat.tryAgain();

  // The outcome: the failure message with Use the form offered, holding the confirmed brief,
  // never the proposal that was not confirmed.
  expect(state.failures).toBe(2);
  expect(state.error).toBe(FALLBACK_TEXT.aiFailure);
  expect(failureActions(state.failureKind ?? "ai-failure").useForm).toBe(true);
  expect(fallbackBrief(state, BUSINESS_OWNER_BRIEF, "revise")).toStrictEqual(BUSINESS_OWNER_BRIEF);

  // Not the auto-switch: the panel switches only through onTwoFailures, which the Criteria step
  // gives it and the Results step doesn't. Checked in the source, since screens aren't rendered.
  const step = (name: string) => stripComments(readSource(`${REPO_ROOT}src/features/translator/ui/${name}`));
  expect(step("criteria-step.tsx")).toContain("onTwoFailures=");
  expect(step("results-step.tsx")).not.toContain("onTwoFailures");
});

it("failure: a hidden Criteria chat never switches to the form", async () => {
  // The state still asks for the switch after two failures, wherever the chat is...
  const harness = createRouteHarness(createScriptedAi(loadAiScript("failures")));
  const chat = createChatDriver(harness, summary);
  await chat.send(TIMED_OUT);
  expect(shouldSwitchToForm(await chat.tryAgain())).toBe(true);

  // ...so the Criteria step gives the panel onTwoFailures only while the chat is on screen. A
  // request still in flight after the user chose the form must not refill it, show the note or
  // move focus. Checked in the source, since screens aren't rendered.
  const source = stripComments(readSource(`${REPO_ROOT}src/features/translator/ui/criteria-step.tsx`));
  expect(source).toContain("onTwoFailures={hidden ? undefined : onTwoFailures}");
});

it("failure: invalid output twice gives the plain error", async () => {
  // The capability: one attempt, one retry with only the retry line added, then "unusable".
  const others = (["log", "info", "warn", "debug"] as const).map((name) => vi.spyOn(console, name).mockImplementation(() => {}));
  const ai = createScriptedAi(loadAiScript("failures"));
  const messages = [{ role: "user" as const, content: "show something odd" }];
  expect(await runInterviewTurn({ summary, messages }, ai)).toEqual({ ok: false, code: "unusable" });
  expect(ai.calls).toHaveLength(2);
  expect(ai.calls[1].messages).toEqual([...messages, { role: "user", content: INTERVIEW_TEXT.retry }]);
  // The capability itself logs nothing, on any console method.
  expect(logged()).toEqual([]);
  for (const spy of others) {
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  }

  // Through the route: { ok: false } with the exact TR-42 text, and only its code logged.
  const harness = businessOwnerHarness();
  const chat = await afterBusinessOwner(harness);
  harness.setAi(createScriptedAi(loadAiScript("failures")));
  const state = await chat.send("show something odd");
  expect(harness.responses.at(-1)).toEqual({
    status: 502,
    json: { ok: false, error: "The AI gave an answer I couldn't use. Your last criteria are kept. Try again or use the form." },
  });
  expect(logged()).toEqual([["translator_ai_unusable"]]);
  // The chat shows the AI-failure message (TR-50 uses one text for every AI failure) and keeps the brief.
  expect(state.error).toBe(FALLBACK_TEXT.aiFailure);
  expect(state.lastValidBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
});

it("failure: 401 shows the login message", async () => {
  const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
  let loggedIn = false;
  const harness = createRouteHarness(ai, { getAdmin: async () => (loggedIn ? { userId: "admin-1" } : null) });
  const chat = createChatDriver(harness, summary);
  const state = await chat.send(AI_CONVERSATIONS.businessOwner.messages[0]);

  expect(harness.responses).toEqual([{ status: 401, json: { ok: false, error: "Please log in as a JCA admin to use the AI assistant." } }]);
  expect(ai.calls).toHaveLength(0);
  expect(state.failureKind).toBe("session-expired");
  expect(state.error).toBe("Your login has expired. Log in again to keep using the AI.");
  expect(failureActions("session-expired")).toEqual({ tryAgain: true, useForm: true, logIn: true, startOverChat: false });
  expect(state.failures).toBe(0);
  expect(aiTurnedOff(state)).toBe(false);

  // Logged in again in another tab: Try again works.
  loggedIn = true;
  expect((await chat.tryAgain()).error).toBeNull();

  // The intro panel gets the same login message.
  const record = file.records.find((r) => r.normalized.recordId === "SYN-0001");
  const picked = record && pickIntroFields({ record });
  if (!picked?.ok) throw new Error("SYN-0001 has no intro fields");
  loggedIn = false;
  expect(await requestIntro(harness, picked.intro, "business_owner")).toEqual({ type: "failed", error: FALLBACK_TEXT.sessionExpired });
});

it("failure: 503 turns the AI off", async () => {
  const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
  const harness = createRouteHarness(ai, { aiEnabled: () => false });
  const chat = createChatDriver(harness, summary);
  const state = await chat.send(AI_CONVERSATIONS.businessOwner.messages[0]);

  expect(harness.responses).toEqual([
    { status: 503, json: { ok: false, error: "The AI assistant is not available right now. Use the form instead." } },
  ]);
  expect(ai.calls).toHaveLength(0);
  expect(state.failureKind).toBe("unavailable");
  expect(state.error).toBe(FALLBACK_TEXT.unavailable);
  expect(failureActions("unavailable")).toEqual({ tryAgain: false, useForm: false, logIn: false, startOverChat: false });
  expect(aiTurnedOff(state)).toBe(true);
  expect(state.failures).toBe(0);

  const record = file.records.find((r) => r.normalized.recordId === "SYN-0001");
  const picked = record && pickIntroFields({ record });
  if (!picked?.ok) throw new Error("SYN-0001 has no intro fields");
  expect(await requestIntro(harness, picked.intro, "business_owner")).toEqual({ type: "failed", error: FALLBACK_TEXT.unavailable });
});

// ---------------------------------------------------------------------------------------------
// The chat state on its own (moved from ai/chat-session.test.ts, TR-50)
// ---------------------------------------------------------------------------------------------

/** Applies the actions in order, starting from a new chat. */
const run = (...actions: ChatAction[]): ChatState => actions.reduce(chatReducer, initialChatState());
const send = (text: string): ChatAction => ({ type: "send", text });
const received = (requestId: number, changes: Partial<Extract<ChatAction, { type: "received" }>> = {}): ChatAction => ({
  type: "received",
  requestId,
  reply: "Which industries matter most?",
  note: null,
  proposal: null,
  ...changes,
});
const failed = (requestId: number, kind: Extract<ChatAction, { type: "failed" }>["kind"]): ChatAction => ({
  ...(interpretAiResult({ kind, error: null }) as Extract<ChatAction, { type: "failed" }>),
  requestId,
});

it("failure: two AI failures after a proposal keep that proposal and ask for the switch to the form", () => {
  const state = run(send("Owners"), received(1, { proposal: BUSINESS_OWNER_BRIEF }), send("Mesa"), failed(2, "ai-failure"), send("Mesa"), failed(3, "network"));
  expect(state.failures).toBe(2);
  expect(state.lastValidBrief).toBe(BUSINESS_OWNER_BRIEF);
  expect(fallbackBrief(state, null)).toBe(BUSINESS_OWNER_BRIEF);
  expect(shouldSwitchToForm(state)).toBe(true);
});

it("failure: one failure asks for nothing", () => {
  const state = run(send("Owners"), failed(1, "ai-failure"));
  expect(state.failures).toBe(1);
  expect(shouldSwitchToForm(state)).toBe(false);
});

it("failure: a reply resets the count: failure, success, failure gives 1", () => {
  const state = run(send("A"), failed(1, "network"), send("A"), received(2), send("B"), failed(3, "ai-failure"));
  expect(state.failures).toBe(1);
  expect(shouldSwitchToForm(state)).toBe(false);
});

it("failure: a login expiry, a rate limit or a refusal isn't counted as the AI failing", () => {
  const expired = run(send("A"), failed(1, "session-expired"), send("A"), failed(2, "session-expired"));
  expect(expired.failures).toBe(0);
  expect(shouldSwitchToForm(expired)).toBe(false);
  const others = run(send("A"), failed(1, "rate-limited"), send("A"), failed(2, "too-long"), send("A"), failed(3, "bad-request"));
  expect(others.failures).toBe(0);
});

it("failure: the form gets the confirmed brief on Results, and the pending brief on Criteria with no proposal", () => {
  const state = run(send("Owners"), failed(1, "ai-failure"));
  expect(fallbackBrief(state, BUSINESS_OWNER_BRIEF, "revise")).toBe(BUSINESS_OWNER_BRIEF);
  expect(fallbackBrief(state, BUSINESS_OWNER_BRIEF, "criteria")).toBe(BUSINESS_OWNER_BRIEF);
  expect(fallbackBrief(state, null)).toBeNull();
  // On Results a proposal that was never confirmed doesn't replace the confirmed brief.
  const proposal = { ...BUSINESS_OWNER_BRIEF, listSize: 30 };
  const withProposal = run(send("30 rows"), received(1, { proposal }), send("Hm"), failed(2, "network"));
  expect(fallbackBrief(withProposal, BUSINESS_OWNER_BRIEF, "revise")).toBe(BUSINESS_OWNER_BRIEF);
  expect(fallbackBrief(withProposal, BUSINESS_OWNER_BRIEF, "criteria")).toBe(proposal);
});

it("failure: unavailable turns the AI off without counting it", () => {
  const state = run(send("A"), failed(1, "unavailable"));
  expect(aiTurnedOff(state)).toBe(true);
  expect(state.failures).toBe(0);
  expect(aiTurnedOff(run(send("A"), failed(1, "network")))).toBe(false);
});

it("failure: Start over chat starts a fresh count", () => {
  const state = run(send("A"), failed(1, "network"), { type: "reset" });
  expect(state).toMatchObject({ failures: 0, failureKind: null, aiOff: false });
});
