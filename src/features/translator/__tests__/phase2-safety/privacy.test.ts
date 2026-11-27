import { readFileSync } from "node:fs";
import { afterEach, beforeAll, beforeEach, expect, it, type MockInstance, vi } from "vitest";
import { type AiConversation, AI_CONVERSATIONS } from "../../__fixtures__/ai-conversations";
import { createChatDriver, createRouteHarness, requestIntro, type RouteHarness } from "../../__fixtures__/ai-harness";
import { toArrayBuffer } from "../../__fixtures__/build-workbook";
import { createScriptedAi, type FakeAi, loadAiScript } from "../../__fixtures__/fake-ai";
import { importRows, importWorkbook } from "../../__fixtures__/import-pipeline";
import { RS_CONTACT_ROWS, RS_SAMPLE_PATH, rsSheet, SAMPLE_PATH, syntheticRow, syntheticSheet } from "../../__fixtures__/records";
import { fullRsRecord } from "../../__fixtures__/rs-row";
import { buildIntroMessage, pickIntroFields, type IntroSource } from "../../ai/intro";
import { buildFileSummary, type FileSummary } from "../../ai/summary";
import { BUSINESS_OWNER_BRIEF } from "../../criteria/examples";
import type { GroupedRecord } from "../../normalize/duplicates";
import type { NormalizedRecord } from "../../normalize/types";

/**
 * Phase 2 safety evidence: privacy (TR-54). Nothing from a row leaves the browser except the file
 * summary (for the interview) and the six intro fields of one chosen business (for an intro), as
 * the README's "What is sent to the AI" says.
 *
 * The **forbidden values** are every Record ID (grouped IDs too), company name, person name (main
 * contact and other executives), phone, email, website, address, ZIP code and NAICS text of three
 * files: the synthetic sample, the Reference Solutions sample and invented Reference Solutions
 * rows (`RS_CONTACT_ROWS`). Each test runs the browser and the route together
 * (`__fixtures__/ai-harness.ts`) and reads both ends: every request body sent to
 * `/api/translator/ai` and every call the route made to the fake AI. These tests are the evidence
 * for the privacy note (TR-55).
 *
 * Moved here: the summary's "contains no company, person, ID..." tests (`ai/summary.test.ts`,
 * TR-40) and the six-keys test of a full Reference Solutions row (`ai/intro.test.ts`, TR-48).
 */

type File = { name: string; records: readonly GroupedRecord[]; summary: FileSummary };

let files: File[];
let consoleError: MockInstance<typeof console.error>;

async function fileFrom(name: string, imported: Awaited<ReturnType<typeof importWorkbook>>): Promise<File> {
  const records = imported.grouping.records;
  return { name, records, summary: buildFileSummary(records, imported.workbook.layout.id) };
}

beforeAll(async () => {
  files = [
    await fileFrom("synthetic sample", await importWorkbook(toArrayBuffer(readFileSync(SAMPLE_PATH)))),
    await fileFrom("Reference Solutions sample", await importWorkbook(toArrayBuffer(readFileSync(RS_SAMPLE_PATH)))),
    await fileFrom("invented Reference Solutions rows", await importRows(rsSheet(RS_CONTACT_ROWS))),
  ];
});

beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Every run here succeeds, so nothing at all is logged (and never content: guardrails.test.ts).
  // Restored first, so a failure here can't carry over into the next test.
  const calls = [...consoleError.mock.calls];
  consoleError.mockRestore();
  expect(calls).toEqual([]);
});

/** One forbidden value: what it is and whose. */
type Forbidden = { field: string; value: string; recordId: string };

const CONTACT_FIELDS = ["email", "phone", "website", "address", "zip", "naicsDescription"] as const;

/** Every forbidden value of one record. */
function forbiddenOf(record: Pick<GroupedRecord, "normalized"> & { duplicateIds?: readonly string[] }): Forbidden[] {
  const normalized: NormalizedRecord = record.normalized;
  const { recordId } = normalized;
  const values: Forbidden[] = [];
  const add = (field: string, value: string | null) => {
    if (value) values.push({ field, value, recordId });
  };
  add("recordId", recordId);
  for (const id of record.duplicateIds ?? []) add("recordId", id);
  for (const field of ["company", "name", ...CONTACT_FIELDS] as const) {
    const text = normalized[field];
    if (text.known) add(field, text.value);
  }
  for (const executive of normalized.otherExecutives) add("otherExecutives", executive.name);
  return values;
}

