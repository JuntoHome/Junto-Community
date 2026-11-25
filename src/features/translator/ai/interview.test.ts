import { describe, expect, it, vi } from "vitest";
import { EXAMPLE_SUMMARY } from "../__fixtures__/summary";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { buildInterviewInstructions } from "./instructions";
import { runInterviewTurn } from "./interview";
import type { AiCall } from "./types";

const MESSAGES = [{ role: "user" as const, content: "I sell welding supplies." }];

describe("runInterviewTurn (no proposal until TR-42)", () => {
  it("sends the chat with the interview instructions and never proposes a brief", async () => {
    const callAi = vi.fn<AiCall>(async () => ({ ok: true, value: "Where are your customers?" }));
    const result = await runInterviewTurn({ summary: EXAMPLE_SUMMARY, messages: MESSAGES }, callAi);

    expect(result).toEqual({ ok: true, kind: "interview", reply: "Where are your customers?", proposal: null });
    expect(callAi).toHaveBeenCalledWith({
      instructions: buildInterviewInstructions(EXAMPLE_SUMMARY),
      messages: MESSAGES,
      format: "text",
    });
  });

  it("builds the instructions with the current brief when there is one", async () => {
    const callAi = vi.fn<AiCall>(async () => ({ ok: true, value: "What would you like to change?" }));
    await runInterviewTurn({ summary: EXAMPLE_SUMMARY, messages: MESSAGES, currentBrief: BUSINESS_OWNER_BRIEF }, callAi);

    expect(callAi).toHaveBeenCalledWith(
      expect.objectContaining({ instructions: buildInterviewInstructions(EXAMPLE_SUMMARY, BUSINESS_OWNER_BRIEF) }),
    );
  });

  it("passes a failed call's code on", async () => {
    const result = await runInterviewTurn({ summary: EXAMPLE_SUMMARY, messages: MESSAGES }, async () => ({ ok: false, code: "empty" }));
    expect(result).toEqual({ ok: false, code: "empty" });
  });
});
