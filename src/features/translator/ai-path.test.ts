import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { importWorkbook } from "./__fixtures__/import-pipeline";
import { SAMPLE_PATH } from "./__fixtures__/records";
import { buildFileSummary, chatReducer, type FileSummary, initialChatState } from "./ai";
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
