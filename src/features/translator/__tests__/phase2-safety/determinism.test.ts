import { readFileSync } from "node:fs";
import { beforeAll, expect, it } from "vitest";
import { AI_CONVERSATIONS } from "../../__fixtures__/ai-conversations";
import { createChatDriver, createRouteHarness } from "../../__fixtures__/ai-harness";
import { toArrayBuffer } from "../../__fixtures__/build-workbook";
import { createScriptedAi, loadAiScript } from "../../__fixtures__/fake-ai";
import { confirmAiProposal, type LoadedFile, loadFile, withRecords } from "../../__fixtures__/pipeline";
import { SAMPLE_PATH, seededShuffle } from "../../__fixtures__/records";
import { diffBriefs } from "../../ai/diff-brief";
import { explainChange } from "../../ai/explain-change";
import { buildFileSummary } from "../../ai/summary";
import type { TranslatorRecord } from "../../import/fields";
import { normalizeRecord } from "../../normalize/normalize";
import type { RankedRow } from "../../ranking";

/**
 * Phase 2 safety evidence: determinism (TR-54). The same file and the same conversation give the
 * same result every time, whatever order the records come in. The business owner conversation
 * and the role change run from the file's bytes, twice, and with the records shuffled by 3 fixed
 * seeds, through the browser and the route (`__fixtures__/ai-harness.ts`), then Confirm and rank.
 * Every run must give the same summary JSON, instructions, requests, confirmed brief, ranked IDs,
 * scores, reasons and explanation.
 *
 * The AI's replies are scripted, so this proves the app's part is deterministic. A real model's
 * replies can differ, which is why the AI never ranks.
 *
 * Moved here from `ai/summary.test.ts` (TR-40): "gives the same JSON on every run" (now part of
 * the runs below) and the equal-count order test, which also has a value whose order differs
 * between `localeCompare()` and code units, so the summary's own tiebreak is what's checked.
 */

const SHUFFLE_SEEDS = [1, 42, 20261118] as const;

let file: LoadedFile;
beforeAll(async () => {
  file = await loadFile(toArrayBuffer(readFileSync(SAMPLE_PATH)));
});

/** One full run: the business owner conversation, Confirm and rank, then the role change and its explanation. */
async function fullRun(source: LoadedFile) {
  const summary = buildFileSummary(source.records, source.importState.parsed.layout.id);
  const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
  const harness = createRouteHarness(ai);
  const chat = createChatDriver(harness, summary);
  for (const message of AI_CONVERSATIONS.businessOwner.messages) await chat.send(message);
  if (!chat.state.proposal) throw new Error("the business owner conversation ended without a proposal");
  const confirmed = confirmAiProposal(chat.state.proposal, source);

  const reviseAi = createScriptedAi(loadAiScript(AI_CONVERSATIONS.roleChange.script));
  harness.setAi(reviseAi);
  const revise = createChatDriver(harness, summary, { mode: "revise", base: confirmed.confirmedBrief });
  await revise.send(AI_CONVERSATIONS.roleChange.messages[0]);
  if (!revise.state.proposal) throw new Error("the role change ended without a proposal");
  const after = confirmAiProposal(revise.state.proposal, source);
  const changes = diffBriefs(confirmed.confirmedBrief, revise.state.proposal);

  return {
    summaryJson: JSON.stringify(summary),
    instructions: [...ai.calls, ...reviseAi.calls].map((call) => call.instructions),
    bodies: harness.bodies,
    confirmedBrief: confirmed.confirmedBrief,
    ranked: rows(confirmed.rankResult.ranked),
    shortlist: confirmed.rankResult.shortlist.map((row) => [row.rank, row.record.normalized.recordId]),
    counts: confirmed.counts,
    explanation: explainChange({ before: confirmed.rankResult, after: after.rankResult, changes }),
  };
}

