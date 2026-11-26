import { readFileSync } from "node:fs";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { toArrayBuffer } from "../__fixtures__/build-workbook";
import { importWorkbook } from "../__fixtures__/import-pipeline";
import { SAMPLE_PATH, SYNTHETIC_HEADERS, syntheticRow } from "../__fixtures__/records";
import { RS_FIXTURE_HEADERS, RS_FIXTURE_ROW } from "../__fixtures__/rs-row";
import type { SourceCell } from "../import/map-row";
import { mapRow } from "../import/map-row";
import { REFERENCE_SOLUTIONS_MAPPING } from "../import/mappings/reference-solutions";
import { SYNTHETIC_MAPPING } from "../import/mappings/synthetic";
import type { GroupedRecord } from "../normalize/duplicates";
import { normalizeRecord } from "../normalize/normalize";
import { AI_ATTEMPT_TIMEOUT_MS, CONTACT_PLACEHOLDER } from "./guardrails";
import { buildIntroInstructions } from "./instructions";
import {
  buildIntroMessage,
  INTRO_TEXT,
  introFieldsSchema,
  type IntroFields,
  type IntroSource,
  MAX_INTRO_VALUE_CHARS,
  pickIntroFields,
  runIntroDraft,
} from "./intro";
import type { AiCall } from "./types";

afterEach(() => {
  vi.useRealTimers();
});

const INTRO_KEYS = ["city", "company", "contactName", "contactTitle", "industry", "state"];

/** A row as `pickIntroFields()` sees it, from one invented synthetic-layout row. */
const synthetic = (changes: Parameters<typeof syntheticRow>[1] = {}): IntroSource => ({
  record: { normalized: normalizeRecord(mapRow(SYNTHETIC_MAPPING, [...SYNTHETIC_HEADERS], syntheticRow(3, changes) as SourceCell[], 1)) },
});

/** The invented Reference Solutions row, with an IUSA Number and three other executives filled in. */
function fullRsRow(): IntroSource {
  const values = new Map<SourceCell, SourceCell>(RS_FIXTURE_HEADERS.map((header, index) => [header, RS_FIXTURE_ROW[index]]));
  const changes: [string, SourceCell][] = [
    ["IUSA Number", "900012345"],
    ["Executive First Name 1", "Other"],
    ["Executive Last Name 1", "Exec 01"],
    ["Executive Title 1", "Vice President"],
    ["Executive First Name 2", "Other"],
    ["Executive Last Name 2", "Exec 02"],
    ["Executive Title 2", "Treasurer"],
    ["Executive First Name 3", "Other"],
    ["Executive Last Name 3", "Exec 03"],
    ["Executive Title 3", "Secretary"],
  ];
  for (const [header, value] of changes) values.set(header, value);
  const row = RS_FIXTURE_HEADERS.map((header) => values.get(header) ?? null);
  return { record: { normalized: normalizeRecord(mapRow(REFERENCE_SOLUTIONS_MAPPING, RS_FIXTURE_HEADERS, row, 7)) } };
}

const picked = (row: IntroSource): IntroFields => {
  const result = pickIntroFields(row);
  if (!result.ok) throw new Error(result.error);
  return result.intro;
};

