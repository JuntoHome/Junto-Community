import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_ATTEMPT_TIMEOUT_MS } from "./guardrails";
import { buildIntroInstructions } from "./instructions";
import { runIntroDraft } from "./intro";
import type { AiCall } from "./types";

afterEach(() => {
  vi.useRealTimers();
});

describe("runIntroDraft (placeholder until TR-48)", () => {
  it("sends only the goal with the intro instructions", async () => {
    const callAi = vi.fn<AiCall>(async () => ({ ok: true, value: "Hello, I'm a local supplier." }));
    const result = await runIntroDraft({ intro: { companyName: "Example Fabrication Co" }, goal: "I sell welding supplies." }, callAi);

    expect(result).toEqual({ ok: true, kind: "intro", draft: "Hello, I'm a local supplier." });
    expect(callAi).toHaveBeenCalledWith({
      instructions: buildIntroInstructions(),
      messages: [{ role: "user", content: "I sell welding supplies." }],
      format: "text",
    });
  });

  it("passes a failed call's code on", async () => {
    const result = await runIntroDraft({ intro: {}, goal: "Hi" }, async () => ({ ok: false, code: "upstream" }));
    expect(result).toEqual({ ok: false, code: "upstream" });
  });

  it("stops the attempt after 12 seconds with a timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let result: unknown;
    void runIntroDraft({ intro: {}, goal: "Hi" }, () => new Promise(() => {})).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(AI_ATTEMPT_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ ok: false, code: "timeout" });
  });
});