/** Every eligible row, in order: its Record ID, unrounded and shown score, and reasons. */
const rows = (ranked: readonly RankedRow[]) =>
  ranked.map((row) => ({
    recordId: row.record.normalized.recordId,
    score: row.score,
    displayScore: row.displayScore,
    reasonText: row.reasonText,
  }));

it("determinism: same conversation, same result: twice and with the records shuffled", async () => {
  const first = await fullRun(file);
  // Guard: the run really ranked something.
  expect(first.ranked).toHaveLength(100);
  expect(first.shortlist).toHaveLength(40);
  expect(first.instructions).toHaveLength(4);

  const again = await fullRun(await loadFile(toArrayBuffer(readFileSync(SAMPLE_PATH))));
  const shuffled = [];
  for (const seed of SHUFFLE_SEEDS) {
    const records = seededShuffle(file.records, seed);
    // Guard: the shuffle really changed the order.
    expect(records.map((r) => r.normalized.recordId)).not.toEqual(file.records.map((r) => r.normalized.recordId));
    shuffled.push(await fullRun(withRecords(file, records)));
  }

  for (const run of [again, ...shuffled]) {
    expect(run.summaryJson).toBe(first.summaryJson);
    expect(run.instructions).toEqual(first.instructions);
    expect(run.bodies).toEqual(first.bodies);
    expect(run.confirmedBrief).toStrictEqual(first.confirmedBrief);
    expect(run.ranked).toEqual(first.ranked);
    expect(run.shortlist).toEqual(first.shortlist);
    expect(run.counts).toEqual(first.counts);
  }
});

it("determinism: same inputs, same explanation", async () => {
  const runs = [await fullRun(file), await fullRun(file), await fullRun(withRecords(file, seededShuffle(file.records, 7)))];
  for (const run of runs) {
    expect(run.explanation).toEqual([
      "Synthetic Company 0006 (SYN-0006) is now #1 with score 100: Title: Operations Manager (preferred). It's tied with 5 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) is now #7 with score 64: Title: Owner (not preferred).",
    ]);
  }
});

// ---------------------------------------------------------------------------------------------
// The summary's order (moved from ai/summary.test.ts, TR-40)
// ---------------------------------------------------------------------------------------------

/** An invented record in memory: blank fields except the title. `n` sets the row number and ID. */
function withTitle(title: string, count: number, from: number) {
  return Array.from({ length: count }, (_, i) => {
    const n = from + i;
    const base: TranslatorRecord = {
      recordId: `TST-${String(n).padStart(5, "0")}`,
      idGenerated: false,
      otherExecutives: [],
      company: null,
      city: null,
      state: null,
      industry: null,
      employees: null,
      title,
      name: null,
      email: null,
      phone: null,
      website: null,
      address: null,
      zip: null,
      naicsDescription: null,
      employeeRange: null,
    };
    return { sourceRow: n + 1, normalized: normalizeRecord(base) };
  });
}

it("determinism: summary order is the same in every browser and for any record order", () => {
  const records = [
    ...withTitle("Zeta Lead", 2, 1),
    ...withTitle("alpha Lead", 2, 10),
    ...withTitle("Beta Lead", 2, 20),
    ...withTitle("Éclair Lead", 2, 40),
    ...withTitle("Owner", 3, 30),
  ];
  // Count first, then A to Z by upper-cased code units, not the browser's localeCompare():
  // "É" (U+00C9) comes after "Z", where localeCompare() would put "Éclair" before "Zeta".
  const expected = [
    { value: "Owner", count: 3 },
    { value: "alpha Lead", count: 2 },
    { value: "Beta Lead", count: 2 },
    { value: "Zeta Lead", count: 2 },
    { value: "Éclair Lead", count: 2 },
  ];
  expect(buildFileSummary(records, "synthetic").titles).toEqual(expected);

  const json = JSON.stringify(buildFileSummary(records, "synthetic"));
  for (const seed of [1, 2, 3]) {
    expect(JSON.stringify(buildFileSummary(seededShuffle(records, seed), "synthetic"))).toBe(json);
  }
});