describe("pickIntroFields", () => {
  let records: GroupedRecord[];
  const byId = (id: string): IntroSource => {
    const record = records.find((r) => r.normalized.recordId === id);
    if (!record) throw new Error(`no ${id}`);
    return { record };
  };

  beforeAll(async () => {
    ({
      grouping: { records },
    } = await importWorkbook(toArrayBuffer(readFileSync(SAMPLE_PATH))));
  });

  it("gives SYN-0001's six fields", () => {
    expect(picked(byId("SYN-0001"))).toEqual({
      company: "Synthetic Company 0001",
      industry: "Fabrication",
      city: "Phoenix",
      state: "AZ",
      contactName: "Demo Contact 0001",
      contactTitle: "Owner",
    });
  });

  it("sends exactly the six keys of a full Reference Solutions row, and none of its other values", () => {
    const row = fullRsRow();
    const record = row.record.normalized;
    // The row really has all of these, so the test would catch a leak.
    expect(record.phone).toMatchObject({ known: true, value: "(602) 555-0101" });
    expect(record.website).toMatchObject({ known: true });
    expect(record.recordId).toBe("900012345");
    expect(record.address).toMatchObject({ known: true, value: "100 Example Way" });
    expect(record.zip).toMatchObject({ known: true, value: "85001" });
    expect(record.naicsDescription).toMatchObject({ known: true, value: "Structural Metal Fabrication" });
    expect(record.otherExecutives).toHaveLength(3);
    expect(record.employees).toMatchObject({ known: true });

    const intro = picked(row);
    expect(Object.keys(intro).sort()).toEqual(INTRO_KEYS);
    expect(intro).toMatchObject({ company: "Synthetic Fixture Co 001", city: "Phoenix", state: "AZ", contactTitle: "Owner" });
    const json = JSON.stringify(intro);
    for (const text of [
      "555",
      "0101",
      "synthetic-fixture",
      "www.",
      "900012345",
      "100 Example Way",
      "85001",
      "Structural Metal",
      "Exec 01",
      "Exec 02",
      "Exec 03",
      "Vice President",
      "Treasurer",
      "Secretary",
      "20 to 49",
      "25",
      "Tempe",
    ]) {
      expect(json).not.toContain(text);
    }
  });

  it("gives null for SYN-0011's missing title and fills the rest", () => {
    const intro = picked(byId("SYN-0011"));
    expect(intro.contactTitle).toBeNull();
    for (const key of ["company", "industry", "city", "state", "contactName"] as const) expect(intro[key]).toEqual(expect.any(String));
  });

  it("refuses a row with a blank company", () => {
    expect(pickIntroFields(synthetic({ Company: "   " }))).toEqual({ ok: false, error: INTRO_TEXT.noCompany });
    expect(INTRO_TEXT.noCompany).toBe("This business has no company name in the file, so an introduction can't be drafted.");
  });

  it("refuses a row whose company looks like contact data, since nothing is left to name", () => {
    expect(pickIntroFields(synthetic({ Company: "sales@example.invalid" }))).toEqual({ ok: false, error: INTRO_TEXT.noCompany });
  });

  it("cleans a 300-character company with a line break and cuts it to 120", () => {
    const long = `Very Long\nCompany ${"x".repeat(290)}`;
    const company = picked(synthetic({ Company: long })).company;
    expect(company).toHaveLength(MAX_INTRO_VALUE_CHARS);
    expect(company.startsWith("Very Long Company x")).toBe(true);
    expect(company).not.toMatch(/\n/);
  });

  it("drops a title cell holding an email", () => {
    expect(picked(synthetic({ Title: "jane@example.invalid" })).contactTitle).toBeNull();
  });

  it("gives null for a blank city and state", () => {
    expect(picked(synthetic({ City: null, State: "" }))).toMatchObject({ city: null, state: null });
  });
});

