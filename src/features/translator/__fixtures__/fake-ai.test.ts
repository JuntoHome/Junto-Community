import { describe, expect, it } from "vitest";
import { createScriptedAi, INVALID_REPLY_TEXT, loadAiScript, parseAiScript } from "./fake-ai";

/**
 * The scripted fake AI itself (TR-53): it answers by the last user message, in the transport
 * format, records every call, and throws on a message no line matches. The loader refuses a
 * malformed script file.
 */

const CALL = (...said: string[]) => ({
  instructions: "Rules.",
  messages: said.flatMap((content) => [
    { role: "assistant" as const, content: "Question?" },
    { role: "user" as const, content },
  ]),
  format: "text" as const,
});

const script = parseAiScript({
  description: "Test script.",
  steps: [
    { whenUserSays: { pattern: "^phoenix$", flags: "i" }, reply: { message: "Which title?", proposal: null } },
    { whenUserSays: { pattern: "slow" }, reply: "timeout" },
    { whenUserSays: { pattern: "garbled" }, reply: "invalid" },
    { whenUserSays: { pattern: "intro" }, reply: { draft: "Hello." } },
  ],
});

describe("createScriptedAi", () => {
  it("answers by the last user message only, as transport JSON", async () => {
    const ai = createScriptedAi(script);
    expect(await ai(CALL("slow", "Phoenix"))).toEqual({
      ok: true,
      value: JSON.stringify({ message: "Which title?", proposal: null }),
    });
  });

  it("answers a proposal with priorityOrder null when it has none, as OpenAI's structured output does", async () => {
    const [step] = loadAiScript("business-owner").slice(-1);
    const ai = createScriptedAi([step]);
    const result = await ai(CALL("10 to 99 employees, and 40 businesses"));
    if (!result.ok) throw new Error("expected a reply");
    expect(JSON.parse(result.value).proposal.priorityOrder).toBeNull();
  });

  it("gives the timeout code, unparseable text and a draft", async () => {
    const ai = createScriptedAi(script);
    expect(await ai(CALL("slow"))).toEqual({ ok: false, code: "timeout" });
    expect(await ai(CALL("garbled"))).toEqual({ ok: true, value: INVALID_REPLY_TEXT });
    expect(() => JSON.parse(INVALID_REPLY_TEXT)).toThrow();
    expect(await ai(CALL("intro"))).toEqual({ ok: true, value: "Hello." });
  });

  it("records every call", async () => {
    const ai = createScriptedAi(script);
    await ai(CALL("phoenix"));
    await ai(CALL("slow"));
    expect(ai.calls).toEqual([CALL("phoenix"), CALL("slow")]);
    expect(ai).toHaveBeenCalledTimes(2);
  });

  it("throws on a message no line matches", async () => {
    const ai = createScriptedAi(script);
    await expect(ai(CALL("Tempe"))).rejects.toThrow('fake-ai: no scripted reply for "Tempe"');
  });
});

describe("parseAiScript", () => {
  const step = { whenUserSays: { pattern: "x" }, reply: "timeout" };

  it("refuses the g and y flags, an unknown reply and an extra key", () => {
    expect(() => parseAiScript({ description: "d", steps: [{ ...step, whenUserSays: { pattern: "x", flags: "g" } }] })).toThrow();
    expect(() => parseAiScript({ description: "d", steps: [{ ...step, whenUserSays: { pattern: "x", flags: "y" } }] })).toThrow();
    expect(() => parseAiScript({ description: "d", steps: [{ ...step, reply: "upstream" }] })).toThrow();
    expect(() => parseAiScript({ description: "d", steps: [{ ...step, extra: 1 }] })).toThrow();
  });

  it("refuses a proposal that leaves out a brief key, or isn't a SearchBrief", () => {
    const [{ reply: full }] = loadAiScript("business-owner").slice(-1);
    if (typeof full !== "object" || !("proposal" in full) || !full.proposal) throw new Error("expected a proposal");
    const withProposal = (proposal: object) => ({
      description: "d",
      steps: [{ ...step, reply: { message: "Here.", proposal } }],
    });
    // listSize has a default in searchBriefSchema; a script must still write it, as OpenAI does.
    const noListSize: Partial<typeof full.proposal> = { ...full.proposal };
    delete noListSize.listSize;
    expect(() => parseAiScript(withProposal(noListSize))).toThrow(/every one of/);
    expect(() => parseAiScript(withProposal({ ...full.proposal, listSize: 0 }))).toThrow();
    expect(() => parseAiScript(withProposal({ ...full.proposal, rank: 1 }))).toThrow();
    expect(parseAiScript(withProposal(full.proposal))[0].reply).toEqual({ message: "Here.", proposal: full.proposal });
  });

  it("loads every committed script", () => {
    for (const name of ["business-owner", "role-change", "job-seeker", "ambiguous", "not-in-file", "intro"]) {
      expect(loadAiScript(name).length).toBeGreaterThan(0);
    }
  });
});
