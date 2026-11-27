import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { type AiConversation, AI_CONVERSATIONS } from "../__fixtures__/ai-conversations";
import { createChatDriver, createRouteHarness, requestIntro, type RouteHarness } from "../__fixtures__/ai-harness";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { createScriptedAi, type FakeAi, loadAiScript } from "../__fixtures__/fake-ai";
import { type LoadedFile, loadFile } from "../__fixtures__/pipeline";
import { RS_SAMPLE_PATH, SAMPLE_PATH } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import type { GroupedRecord } from "../normalize/duplicates";
import { buildIntroMessage, pickIntroFields } from "./intro";
import { buildFileSummary, type FileSummary } from "./summary";

/**
 * Privacy tests (TR-54): nothing from a row leaves the browser except the file summary (for the
 * interview) and the six intro fields of one chosen business (for an intro), as the README's
 * "What is sent to the AI" says. Each test runs the browser and the route together
 * (`__fixtures__/ai-harness.ts`) and reads both ends: every request body the browser sent to
 * `/api/translator/ai`, and every call the route made to the AI (recorded by the fake AI).
 * Both committed samples are used: the Reference Solutions sample is the one with phones,
 * websites, addresses, ZIP codes, NAICS text and other executives. These tests are the
 * evidence for the privacy note in the docs (TR-55).
 */

type Sample = { file: LoadedFile; summary: FileSummary };

let synthetic: Sample;
let referenceSolutions: Sample;
let consoleError: MockInstance<typeof console.error>;

async function loadSample(path: string): Promise<Sample> {
  const file = await loadFile(toArrayBuffer(readFileSync(path)));
  return { file, summary: buildFileSummary(file.records, file.importState.parsed.layout.id) };
}

beforeAll(async () => {
  synthetic = await loadSample(SAMPLE_PATH);
  referenceSolutions = await loadSample(RS_SAMPLE_PATH);
});

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Nothing but a fixed code is ever logged; these runs all succeed, so nothing at all.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

/** The row-level values that must never be sent: a value per field, with the field's name. */
type PrivateValue = { field: string; value: string; recordId: string };

/**
 * Every private value of `records`: Record IDs (and the IDs grouped under them), company, contact
 * name, email, phone, website, address, ZIP code, NAICS text and the other executives' names.
 * `except` leaves out one record's company and contact name, which its intro sends on purpose.
 */
function privateValues(records: readonly GroupedRecord[], except?: string): PrivateValue[] {
  const values: PrivateValue[] = [];
  for (const { normalized, duplicateIds } of records) {
    const { recordId } = normalized;
    const add = (field: string, value: string | null) => {
      if (value) values.push({ field, value, recordId });
    };
    add("recordId", recordId);
    for (const id of duplicateIds) add("recordId", id);
    const fields = ["email", "phone", "website", "address", "zip", "naicsDescription"] as const;
    for (const field of [...fields, ...(recordId === except ? [] : (["company", "name"] as const))]) {
      const text = normalized[field];
      if (text.known) add(field, text.value);
    }
    for (const executive of normalized.otherExecutives) add("otherExecutives", executive.name);
  }
  return values;
}

/** Everything that left the browser and everything the AI got, as text. */
function everythingSent(harness: RouteHarness, ais: readonly FakeAi[]): string[] {
  return [
    ...harness.bodies,
    ...ais.flatMap((ai) => ai.calls.flatMap((call) => [call.instructions, ...call.messages.map((message) => message.content)])),
  ];
}

/** The private values found in any of `texts`. Empty when nothing leaked. */
function leaks(texts: readonly string[], values: readonly PrivateValue[]): PrivateValue[] {
  return values.filter(({ value }) => texts.some((text) => text.includes(value)));
}

/** Runs a TR-53 conversation through the browser and the route, as its step's chat would. */
async function replay(conversation: AiConversation, harness: RouteHarness, summary: FileSummary) {
  const chat = createChatDriver(
    harness,
    summary,
    conversation.step === "results" ? { mode: "revise", base: BUSINESS_OWNER_BRIEF } : {},
  );
  for (const message of conversation.messages) await chat.send(message);
  return chat.state;
}

describe("privacy: interview never sends row data", () => {
  it("in every TR-53 conversation on the synthetic sample: no Record ID, company, contact name or email", async () => {
    const values = privateValues(synthetic.file.records);
    // Guard: the check has real values to look for.
    expect(new Set(values.map((value) => value.field))).toEqual(new Set(["recordId", "company", "name", "email"]));

    for (const conversation of Object.values(AI_CONVERSATIONS)) {
      const ai = createScriptedAi(loadAiScript(conversation.script));
      const harness = createRouteHarness(ai);
      await replay(conversation, harness, synthetic.summary);

      expect(harness.bodies.length, conversation.script).toBe(conversation.messages.length);
      expect(leaks(everythingSent(harness, [ai]), values), conversation.script).toEqual([]);
    }
  });

  it("on the Reference Solutions sample: no IUSA number, company, contact, phone, website, address, ZIP, NAICS text or executive", async () => {
    const values = privateValues(referenceSolutions.file.records);
    expect(new Set(values.map((value) => value.field))).toEqual(
      new Set(["recordId", "company", "name", "phone", "website", "address", "zip", "naicsDescription", "otherExecutives"]),
    );

    const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.ambiguous.script));
    const harness = createRouteHarness(ai);
    await replay(AI_CONVERSATIONS.ambiguous, harness, referenceSolutions.summary);

    expect(ai.calls).toHaveLength(1);
    expect(leaks(everythingSent(harness, [ai]), values)).toEqual([]);
  });

  it("sends exactly kind, summary and messages (and currentBrief on the Results step), and the summary as built", async () => {
    for (const conversation of [AI_CONVERSATIONS.businessOwner, AI_CONVERSATIONS.roleChange]) {
      const harness = createRouteHarness(createScriptedAi(loadAiScript(conversation.script)));
      await replay(conversation, harness, synthetic.summary);
      for (const text of harness.bodies) {
        const body = JSON.parse(text);
        // The business owner chat has no proposal until its last reply, so none of its requests
        // carries a currentBrief; the Results step's always carries the confirmed brief.
        if (conversation.step === "results") {
          expect(Object.keys(body).sort()).toEqual(["currentBrief", "kind", "messages", "summary"]);
          expect(body.currentBrief).toStrictEqual(BUSINESS_OWNER_BRIEF);
        } else {
          expect(Object.keys(body).sort()).toEqual(["kind", "messages", "summary"]);
        }
        expect(body.summary).toEqual(synthetic.summary);
        for (const message of body.messages) expect(Object.keys(message).sort()).toEqual(["content", "role"]);
      }
    }
  });
});

