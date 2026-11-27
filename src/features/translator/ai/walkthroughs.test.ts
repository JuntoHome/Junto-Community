import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { AI_CONVERSATIONS } from "../__fixtures__/ai-conversations";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { createScriptedAi, type FakeAi, loadAiScript } from "../__fixtures__/fake-ai";
import { confirmAiProposal, goldenRows, type LoadedFile, loadFile } from "../__fixtures__/pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import businessOwnerGolden from "../__fixtures__/walkthroughs/business-owner.json";
import jobSeekerGolden from "../__fixtures__/walkthroughs/job-seeker.json";
import roleChangeGolden from "../__fixtures__/walkthroughs/role-change.json";
import { BUSINESS_OWNER_BRIEF, JOB_SEEKER_BRIEF } from "../criteria/examples";
import type { SearchBrief } from "../criteria/schema";
import type { ShortlistRow } from "../ranking";
import {
  buildChatRequest,
  type ChatMode,
  chatReducer,
  type ChatState,
  currentBriefFor,
  initialChatState,
  REVISE_TEXT,
  settleRevision,
} from "./chat-session";
import { diffBriefs } from "./diff-brief";
import { explainChange } from "./explain-change";
import { CURRENT_BRIEF_LABEL, DATA_ONLY_NOTE } from "./instructions";
import { runInterviewTurn } from "./interview";
import { buildIntroMessage, pickIntroFields, runIntroDraft } from "./intro";
import { buildFileSummary, type FileSummary } from "./summary";
import type { InterviewResult } from "./types";
import { VALIDATE_TEXT } from "./validate";

/**
 * The AI walkthrough conversations (TR-53), the spec's Phase 2 checks, run end to end with a
 * scripted fake AI: the committed synthetic sample, `buildFileSummary()`, the chat state, one
 * `runInterviewTurn()` per message (which sends the reply through `fromTransport()` and
 * `parseInterviewReply()` as in production), Confirm and rank (`confirmAiProposal()`: the form,
 * `toBrief()`, pending, confirmed) and the Phase 1 `rank()`.
 *
 * What these tests prove, and what they don't: the AI's replies are scripted
 * (`__fixtures__/walkthroughs/ai-*.json`), so they don't test whether a real model maps "welding
 * supplies" to Fabrication. They prove that, **given** those replies, the reply check, the
 * confirm path and ranking give exactly the Phase 1 results: the same brief, the same counts and
 * the same shortlist, row for row, as the TR-30 golden files. A difference there means the AI
 * path isn't producing the same brief, which is a bug: never edit a golden file to make it pass.
 * How a real model behaves is checked by hand (docs/translator/QA-CHECKLIST.md).
 *
 * The fake is strict: a message no script line matches throws, so a conversation can't pass on
 * the wrong reply. No test here can reach OpenAI (vitest.setup.ts).
 */

let file: LoadedFile;
let summary: FileSummary;

beforeAll(async () => {
  file = await loadFile(toArrayBuffer(readFileSync(SAMPLE_PATH)));
  summary = buildFileSummary(file.records, file.importState.parsed.layout.id);
});

type InterviewTurn = Extract<InterviewResult, { ok: true }>;

/**
 * One conversation, as the chat panel runs it: for each message, `send`, the request the panel
 * builds (`buildChatRequest()`, with `currentBrief` from `currentBriefFor()`), the interview turn
 * with the fake AI, then `received` (after `settleRevision()` on the Results step, as there).
 * Returns every turn's result and the final chat state.
 */
async function converse(
  ai: FakeAi,
  messages: readonly string[],
  { mode = "criteria", base = null }: { mode?: ChatMode; base?: SearchBrief | null } = {},
): Promise<{ turns: InterviewTurn[]; state: ChatState }> {
  let state = initialChatState(mode === "revise" ? REVISE_TEXT.opening : undefined);
  const turns: InterviewTurn[] = [];
  for (const text of messages) {
    state = chatReducer(state, { type: "send", text });
    const currentBrief = currentBriefFor(state, base, mode);
    const request = buildChatRequest(state, summary, currentBrief);
    const turn = await runInterviewTurn(
      { summary: request.summary, messages: request.messages, currentBrief: request.currentBrief },
      ai,
    );
    if (!turn.ok) throw new Error(`the interview turn for "${text}" failed: ${turn.code}`);
    turns.push(turn);
    const received = { type: "received" as const, reply: turn.reply, note: turn.note, proposal: turn.proposal };
    const outcome = mode === "revise" ? settleRevision(received, currentBrief) : received;
    state = chatReducer(state, { ...outcome, requestId: state.requestId });
  }
  return { turns, state };
}

const BUSINESS_OWNER_MESSAGES = AI_CONVERSATIONS.businessOwner.messages;

