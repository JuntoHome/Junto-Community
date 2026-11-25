import { describe, expect, it, vi } from "vitest";
import { EXAMPLE_SUMMARY } from "../__fixtures__/summary";
import { runInterviewTurn } from "./interview";
import type { AiCall } from "./types";

const MESSAGES = [{ role: "user" as const, content: "I sell welding supplies." }];

describe("runInterviewTurn (placeholder until TR-41)", () => {
  it("sends the chat with the placeholder instructions and never proposes a brief", async () => {
    const callAi = vi.fn<AiCall>(async () => ({ ok: true, value: "Where are your customers?" }));
    const result = await runInterviewTurn({ summary: EXAMPLE_SUMMARY, messages: MESSAGES }, callAi);

    expect(result).toEqual({ ok: true, kind: "interview", reply: "Where are your customers?", proposal: null });
    expect(callAi).toHaveBeenCalledWith({
      instructions: "You are a helpful assistant for a library business-contacts tool. Reply briefly.",
      messages: MESSAGES,
      format: "text",
    });
  });

  it("passes a failed call's code on", async () => {
    const result = await runInterviewTurn({ summary: EXAMPLE_SUMMARY, messages: MESSAGES }, async () => ({ ok: false, code: "empty" }));
    expect(result).toEqual({ ok: false, code: "empty" });
  });
});