describe("privacy: intro sends only the six intro fields of the chosen business", () => {
  /** The Reference Solutions record with the most private values: phone, website, address, executives. */
  function fullestRecord(): GroupedRecord {
    const scored = referenceSolutions.file.records.map((record) => ({
      record,
      count: privateValues([record]).length,
    }));
    scored.sort((a, b) => b.count - a.count);
    return scored[0].record;
  }

  it("the request holds exactly kind, the six intro fields, the intent and the goal, nothing else", async () => {
    const record = fullestRecord();
    const picked = pickIntroFields({ record });
    if (!picked.ok) throw new Error(picked.error);
    const ai = createScriptedAi(loadAiScript("intro-any"));
    const harness = createRouteHarness(ai);

    const outcome = await requestIntro(harness, picked.intro, "business_owner", "  I sell welding supplies.  ");

    expect(harness.bodies).toHaveLength(1);
    const body = JSON.parse(harness.bodies[0]);
    expect(body).toStrictEqual({ kind: "intro", intro: picked.intro, intent: "business_owner", goal: "I sell welding supplies." });
    expect(Object.keys(body.intro).sort()).toEqual(["city", "company", "contactName", "contactTitle", "industry", "state"]);

    // The AI got one message: the six fields as data, the goal line and the note. Nothing else.
    expect(ai.calls).toHaveLength(1);
    expect(ai.calls[0].messages).toEqual([
      { role: "user", content: buildIntroMessage({ intro: picked.intro, intent: "business_owner", goal: "I sell welding supplies." }) },
    ]);

    // Neither end holds this record's phone, website, address, ZIP, NAICS text, executives or ID,
    // nor anything from any other record.
    expect(leaks(everythingSent(harness, [ai]), privateValues(referenceSolutions.file.records, record.normalized.recordId))).toEqual([]);
    // The invented phone and website in the draft are replaced before it reaches the panel.
    expect(outcome.type).toBe("received");
    expect(outcome.type === "received" && outcome.draft).toBe(
      "Hello, I would like to introduce my business and learn about yours. Call me at [contact details] or visit [contact details] to see what we do. Would you have time for a short call next week? Thank you. [Your name]",
    );
  });

  it("leaves the goal out when the note is blank", async () => {
    const picked = pickIntroFields({ record: fullestRecord() });
    if (!picked.ok) throw new Error(picked.error);
    const harness = createRouteHarness(createScriptedAi(loadAiScript("intro-any")));
    await requestIntro(harness, picked.intro, "job_seeker", "   ");
    expect(Object.keys(JSON.parse(harness.bodies[0])).sort()).toEqual(["intent", "intro", "kind"]);
  });

  it("the SYN-0001 intro from TR-53 sends no Record ID, email or other business", async () => {
    const record = synthetic.file.records.find((r) => r.normalized.recordId === "SYN-0001");
    if (!record) throw new Error("SYN-0001 is missing");
    const picked = pickIntroFields({ record });
    if (!picked.ok) throw new Error(picked.error);
    const ai = createScriptedAi(loadAiScript("intro"));
    const harness = createRouteHarness(ai);
    await requestIntro(harness, picked.intro, "business_owner");
    expect(leaks(everythingSent(harness, [ai]), privateValues(synthetic.file.records, "SYN-0001"))).toEqual([]);
  });
});

describe("privacy: the file summary has no row-level keys", () => {
  // Written out on purpose, not a Vitest snapshot (the project has none): adding a key to the
  // summary must be a deliberate change to this list, with a reason in the PR.
  const SUMMARY_KEYS = ["cities", "employees", "industries", "layout", "states", "titles", "truncated", "uniqueRecords"];
  const LIST_KEYS = ["cities", "industries", "states", "titles"] as const;

  it.each([
    ["synthetic", () => synthetic.summary],
    ["Reference Solutions", () => referenceSolutions.summary],
  ])("has exactly the summary's keys for the %s sample, at every level", (_, summaryOf) => {
    const summary = summaryOf();
    expect(Object.keys(summary).sort()).toEqual(SUMMARY_KEYS);
    expect(Object.keys(summary.employees).sort()).toEqual(["blank", "max", "min", "withValue"]);
    expect(Object.keys(summary.truncated).sort()).toEqual([...LIST_KEYS]);
    for (const list of LIST_KEYS) {
      expect(summary[list].length, list).toBeGreaterThan(0);
      for (const item of summary[list]) expect(Object.keys(item).sort()).toEqual(["count", "value"]);
    }
  });

  it.each([
    ["synthetic", () => synthetic],
    ["Reference Solutions", () => referenceSolutions],
  ])("holds no private value from the %s sample", (_, sampleOf) => {
    const { file, summary } = sampleOf();
    expect(leaks([JSON.stringify(summary)], privateValues(file.records))).toEqual([]);
  });
});