/** The business owner conversation with a fresh fake, its proposal confirmed and ranked. */
async function businessOwnerConfirmed() {
  const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.businessOwner.script));
  const conversation = await converse(ai, BUSINESS_OWNER_MESSAGES);
  const proposal = proposalOf(conversation, "business owner conversation");
  return { ai, ...conversation, proposal, ...confirmAiProposal(proposal, file) };
}

/** The proposal the conversation ended with. Throws with the last note (why a proposal was dropped) when there is none. */
function proposalOf({ turns, state }: { turns: InterviewTurn[]; state: ChatState }, name: string): SearchBrief {
  if (state.proposal) return state.proposal;
  throw new Error(`The ${name} ended without a proposal. Last note: ${turns.at(-1)?.note ?? "none"}`);
}

/** "SYN-0001 100": a row's Record ID and display score. */
const idAndScore = (row: ShortlistRow | undefined) => row && `${row.record.normalized.recordId} ${row.displayScore}`;

describe("business owner: welding supplies, customers in Phoenix", () => {
  let run: Awaited<ReturnType<typeof businessOwnerConfirmed>>;
  beforeAll(async () => {
    run = await businessOwnerConfirmed();
  });

  it("asks two follow-up questions, then proposes exactly the business owner brief", () => {
    expect(run.ai.calls).toHaveLength(3);
    expect(run.turns.map((turn) => turn.proposal === null)).toEqual([true, true, false]);
    expect(run.turns.map((turn) => turn.note)).toEqual([null, null, null]);
    expect(run.proposal).toStrictEqual(BUSINESS_OWNER_BRIEF);
  });

  it("sends the whole conversation each turn, the greeting first", () => {
    const last = run.ai.calls[2].messages;
    expect(last.filter((message) => message.role === "user").map((message) => message.content)).toEqual([
      ...BUSINESS_OWNER_MESSAGES,
    ]);
    expect(last[0].role).toBe("assistant");
  });

  it("Confirm and rank: 500 read, 499 unique, 100 eligible, 40 exported", () => {
    expect(run.confirmedBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
    expect(run.counts).toMatchObject({ rowsRead: 500, uniqueRecords: 499, eligible: 100, exported: 40 });
  });

  it("puts SYN-0001 first at 100", () => {
    expect(idAndScore(run.rankResult.shortlist[0])).toBe("SYN-0001 100");
  });

  it("gives the TR-30 business owner golden file, row for row", () => {
    expect(goldenRows(run.rankResult)).toEqual(businessOwnerGolden);
  });
});

describe("role change: prefer operations managers instead", () => {
  let before: Awaited<ReturnType<typeof businessOwnerConfirmed>>;
  let ai: FakeAi;
  let proposal: SearchBrief;
  beforeAll(async () => {
    before = await businessOwnerConfirmed();
    ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.roleChange.script));
    const conversation = await converse(ai, AI_CONVERSATIONS.roleChange.messages, { mode: "revise", base: before.confirmedBrief });
    proposal = proposalOf(conversation, "role change");
  });

  it("sends the confirmed brief in the Current brief data block", () => {
    expect(ai.calls).toHaveLength(1);
    const block = `## ${CURRENT_BRIEF_LABEL}\n${DATA_ONLY_NOTE}\n\`\`\`json\n${JSON.stringify(before.confirmedBrief)}\n\`\`\``;
    expect(ai.calls[0].instructions).toContain(block);
  });

  it("changes exactly one thing: the title preference, Owner to Operations Manager", () => {
    expect(diffBriefs(before.confirmedBrief, proposal)).toEqual([
      {
        kind: "changed",
        part: "preferences",
        field: "title",
        before: "Owner",
        after: "Operations Manager",
        text: "Title preference: Owner to Operations Manager",
      },
    ]);
  });

  it("after Confirm and rank, puts SYN-0006 first at 100 and gives the TR-30 role change golden file", () => {
    const after = confirmAiProposal(proposal, file);
    expect(idAndScore(after.rankResult.shortlist[0])).toBe("SYN-0006 100");
    expect(goldenRows(after.rankResult)).toEqual(roleChangeGolden);
  });

  it("explains the change in exactly the TR-47 sentences", () => {
    const after = confirmAiProposal(proposal, file);
    const changes = diffBriefs(before.confirmedBrief, proposal);
    expect(explainChange({ before: before.rankResult, after: after.rankResult, changes })).toEqual([
      "Synthetic Company 0006 (SYN-0006) is now #1 with score 100: Title: Operations Manager (preferred). It's tied with 5 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) is now #7 with score 64: Title: Owner (not preferred).",
    ]);
  });
});

