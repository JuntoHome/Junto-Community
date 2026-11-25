import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { EXAMPLE_SUMMARY } from "../__fixtures__/summary";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { AI_ATTEMPT_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS } from "./guardrails";
import { buildInterviewInstructions } from "./instructions";
import { INTERVIEW_TEXT, runInterviewTurn } from "./interview";
import { interviewReplyJsonSchema } from "./schema";
import type { AiCall, AiCallResult } from "./types";

const MESSAGES = [{ role: "user" as const, content: "I sell welding supplies." }];
const INPUT = { summary: EXAMPLE_SUMMARY, messages: MESSAGES };

const ok = (value: unknown): AiCallResult => ({ ok: true, value: typeof value === "string" ? value : JSON.stringify(value) });
const QUESTION = ok({ message: "Where are your customers?", proposal: null });
const BAD_SHAPE = ok("Where are your customers?"); // plain text, not the format

/** A fake AiCall that gives these results in order. */
const scripted = (...results: AiCallResult[]) => {
  const fn = vi.fn<AiCall>();
  for (const result of results) fn.mockResolvedValueOnce(result);
  return fn;
};

let consoleSpies: MockInstance[];

beforeEach(() => {
  consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((name) =>
    vi.spyOn(console, name).mockImplementation(() => {}),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const logged = () => consoleSpies.flatMap((spy) => spy.mock.calls);

describe("runInterviewTurn", () => {
  it("sends the chat with the instructions and the structured format, and returns the checked reply", async () => {
    const callAi = scripted(QUESTION);
    const result = await runInterviewTurn(INPUT, callAi);

    expect(result).toEqual({ ok: true, kind: "interview", reply: "Where are your customers?", proposal: null, note: null });
    expect(callAi).toHaveBeenCalledTimes(1);
    expect(callAi).toHaveBeenCalledWith({
      instructions: buildInterviewInstructions(EXAMPLE_SUMMARY),
      messages: MESSAGES,
      format: { name: "interview_reply", schema: interviewReplyJsonSchema },
    });
  });

  it("returns a valid proposal", async () => {
    const result = await runInterviewTurn(INPUT, scripted(ok({ message: "Does this look right?", proposal: { ...BUSINESS_OWNER_BRIEF, priorityOrder: null } })));
    expect(result).toEqual({ ok: true, kind: "interview", reply: "Does this look right?", proposal: BUSINESS_OWNER_BRIEF, note: null });
  });

  it("builds the instructions with the current brief when there is one", async () => {
    const callAi = scripted(QUESTION);
    await runInterviewTurn({ ...INPUT, currentBrief: BUSINESS_OWNER_BRIEF }, callAi);
    const { instructions } = callAi.mock.calls[0][0];
    expect(instructions).toBe(buildInterviewInstructions(EXAMPLE_SUMMARY, BUSINESS_OWNER_BRIEF));
    expect(instructions).toContain(JSON.stringify(BUSINESS_OWNER_BRIEF));
  });

  it("retries once after a reply in the wrong format, adding only the retry line", async () => {
    const callAi = scripted(BAD_SHAPE, QUESTION);
    const result = await runInterviewTurn(INPUT, callAi);

    expect(result).toEqual({ ok: true, kind: "interview", reply: "Where are your customers?", proposal: null, note: null });
    expect(callAi).toHaveBeenCalledTimes(2);
    const retry = callAi.mock.calls[1][0];
    expect(retry.messages).toEqual([...MESSAGES, { role: "user", content: INTERVIEW_TEXT.retry }]);
    expect(retry.messages.at(-1)?.content).toBe("Your last reply didn't match the required format. Reply again using the format.");
    expect(retry.instructions).toBe(callAi.mock.calls[0][0].instructions);
    expect(retry.format).toEqual(callAi.mock.calls[0][0].format);
    expect(MESSAGES).toHaveLength(1); // the caller's chat is not changed
  });

  it('gives "unusable" after two replies in the wrong format, and logs nothing itself', async () => {
    const callAi = scripted(BAD_SHAPE, ok({ message: "Hi", proposal: null, extra: 1 }));
    expect(await runInterviewTurn(INPUT, callAi)).toEqual({ ok: false, code: "unusable" });
    expect(callAi).toHaveBeenCalledTimes(2);
    expect(logged()).toEqual([]);
  });

  it("doesn't retry when a valid reply's proposal was dropped: the note is shown instead", async () => {
    const proposal = { ...BUSINESS_OWNER_BRIEF, priorityOrder: null, mustHaves: [{ field: "city", operator: "equals", value: "Flagstaff" }] };
    const callAi = scripted(ok({ message: "Here is a brief.", proposal }));
    expect(await runInterviewTurn(INPUT, callAi)).toEqual({
      ok: true,
      kind: "interview",
      reply: "Here is a brief.",
      proposal: null,
      note: `I couldn't use "Flagstaff" because it's not in this file.`,
    });
    expect(callAi).toHaveBeenCalledTimes(1);
  });

  it.each(["timeout", "upstream", "empty"] as const)("doesn't retry after a failed call (%s)", async (code) => {
    const callAi = scripted({ ok: false, code });
    expect(await runInterviewTurn(INPUT, callAi)).toEqual({ ok: false, code });
    expect(callAi).toHaveBeenCalledTimes(1);
  });

  it("passes on a failed retry's code", async () => {
    const callAi = scripted(BAD_SHAPE, { ok: false, code: "upstream" });
    expect(await runInterviewTurn(INPUT, callAi)).toEqual({ ok: false, code: "upstream" });
  });
});

describe("runInterviewTurn: time limits", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  });

  it(`stops an attempt after ${AI_ATTEMPT_TIMEOUT_MS / 1000} seconds with a timeout, and doesn't retry`, async () => {
    const callAi = vi.fn<AiCall>(() => new Promise(() => {}));
    let result: unknown;
    void runInterviewTurn(INPUT, callAi).then((r) => (result = r));

    await vi.advanceTimersByTimeAsync(AI_ATTEMPT_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ ok: false, code: "timeout" });
    expect(callAi).toHaveBeenCalledTimes(1);
  });

  it(`two slow attempts end with a timeout in under ${AI_REQUEST_TIMEOUT_MS / 1000} seconds`, async () => {
    // First: a reply in the wrong format just inside the limit. Second: no answer at all.
    const slowBadShape = () => new Promise<AiCallResult>((resolve) => setTimeout(() => resolve(BAD_SHAPE), AI_ATTEMPT_TIMEOUT_MS - 100));
    const callAi = vi.fn<AiCall>().mockImplementationOnce(slowBadShape).mockImplementationOnce(() => new Promise(() => {}));
    let result: unknown;
    let elapsed = 0;
    const started = Date.now();
    void runInterviewTurn(INPUT, callAi).then((r) => {
      result = r;
      elapsed = Date.now() - started;
    });

    await vi.advanceTimersByTimeAsync(AI_REQUEST_TIMEOUT_MS);
    expect(result).toEqual({ ok: false, code: "timeout" });
    expect(callAi).toHaveBeenCalledTimes(2);
    expect(elapsed).toBeLessThan(AI_REQUEST_TIMEOUT_MS);
    expect(elapsed).toBe(2 * AI_ATTEMPT_TIMEOUT_MS - 100);
  });
});