/** The forbidden values of every record in the three files. */
const allForbidden = () => files.flatMap((file) => file.records.flatMap(forbiddenOf));

/** Everything that left the browser and everything the AI got, each as JSON text. */
function everythingSent(harness: RouteHarness, ais: readonly FakeAi[]): string[] {
  return [...harness.bodies, ...ais.flatMap((ai) => ai.calls.map((call) => JSON.stringify(call)))];
}

/** The forbidden values found in any of `texts`. Empty when nothing leaked. */
function leaks(texts: readonly string[], forbidden: readonly Forbidden[]): Forbidden[] {
  return forbidden.filter(({ value }) => texts.some((text) => text.includes(value) || text.includes(JSON.stringify(value).slice(1, -1))));
}

/** Runs a TR-53 conversation through the browser and the route, as its step's chat would. */
async function replay(conversation: AiConversation, harness: RouteHarness, summary: FileSummary) {
  const chat = createChatDriver(harness, summary, conversation.step === "results" ? { mode: "revise", base: BUSINESS_OWNER_BRIEF } : {});
  for (const message of conversation.messages) await chat.send(message);
  return chat.state;
}

// ---------------------------------------------------------------------------------------------
// Interview
// ---------------------------------------------------------------------------------------------

it("privacy: interview requests never contain row data", async () => {
  const forbidden = allForbidden();
  // Guard: every kind of value is there to look for, so the check means something.
  expect(new Set(forbidden.map((value) => value.field))).toEqual(
    new Set(["recordId", "company", "name", "otherExecutives", ...CONTACT_FIELDS]),
  );

  let requests = 0;
  for (const file of files) {
    for (const conversation of Object.values(AI_CONVERSATIONS)) {
      const ai = createScriptedAi(loadAiScript(conversation.script));
      const harness = createRouteHarness(ai);
      await replay(conversation, harness, file.summary);

      const where = `${conversation.script} on the ${file.name}`;
      expect(harness.bodies, where).toHaveLength(conversation.messages.length);
      expect(ai.calls, where).toHaveLength(conversation.messages.length);
      expect(leaks(everythingSent(harness, [ai]), forbidden), where).toEqual([]);
      requests += harness.bodies.length;
    }
  }
  expect(requests).toBe(3 * Object.values(AI_CONVERSATIONS).reduce((n, c) => n + c.messages.length, 0));
});

it("privacy: the current criteria never carry a value the summary doesn't hold", async () => {
  // Invented rows: a title column that holds an email on one row and an 85-character title on
  // another. The form's pickers offer both, uncleaned; the summary holds neither.
  const longTitle = `Director of ${"Regional ".repeat(8)}Operations`.slice(0, 85);
  const { workbook, grouping } = await importRows(
    syntheticSheet([syntheticRow(1), syntheticRow(2, { Title: "jane@example.invalid" }), syntheticRow(3, { Title: longTitle })]),
  );
  const records = grouping.records;
  const summaryFor = (brief?: Parameters<typeof buildFileSummary>[2]) => buildFileSummary(records, workbook.layout.id, brief);
  // A form brief (the pending brief) that leaves out both titles.
  const formBrief = {
    ...BUSINESS_OWNER_BRIEF,
    exclusions: [{ field: "title" as const, operator: "in" as const, value: ["jane@example.invalid", longTitle] }],
  };

  const ai = createScriptedAi(loadAiScript(AI_CONVERSATIONS.ambiguous.script));
  const harness = createRouteHarness(ai);
  const chat = createChatDriver(harness, summaryFor, { base: formBrief });
  const state = await chat.send(AI_CONVERSATIONS.ambiguous.messages[0]);

  // Neither value left the browser, in the brief or anywhere else, and the route accepted it.
  expect(harness.responses.map((response) => response.status)).toEqual([200]);
  expect(JSON.parse(harness.bodies[0]).currentBrief.exclusions).toEqual([]);
  for (const text of everythingSent(harness, [ai])) {
    expect(text).not.toContain("jane@");
    expect(text).not.toContain(longTitle);
  }
  // The chat says once which values the AI can't see.
  const notes = state.items.filter((item) => item.role === "note").map((item) => item.content);
  expect(notes).toHaveLength(1);
  expect(notes[0]).toContain('"jane@example.invalid"');

  // A request made by hand with the email in the brief is refused before the AI is called.
  const crafted = await harness.fetch("/api/translator/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "interview",
      summary: summaryFor(),
      messages: [{ role: "user", content: "Phoenix area" }],
      currentBrief: formBrief,
    }),
  });
  expect(crafted.status).toBe(400);
  expect(ai.calls).toHaveLength(1);
  expect(consoleError).toHaveBeenCalledWith("translator_ai_bad_request");
  consoleError.mockClear();
});