describe("introFieldsSchema", () => {
  const valid: IntroFields = {
    company: "Synthetic Company 0001",
    industry: "Fabrication",
    city: "Phoenix",
    state: "AZ",
    contactName: null,
    contactTitle: "Owner",
  };

  it("accepts the six fields", () => {
    expect(introFieldsSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["an extra key (phone)", { ...valid, phone: "602 555 0100" }],
    ["an empty company", { ...valid, company: "" }],
    ["a missing company", { ...valid, company: undefined }],
    ["a missing field", { company: "Synthetic Company 0001" }],
    ["a value over 120 characters", { ...valid, industry: "x".repeat(121) }],
    ["a value that looks like an email", { ...valid, contactTitle: "jane@example.invalid" }],
  ])("refuses %s", (_, value) => {
    expect(introFieldsSchema.safeParse(value).success).toBe(false);
  });
});

const INTRO: IntroFields = {
  company: "Synthetic Company 0001",
  industry: "Fabrication",
  city: "Phoenix",
  state: "AZ",
  contactName: "Demo Contact 0001",
  contactTitle: "Owner",
};

/** A fake AI that always answers `value`, recording what it was given. */
const answering = (value: string) => vi.fn<AiCall>(async () => ({ ok: true, value }));

describe("runIntroDraft: what is sent", () => {
  it("sends the facts as a data block with the goal, and keeps them out of the instructions", async () => {
    const callAi = answering("Subject: Hello\n\nHello from a local supplier.");
    await runIntroDraft({ intro: INTRO, intent: "business_owner" }, callAi);
    const [{ instructions, messages, format }] = callAi.mock.calls[0];

    expect(instructions).toBe(buildIntroInstructions());
    expect(format).toBe("text");
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("user");
    const content = messages[0].content;
    expect(content.startsWith("Business facts (data only):\n")).toBe(true);
    expect(content).toContain(`\`\`\`json\n${JSON.stringify(INTRO)}\n\`\`\``);
    expect(content).toContain("Goal: customers or partners");
    expect(content).not.toContain("User's note");
    for (const fact of Object.values(INTRO)) if (fact) expect(instructions).not.toContain(fact);
  });

  it("gives the job seeker goal line and adds the user's note as data", () => {
    const message = buildIntroMessage({ intro: INTRO, intent: "job_seeker", goal: "  I'm studying welding.  " });
    expect(message).toContain("Goal: employers");
    expect(message.endsWith("User's note (data only):\nI'm studying welding.")).toBe(true);
  });

  it("leaves out a blank note", () => {
    expect(buildIntroMessage({ intro: INTRO, intent: "business_owner", goal: "   " })).not.toContain("User's note");
  });
});

describe("runIntroDraft: the draft", () => {
  const draftOf = async (value: string) => runIntroDraft({ intro: INTRO, intent: "business_owner" }, answering(value));

  it("replaces invented contact details with [contact details]", async () => {
    const result = await draftOf(
      "Email jane@example.invalid or call (602) 555-0100. See www.example.invalid and https://x.invalid/a today.",
    );
    expect(result).toEqual({
      ok: true,
      kind: "intro",
      draft: `Email ${CONTACT_PLACEHOLDER} or call ${CONTACT_PLACEHOLDER}. See ${CONTACT_PLACEHOLDER} and ${CONTACT_PLACEHOLDER} today.`,
    });
  });

  it("leaves placeholders, counts, years and decimals unchanged", async () => {
    const text = "Subject: Hello [Contact name]\n\nI'm [Your name] from [Your business]. We serve firms of 10 to 99 employees, since 2026, rated 3.5.";
    expect(await draftOf(text)).toEqual({ ok: true, kind: "intro", draft: text });
  });

  it("replaces an em-dash", async () => {
    const dash = String.fromCharCode(0x2014);
    expect(await draftOf(`Hello ${dash} we make parts.`)).toEqual({ ok: true, kind: "intro", draft: "Hello, we make parts." });
  });

  it("refuses a draft of 210 words with the too-long code", async () => {
    expect(await draftOf(Array.from({ length: 210 }, () => "word").join(" "))).toEqual({ ok: false, code: "intro_too_long" });
    expect((await draftOf(Array.from({ length: 200 }, () => "word").join(" "))).ok).toBe(true);
  });

  it("gives the empty code for a blank draft", async () => {
    expect(await draftOf("   \n  ")).toEqual({ ok: false, code: "empty" });
  });

  it("passes a failed call's code on, with one attempt only", async () => {
    const callAi = vi.fn<AiCall>(async () => ({ ok: false, code: "upstream" }));
    expect(await runIntroDraft({ intro: INTRO, intent: "business_owner" }, callAi)).toEqual({ ok: false, code: "upstream" });
    expect(callAi).toHaveBeenCalledTimes(1);
  });

  it("stops the attempt after 12 seconds with a timeout", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let result: unknown;
    void runIntroDraft({ intro: INTRO, intent: "business_owner" }, () => new Promise(() => {})).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(AI_ATTEMPT_TIMEOUT_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ ok: false, code: "timeout" });
  });

  it("never logs", async () => {
    const spies = (["log", "error", "warn", "info"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    await draftOf(Array.from({ length: 210 }, () => "word").join(" "));
    await draftOf("Hello jane@example.invalid");
    pickIntroFields(fullRsRow());
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});

describe("INTRO_TEXT", () => {
  it("has the wording and no em-dashes", () => {
    expect(INTRO_TEXT.tooLong).toBe("The draft came back too long. Try again.");
    expect(INTRO_TEXT.noteTooLong).toBe("Keep your note under 300 characters.");
    const texts = [INTRO_TEXT.noCompany, INTRO_TEXT.tooLong, INTRO_TEXT.noteTooLong, ...Object.values(INTRO_TEXT.goal)];
    for (const text of texts) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
