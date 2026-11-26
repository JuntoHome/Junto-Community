import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { importWorkbook } from "./__fixtures__/import-pipeline";
import { SAMPLE_PATH } from "./__fixtures__/records";
import {
  buildChatRequest,
  buildFileSummary,
  chatReducer,
  currentBriefFor,
  diffBriefs,
  explainChange,
  type FileSummary,
  initialChatState,
  REVISE_TEXT,
  settleRevision,
} from "./ai";
import { runInterviewTurn } from "./ai/interview";
import type { AiCall } from "./ai/types";
import { parseInterviewReply } from "./ai/validate";
import { briefChips, removeChip } from "./criteria/chips";
import { BUSINESS_OWNER_BRIEF } from "./criteria/examples";
import {
  type CriteriaForm,
  EMPTY_CRITERIA_FORM,
  type MustHaveField,
  type PickerOption,
  setPreferenceMode,
  toBrief,
} from "./criteria/from-form";
import type { SearchBrief } from "./criteria/schema";
import { briefToFormState } from "./criteria/to-form";
import type { GroupedRecord } from "./normalize/duplicates";
import { fieldOptions } from "./normalize/field-options";
import { rank } from "./ranking";

/**
 * The AI path equals the form path (TR-45). A business owner brief from the AI goes through the
 * reply check (`parseInterviewReply`, with the synthetic sample's summary), the chat state and
 * the proposal card's Confirm and rank (what `TranslatorWizard` does with it), then `rank()`.
 * The same choices made in the Phase 1 form go through `toBrief()` and `rank()`. Both must give
 * the same shortlist, row for row: SYN-0001 first at 100, as in the Phase 1 walkthrough.
 */

let records: readonly GroupedRecord[];
let summary: FileSummary;
let options: Record<MustHaveField, PickerOption[]>;