it("privacy: interview requests hold only kind, summary and messages, plus currentBrief", async () => {
  const [synthetic] = files;
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

// ---------------------------------------------------------------------------------------------
// Intro
// ---------------------------------------------------------------------------------------------

const INTRO_KEYS = ["city", "company", "contactName", "contactTitle", "industry", "state"];

/**
 * Sends `record`'s intro through the browser and the route, and checks the promise: the body has
 * exactly kind, intro, intent (and goal when given), intro has exactly the six fields, it holds
 * the record's company, name and title, and neither end holds this record's other values or any
 * other record's.
 */
async function checkIntro(record: IntroSource["record"] & { duplicateIds?: readonly string[] }, goal: string) {
  const picked = pickIntroFields({ record });
  if (!picked.ok) throw new Error(picked.error);
  const ai = createScriptedAi(loadAiScript("intro-any"));
  const harness = createRouteHarness(ai);
  await requestIntro(harness, picked.intro, "business_owner", goal);

  expect(harness.bodies).toHaveLength(1);
  const body = JSON.parse(harness.bodies[0]);
  const note = goal.trim();
  expect(Object.keys(body).sort()).toEqual(note ? ["goal", "intent", "intro", "kind"] : ["intent", "intro", "kind"]);
  expect(body).toStrictEqual({ kind: "intro", intro: picked.intro, intent: "business_owner", ...(note && { goal: note }) });
  expect(Object.keys(body.intro).sort()).toEqual(INTRO_KEYS);

  // The chosen business's company, name and title are what is sent.
  const { company, name, title } = record.normalized;
  expect(body.intro.company).toBe(company.known ? company.value : null);
  expect(body.intro.contactName).toBe(name.known ? name.value : null);
  expect(body.intro.contactTitle).toBe(title.known ? title.value : null);

  // The AI got one message: the six fields as data, the goal line and the note.
  expect(ai.calls).toHaveLength(1);
  expect(ai.calls[0].messages).toEqual([
    { role: "user", content: buildIntroMessage({ intro: picked.intro, intent: "business_owner", goal: note }) },
  ]);

  // None of its own ID, phone, email, website, address, ZIP, NAICS or executives ...
  const own = forbiddenOf(record).filter(({ field }) => field !== "company" && field !== "name");
  // ... and none of any other record's forbidden values (the same company or name excepted).
  const sent = new Set([body.intro.company, body.intro.contactName]);
  const others = allForbidden().filter(({ recordId, value }) => recordId !== record.normalized.recordId && !sent.has(value));
  expect(own.length).toBeGreaterThan(0);
  expect(leaks(everythingSent(harness, [ai]), [...own, ...others])).toEqual([]);
  return { own, intro: picked.intro };
}

it("privacy: intro sends only the chosen business: SYN-0001 from the synthetic sample", async () => {
  const record = files[0].records.find((r) => r.normalized.recordId === "SYN-0001");
  if (!record) throw new Error("SYN-0001 is missing");
  const { own } = await checkIntro(record, "  I sell welding supplies.  ");
  // Its email and its grouped duplicate's ID are among what must not be sent.
  expect(own.map(({ field, value }) => `${field} ${value}`)).toEqual(expect.arrayContaining(["recordId SYN-0500"]));
  expect(own.some(({ field }) => field === "email")).toBe(true);
});

it("privacy: intro sends only the chosen business: the fullest record of the Reference Solutions sample, no note", async () => {
  const fullest = [...files[1].records].sort((a, b) => forbiddenOf(b).length - forbiddenOf(a).length)[0];
  const { own } = await checkIntro(fullest, "   ");
  expect(new Set(own.map(({ field }) => field))).toEqual(
    new Set(["recordId", "phone", "website", "address", "zip", "naicsDescription", "otherExecutives"]),
  );
});

it("privacy: intro sends only the chosen business: a full invented Reference Solutions row", async () => {
  const record = fullRsRecord();
  const normalized = record.normalized;
  // The row really has all of these, so the test would catch a leak.
  expect(normalized.phone).toMatchObject({ known: true, value: "(602) 555-0101" });
  expect(normalized.website).toMatchObject({ known: true });
  expect(normalized.recordId).toBe("900012345");
  expect(normalized.address).toMatchObject({ known: true, value: "100 Example Way" });
  expect(normalized.zip).toMatchObject({ known: true, value: "85001" });
  expect(normalized.naicsDescription).toMatchObject({ known: true, value: "Structural Metal Fabrication" });
  expect(normalized.otherExecutives).toHaveLength(3);

  const { intro } = await checkIntro(record, "");
  expect(intro).toMatchObject({ company: "Synthetic Fixture Co 001", city: "Phoenix", state: "AZ", contactTitle: "Owner" });
  // Nor its executives' titles, size range or employee count.
  const json = JSON.stringify(intro);
  for (const text of ["Vice President", "Treasurer", "Secretary", "20 to 49", "25", "Tempe"]) expect(json).not.toContain(text);
});

// ---------------------------------------------------------------------------------------------
// The file summary
// ---------------------------------------------------------------------------------------------

/** Every key path in `value`, with `[]` for list items: "cities[].count", "employees.min", ... */
function keyPaths(value: unknown, at = ""): string[] {
  if (Array.isArray(value)) return [...new Set(value.flatMap((item) => keyPaths(item, `${at}[]`)))];
  if (typeof value !== "object" || value === null) return at === "" ? [] : [at];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = at === "" ? key : `${at}.${key}`;
    const below = keyPaths(child, path);
    return below.length > 0 ? below : [path];
  });
}

