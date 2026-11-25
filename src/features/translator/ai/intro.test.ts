import { describe, expect, it, vi } from "vitest";
import { buildIntroInstructions } from "./instructions";
import { runIntroDraft } from "./intro";
import type { AiCall } from "./types";

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
});