beforeAll(async () => {
  const bytes = readFileSync(SAMPLE_PATH);
  const { workbook, grouping } = await importWorkbook(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  records = grouping.records;
  summary = buildFileSummary(records, workbook.layout.id);
  options = {
    city: fieldOptions(records, "city"),
    state: fieldOptions(records, "state"),
    industry: fieldOptions(records, "industry"),
    title: fieldOptions(records, "title"),
  };
});

/** The picker key for a label, as the form stores a picked value. */
const key = (field: MustHaveField, label: string) => {
  const option = options[field].find((o) => o.label === label);
  if (!option) throw new Error(`no ${field} option "${label}"`);
  return option.key;
};

/** The AI's proposal for `brief`, as it reaches the proposal card: reply check, then the chat state. */
function proposalFromAi(brief: SearchBrief): SearchBrief {
  // As OpenAI sends it: JSON text, with priorityOrder null for "not given".
  const raw = JSON.stringify({ message: "Here is what I understood.", proposal: { ...brief, priorityOrder: brief.priorityOrder ?? null } });
  const parsed = parseInterviewReply(raw, summary);
  if (!parsed.ok || !parsed.reply.proposal) throw new Error("the AI's proposal didn't pass the check");
  let state = chatReducer(initialChatState(), { type: "send", text: "owners in Phoenix, fabrication, 10 to 99 employees, 40 results" });
  state = chatReducer(state, {
    type: "received",
    requestId: state.requestId,
    reply: parsed.reply.message,
    note: parsed.note,
    proposal: parsed.reply.proposal,
  });
  if (!state.proposal) throw new Error("no proposal in the chat state");
  return state.proposal;
}

/**
 * Confirm and rank on the card, as `TranslatorWizard` does it: the form becomes
 * `briefToFormState(proposal)`, and the pending and confirmed brief are the proposal itself.
 * Returns the confirmed brief and the form the criteria summary's editors start from.
 */
function confirmFromCard(proposal: SearchBrief): { confirmed: SearchBrief; form: CriteriaForm } {
  return { confirmed: proposal, form: briefToFormState(proposal) };
}

/** The business owner walkthrough as a user fills in the Phase 1 form. */
function businessOwnerForm(): CriteriaForm {
  return {
    ...EMPTY_CRITERIA_FORM,
    intent: "business_owner",
    mustHaves: { city: [key("city", "Phoenix")], state: [key("state", "AZ")], industry: [], title: [] },
    preferences: {
      industry: { mode: "prefer", picked: [key("industry", "Fabrication")] },
      title: { mode: "prefer", picked: [key("title", "Owner")] },
      employees: { mode: "prefer", from: "10", to: "99" },
    },
    listSize: "40",
  };
}

function formBrief(form: CriteriaForm): SearchBrief {
  const result = toBrief(form, options);
  if (!result.ok) throw new Error("the form didn't give a brief");
  return result.brief;
}

/** What a shortlist row shows, to compare two shortlists. */
const rows = (brief: SearchBrief) =>
  rank(records, brief).shortlist.map((row) => ({
    rank: row.rank,
    recordId: row.record.normalized.recordId,
    score: row.score,
    displayScore: row.displayScore,
    reasonText: row.reasonText,
  }));

describe("AI path = form path", () => {
  it("ranks the business owner brief from the AI exactly as the form's: SYN-0001 first at 100", () => {
    const { confirmed, form } = confirmFromCard(proposalFromAi(BUSINESS_OWNER_BRIEF));
    const fromForm = formBrief(businessOwnerForm());

    expect(confirmed).toEqual(fromForm);
    // The criteria summary's editors start from this form, and it gives back the same brief.
    expect(formBrief(form)).toEqual(confirmed);

    const ai = rows(confirmed);
    expect(ai).toEqual(rows(fromForm));
    expect(ai).toHaveLength(40);
    expect(ai[0]).toMatchObject({ rank: 1, recordId: "SYN-0001", displayScore: 100 });
  });

  it("ranks the brief with Title: Owner removed exactly as the form with No preference for title", () => {
    const proposal = proposalFromAi(BUSINESS_OWNER_BRIEF);
    const title = briefChips(proposal)
      .flatMap((group) => group.chips)
      .find((chip) => chip.label === "Title: Owner");
    const { confirmed } = confirmFromCard(removeChip(proposal, title?.id ?? ""));
    const fromForm = formBrief(setPreferenceMode(businessOwnerForm(), "title", "none"));

    expect(confirmed.preferences.map((c) => c.field)).toEqual(["industry", "employees"]);
    expect(confirmed).toEqual(fromForm);
    expect(rows(confirmed)).toEqual(rows(fromForm));
  });
});

/**
 * Change one thing through chat (TR-46), with a fake AI. The business owner brief is confirmed;
 * the Results step's chat sends "favor operations managers instead" with that brief as
 * `currentBrief`; the fake AI answers with the brief changed to title Operations Manager, which
 * goes through the real interview turn and reply check; the diff has exactly that one change;
 * Confirm and rank ranks the proposal: the Phase 1 role change walkthrough.
 */
describe("Change one thing through chat", () => {
  /** A fake AI call that answers with `proposal`, and records what it was given. */
  function fakeAi(proposal: SearchBrief) {
    const calls: Parameters<AiCall>[0][] = [];
    const call: AiCall = async (input) => {
      calls.push(input);
      return { ok: true, value: JSON.stringify({ message: "I changed the title preference.", proposal: { ...proposal, priorityOrder: null } }) };
    };
    return { call, calls };
  }

  const opsManager: SearchBrief = {
    ...BUSINESS_OWNER_BRIEF,
    preferences: BUSINESS_OWNER_BRIEF.preferences.map((c) =>
      c.field === "title" ? { field: "title", operator: "equals", value: "Operations Manager" } : c,
    ),
  };

  /** One revise turn: the request the panel builds, the fake AI, the reply check and settleRevision. */
  async function reviseTurn(confirmed: SearchBrief, answer: SearchBrief) {
    let state = chatReducer(initialChatState(REVISE_TEXT.opening), { type: "send", text: "favor operations managers instead" });
    const currentBrief = currentBriefFor(state, confirmed, "revise");
    const request = buildChatRequest(state, summary, currentBrief);
    const ai = fakeAi(answer);
    const turn = await runInterviewTurn({ summary: request.summary, messages: request.messages, currentBrief: request.currentBrief }, ai.call);
    if (!turn.ok) throw new Error("the interview turn failed");
    const outcome = settleRevision({ type: "received", reply: turn.reply, note: turn.note, proposal: turn.proposal }, currentBrief);
    state = chatReducer(state, { ...outcome, requestId: state.requestId });
    return { state, request, calls: ai.calls };
  }

  it("proposes only the title change, and after Confirm SYN-0006 is first at 100 with the six 100s in TR-30 order", async () => {
    const confirmed = formBrief(businessOwnerForm());
    const before = rank(records, confirmed);
    const { state, request, calls } = await reviseTurn(confirmed, opsManager);

    expect(Object.keys(request).sort()).toEqual(["currentBrief", "kind", "messages", "summary"]);
    expect(request.currentBrief).toBe(confirmed);
    expect(request.messages[0]).toEqual({ role: "assistant", content: "Want to change something? Tell me." });
    expect(calls[0].instructions).toContain('"value":"Owner"');

    const proposal = state.proposal;
    if (!proposal) throw new Error("no proposal");
    expect(diffBriefs(confirmed, proposal).map((change) => change.text)).toEqual(["Title preference: Owner to Operations Manager"]);
    // Nothing is re-ranked before Confirm: the results still come from the confirmed brief.
    expect(before.shortlist[0].record.normalized.recordId).toBe("SYN-0001");

    // Confirm and rank: the wizard's confirmAiBrief() ranks the proposal itself.
    expect(formBrief(briefToFormState(proposal))).toEqual(proposal);
    const after = rank(records, proposal);
    const hundreds = after.shortlist.filter((row) => row.displayScore === 100).map((row) => row.record.normalized.recordId);
    expect(after.shortlist[0]).toMatchObject({ displayScore: 100 });
    expect(hundreds).toEqual(["SYN-0006", "SYN-0026", "SYN-0126", "SYN-0226", "SYN-0326", "SYN-0426"]);
    // TR-47: the note the Results chat gets after Confirm, from the results before and after.
    expect(explainChange({ before, after, changes: diffBriefs(confirmed, proposal) })).toEqual([
      "Synthetic Company 0006 (SYN-0006) is now #1 with score 100: Title: Operations Manager (preferred). It's tied with 5 others at 100; ties are ordered by Record ID.",
      "Synthetic Company 0001 (SYN-0001) is now #7 with score 64: Title: Owner (not preferred).",
    ]);
  });

  it("gives the nothing-to-update note and no card when the AI changes nothing", async () => {
    const confirmed = formBrief(businessOwnerForm());
    const { state } = await reviseTurn(confirmed, confirmed);
    expect(state.proposal).toBeNull();
    expect(state.items.at(-1)).toMatchObject({ role: "note", content: "Your criteria are the same, so nothing to update." });
  });

  it("keeps pins through the change: SYN-0496 stays first", async () => {
    const confirmed = formBrief(businessOwnerForm());
    const { state } = await reviseTurn(confirmed, opsManager);
    const overrides = { pinned: ["SYN-0496"], omitted: [] };
    expect(rank(records, confirmed, overrides).shortlist[0].record.normalized.recordId).toBe("SYN-0496");
    const after = rank(records, state.proposal ?? confirmed, overrides);
    expect(after.shortlist.map((row) => row.record.normalized.recordId).slice(0, 2)).toEqual(["SYN-0496", "SYN-0006"]);
    expect(after.droppedPins).toEqual([]);
  });
});