// Written out on purpose, not a Vitest snapshot (the project has none): a new key in the summary
// must be a deliberate change to this list, with a reason in the PR.
const SUMMARY_KEY_PATHS = [
  "cities[].count",
  "cities[].value",
  "employees.blank",
  "employees.max",
  "employees.min",
  "employees.withValue",
  "industries[].count",
  "industries[].value",
  "layout",
  "states[].count",
  "states[].value",
  "titles[].count",
  "titles[].value",
  "truncated.cities",
  "truncated.industries",
  "truncated.states",
  "truncated.titles",
  "uniqueRecords",
];

it("privacy: summary keys are fixed", () => {
  for (const { name, summary } of files) expect(keyPaths(summary).sort(), name).toEqual(SUMMARY_KEY_PATHS);
});

it("privacy: the summary holds no row data", () => {
  // Guard: the files really hold these, so the check below means something.
  expect(allForbidden().length).toBeGreaterThan(1000);
  for (const { name, summary } of files) expect(leaks([JSON.stringify(summary)], allForbidden()), name).toEqual([]);
});

// Written here, separate from the app's own `looksLikeContactData()`, so the check doesn't grade itself.
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const URL_LIKE = /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|org|net|io|invalid|example|us|biz)\b/i;
const PHONE = /(?:\d[\s().-]*){7,}/;

it("privacy: summary values never look like contact details", async () => {
  // Invented rows with an email, a website and a phone number in the summarized columns.
  const { workbook, grouping } = await importRows(
    syntheticSheet([
      syntheticRow(1, { Title: "jane@example.invalid" }),
      syntheticRow(2, { City: "www.example.invalid" }),
      syntheticRow(3, { Industry: "602 555 0100" }),
      syntheticRow(4, { State: "https://example.invalid/az" }),
    ]),
  );
  const contactLooking = { name: "invented contact-looking values", records: grouping.records, summary: buildFileSummary(grouping.records, workbook.layout.id) };

  for (const { name, summary } of [...files, contactLooking]) {
    const values = [...summary.cities, ...summary.states, ...summary.industries, ...summary.titles].map((item) => item.value);
    expect(values.length, name).toBeGreaterThan(0);
    for (const value of values) {
      expect(value, `${name}: ${value}`).not.toMatch(EMAIL);
      expect(value, `${name}: ${value}`).not.toMatch(URL_LIKE);
      expect(value, `${name}: ${value}`).not.toMatch(PHONE);
    }
  }
  // The contact-looking values were dropped, and the others kept.
  expect(contactLooking.summary.titles.map((t) => t.value)).toEqual(["Owner"]);
  expect(contactLooking.summary.cities.map((c) => c.value)).toEqual(["Phoenix"]);
});