describe("job seeker: logistics employers in Tempe", () => {
  let ai: FakeAi;
  let turns: InterviewTurn[];
  let proposal: SearchBrief;
  beforeAll(async () => {
    ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.jobSeeker.script));
    const conversation = await converse(ai, AI_CONVERSATIONS.jobSeeker.messages);
    turns = conversation.turns;
    proposal = proposalOf(conversation, "job seeker conversation");
  });

  it("asks one follow-up question, then proposes exactly the job seeker brief", () => {
    expect(ai.calls).toHaveLength(2);
    expect(turns.map((turn) => turn.proposal === null)).toEqual([true, false]);
    expect(proposal).toStrictEqual(JOB_SEEKER_BRIEF);
  });

  it("Confirm and rank: 100 eligible, 30 exported, SYN-0002 first at 100, the TR-30 job seeker golden file", () => {
    const { counts, rankResult } = confirmAiProposal(proposal, file);
    expect(counts).toMatchObject({ eligible: 100, exported: 30 });
    expect(idAndScore(rankResult.shortlist[0])).toBe("SYN-0002 100");
    expect(goldenRows(rankResult)).toEqual(jobSeekerGolden);
  });
});

describe("ambiguous answer: Phoenix area", () => {
  it("gets a choice question naming 2 to 4 cities from the summary, no proposal and nothing to rank", async () => {
    const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.ambiguous.script));
    const { turns, state } = await converse(ai, AI_CONVERSATIONS.ambiguous.messages);
    const [turn] = turns;

    expect(turn.proposal).toBeNull();
    expect(turn.note).toBeNull();
    // No proposal means no card, so there is nothing to Confirm and rank.
    expect(state.proposal).toBeNull();

    // The question ends with its choices: "...: Phoenix, Glendale, Mesa or Tempe?"
    expect(turn.reply.endsWith("?")).toBe(true);
    const choices = turn.reply.slice(turn.reply.lastIndexOf(":") + 1, -1).trim().split(/, | or /);
    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices.length).toBeLessThanOrEqual(4);
    const cities = summary.cities.map((city) => city.value);
    for (const choice of choices) expect(cities).toContain(choice);
  });
});

describe("values checked against the file", () => {
  it("drops a proposal for Flagstaff, which isn't in the file, with the note", async () => {
    const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.notInFile.script));
    const { turns, state } = await converse(ai, AI_CONVERSATIONS.notInFile.messages);

    expect(turns[0].proposal).toBeNull();
    expect(turns[0].note).toBe(`I couldn't use "Flagstaff" because it's not in this file.`);
    expect(turns[0].note).toBe(VALIDATE_TEXT.notInFile(["Flagstaff"]));
    expect(state.proposal).toBeNull();
  });

  it("accepts Scottsdale (99 rows in the sample), written as the summary spells it (control)", async () => {
    const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.inFile.script));
    const { turns } = await converse(ai, AI_CONVERSATIONS.inFile.messages);

    expect(summary.cities).toContainEqual({ value: "Scottsdale", count: 99 });
    expect(turns[0].note).toBeNull();
    expect(turns[0].proposal).toStrictEqual({
      ...BUSINESS_OWNER_BRIEF,
      mustHaves: [
        { field: "city", operator: "equals", value: "Scottsdale" },
        { field: "state", operator: "equals", value: "AZ" },
      ],
    });
  });
});

describe("intro draft for SYN-0001", () => {
  it("replaces the invented email with [contact details] and sends only the six intro fields", async () => {
    const { rankResult, confirmedBrief } = await businessOwnerConfirmed();
    const row = rankResult.shortlist.find((r) => r.record.normalized.recordId === "SYN-0001");
    if (!row) throw new Error("SYN-0001 isn't in the shortlist");
    const picked = pickIntroFields(row);
    if (!picked.ok) throw new Error(picked.error);

    const ai = createScriptedAi(loadAiScript("intro"));
    const result = await runIntroDraft({ intro: picked.intro, intent: confirmedBrief.intent }, ai);

    expect(result).toEqual({
      ok: true,
      kind: "intro",
      draft:
        "Hello, I run a small welding supply business in Phoenix and work with fabrication shops like Synthetic Company 0001. I would like to introduce our products and learn what your team uses today. You can reach me at [contact details]. Would you have fifteen minutes next week for a short call? Thank you for your time.",
    });

    expect(ai.calls).toHaveLength(1);
    const [call] = ai.calls;
    expect(call.format).toBe("text");
    expect(call.messages).toEqual([
      { role: "user", content: buildIntroMessage({ intro: picked.intro, intent: confirmedBrief.intent }) },
    ]);
    const content = call.messages[0].content;
    const facts = JSON.parse(content.slice(content.indexOf("```json\n") + 8, content.lastIndexOf("\n```")));
    expect(Object.keys(facts).sort()).toEqual(["city", "company", "contactName", "contactTitle", "industry", "state"]);
    expect(facts).toEqual(picked.intro);
    expect(content).not.toContain("SYN-0001");
    expect(content).not.toContain("@");
  });
});
