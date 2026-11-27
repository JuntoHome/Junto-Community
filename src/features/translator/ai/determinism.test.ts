import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AI_CONVERSATIONS } from "../__fixtures__/ai-conversations";
import { createChatDriver, createRouteHarness } from "../__fixtures__/ai-harness";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { createScriptedAi, loadAiScript } from "../__fixtures__/fake-ai";
import { confirmAiProposal, loadFile } from "../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import type { RankedRow } from "../ranking";
import { buildFileSummary } from "./summary";

/**
 * Determinism test (TR-54): the same file and the same conversation give the same result, every
 * time. The business owner conversation runs twice from scratch: the sample read again, a new
 * summary, a new fake AI, the browser and the route (`__fixtures__/ai-harness.ts`), Confirm and
 * rank. The two runs must agree on what was sent, the confirmed brief and every eligible row's
 * place, score and reasons. The AI's replies are scripted, so this proves the app's part is
 * deterministic; a real model's replies can differ, which is why the AI never ranks.
 */

/** One full run of the business owner conversation, from the file's bytes to the ranked results. */
async function businessOwnerRun() {
  const file = await loadFile(toArrayBuffer(readFileSync(SAMPLE_PATH)));
  const summary = buildFileSummary(file.records, file.importState.parsed.layout.id);
  const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
  const harness = createRouteHarness(ai);
  const chat = createChatDriver(harness, summary);
  for (const message of AI_CONVERSATIONS.businessOwner.messages) await chat.send(message);
  const proposal = chat.state.proposal;
  if (!proposal) throw new Error("the business owner conversation ended without a proposal");
  const confirmed = confirmAiProposal(proposal, file);
  return { bodies: harness.bodies, calls: ai.calls, ...confirmed };
}

/** Every eligible row, in order: its Record ID, unrounded and shown score, and reasons. */
const rows = (ranked: readonly RankedRow[]) =>
  ranked.map((row) => ({
    recordId: row.record.normalized.recordId,
    score: row.score,
    displayScore: row.displayScore,
    reasons: row.reasons,
    reasonText: row.reasonText,
  }));

describe("determinism: the business owner conversation run twice", () => {
  it("sends the same requests and gets the same confirmed brief, ranked IDs, scores and reasons", async () => {
    const first = await businessOwnerRun();
    const second = await businessOwnerRun();

    // The same bytes left the browser, and the AI got the same instructions and messages.
    expect(second.bodies).toEqual(first.bodies);
    expect(second.calls).toEqual(first.calls);

    expect(second.confirmedBrief).toStrictEqual(first.confirmedBrief);
    expect(rows(second.rankResult.ranked)).toEqual(rows(first.rankResult.ranked));
    expect(second.rankResult.shortlist.map((row) => [row.rank, row.record.normalized.recordId])).toEqual(
      first.rankResult.shortlist.map((row) => [row.rank, row.record.normalized.recordId]),
    );
    expect(second.counts).toEqual(first.counts);

    // Guard: the runs really ranked something.
    expect(first.rankResult.ranked).toHaveLength(100);
    expect(first.rankResult.shortlist).toHaveLength(40);
  });
});
