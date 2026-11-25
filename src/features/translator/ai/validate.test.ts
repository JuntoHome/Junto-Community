import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { importWorkbook } from "../__fixtures__/import-pipeline";
import { SAMPLE_PATH } from "../__fixtures__/records";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import { searchBriefSchema, type SearchBrief } from "../criteria/schema";
import { buildFileSummary, type FileSummary } from "./summary";
import { MAX_ASSUMPTION_CHARS, MAX_ASSUMPTIONS, parseInterviewReply, VALIDATE_TEXT } from "./validate";

// The synthetic sample's summary (TR-40): cities Glendale, Mesa, Phoenix, Tempe, Scottsdale; state AZ;
// industries Business Services, Fabrication, Logistics, Technology, Retail. Flagstaff and Mining aren't in it.
let summary: FileSummary;

beforeAll(async () => {
  const bytes = readFileSync(SAMPLE_PATH);
  const { workbook, grouping } = await importWorkbook(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  summary = buildFileSummary(grouping.records, workbook.layout.id);
});

const MESSAGE = "Here is a brief. Does it look right?";

/** A reply as OpenAI sends it: JSON text, with `priorityOrder: null` for "not given". */
const reply = (proposal: unknown, message: string = MESSAGE) => JSON.stringify({ message, proposal });

/** The business owner brief in transport form, with some parts changed. */
const brief = (changes: Partial<Record<keyof SearchBrief, unknown>> = {}) => ({
  ...BUSINESS_OWNER_BRIEF,
  priorityOrder: null,
  ...changes,
});

const city = (value: unknown, operator = "equals") => ({ field: "city", operator, value });

/** The proposal and note of a reply that must parse. */
function parse(raw: unknown) {
  const result = parseInterviewReply(raw, summary);
  if (!result.ok) throw new Error(`expected ok, got ${result.reason}`);
  return result;
}

describe("parseInterviewReply: shape", () => {
  it("accepts a reply with no proposal yet", () => {
    expect(parseInterviewReply(reply(null, "Where are your customers?"), summary)).toEqual({
      ok: true,
      reply: { message: "Where are your customers?", proposal: null },
      note: null,
    });
  });

  it("accepts the business owner brief unchanged (as JSON text or an object)", () => {
    expect(parse(reply(brief()))).toEqual({ ok: true, reply: { message: MESSAGE, proposal: BUSINESS_OWNER_BRIEF }, note: null });
    expect(parse({ message: MESSAGE, proposal: brief() }).reply.proposal).toEqual(BUSINESS_OWNER_BRIEF);
  });

  it("keeps a priority order the AI gave", () => {
    const proposal = parse(reply(brief({ priorityOrder: ["title", "industry"] }))).reply.proposal;
    expect(proposal?.priorityOrder).toEqual(["title", "industry"]);
  });

  it.each([
    ["text that isn't JSON", "not json"],
    ["a reply without a message", JSON.stringify({ proposal: null })],
    ["a reply with an extra key", JSON.stringify({ message: MESSAGE, proposal: null, rows: [] })],
    ["a reply without a proposal key", JSON.stringify({ message: MESSAGE })],
    ["an empty message", reply(null, "")],
    ["a message of only spaces", reply(null, "   ")],
    ["a message over 800 characters", reply(null, "a".repeat(801))],
    ["a JSON array", "[]"],
    ["null", "null"],
    ["nothing", undefined],
  ])("refuses %s as shape", (_, raw) => {
    expect(parseInterviewReply(raw, summary)).toEqual({ ok: false, reason: "shape" });
  });
});

describe("parseInterviewReply: text", () => {
  it("replaces an em-dash in the message with a comma and a space", () => {
    expect(parse(reply(null, "Phoenix — owners only?")).reply.message).toBe("Phoenix, owners only?");
  });

  it(`keeps ${MAX_ASSUMPTIONS} assumptions of at most ${MAX_ASSUMPTION_CHARS} characters`, () => {
    const assumptions = ["x".repeat(400), ...Array.from({ length: 7 }, (_, i) => `Assumption ${i + 2}.`)];
    const proposal = parse(reply(brief({ assumptions }))).reply.proposal;
    expect(proposal?.assumptions).toHaveLength(MAX_ASSUMPTIONS);
    expect(proposal?.assumptions[0]).toBe("x".repeat(MAX_ASSUMPTION_CHARS));
    expect(proposal?.assumptions.slice(1)).toEqual(["Assumption 2.", "Assumption 3.", "Assumption 4.", "Assumption 5."]);
  });

  it("cleans each assumption and leaves out empty ones", () => {
    const assumptions = ["Phoenix – a must-have.", "   ", "No  exclusions."];
    expect(parse(reply(brief({ assumptions }))).reply.proposal?.assumptions).toEqual(["Phoenix, a must-have.", "No exclusions."]);
  });
});

describe("parseInterviewReply: values must be in the file", () => {
  it("fixes the case and spaces to the file's spelling", () => {
    const proposal = parse(
      reply(
        brief({
          mustHaves: [city("phoenix"), { field: "state", operator: "equals", value: "az" }],
          preferences: [
            { field: "industry", operator: "equals", value: "  FABRICATION " },
            { field: "title", operator: "equals", value: "owner" },
            { field: "employees", operator: "range", value: { min: 10, max: 99 } },
          ],
        }),
      ),
    ).reply.proposal;
    expect(proposal).toEqual(BUSINESS_OWNER_BRIEF);
  });

  it('turns city in ["Phoenix", "phoenix"] into city equals "Phoenix"', () => {
    const proposal = parse(reply(brief({ mustHaves: [city(["Phoenix", "phoenix"], "in")] }))).reply.proposal;
    expect(proposal?.mustHaves).toEqual([city("Phoenix")]);
  });

  it("removes duplicates from an in list and keeps the order", () => {
    const proposal = parse(reply(brief({ mustHaves: [city(["tempe", "Phoenix", "Tempe"], "in")] }))).reply.proposal;
    expect(proposal?.mustHaves).toEqual([city(["Tempe", "Phoenix"], "in")]);
  });

  it("accepts Scottsdale, which is in the file", () => {
    const proposal = parse(reply(brief({ mustHaves: [city("Scottsdale")] }))).reply.proposal;
    expect(proposal?.mustHaves).toEqual([city("Scottsdale")]);
  });

  it("drops the proposal for a city that isn't in the file, and keeps the message", () => {
    expect(parse(reply(brief({ mustHaves: [city("Flagstaff")] })))).toEqual({
      ok: true,
      reply: { message: MESSAGE, proposal: null },
      note: `I couldn't use "Flagstaff" because it's not in this file.`,
    });
  });

  it("names every value that isn't in the file in one note", () => {
    const two = brief({
      mustHaves: [city("Flagstaff")],
      preferences: [{ field: "industry", operator: "equals", value: "Mining" }],
    });
    expect(parse(reply(two)).note).toBe(`I couldn't use "Flagstaff" and "Mining" because they're not in this file.`);

    const three = brief({ mustHaves: [city(["Phoenix", "Flagstaff", "Yuma", "flagstaff"], "in")], exclusions: [{ field: "title", operator: "equals", value: "Intern" }] });
    expect(parse(reply(three)).note).toBe(`I couldn't use "Flagstaff", "Yuma" and "Intern" because they're not in this file.`);
  });

  it("never changes a value that differs by more than case and spaces", () => {
    const result = parse(reply(brief({ mustHaves: [city("Phoenix AZ"), { field: "state", operator: "equals", value: "Arizona" }] })));
    expect(result.reply.proposal).toBeNull();
    expect(result.note).toBe(VALIDATE_TEXT.notInFile(["Phoenix AZ", "Arizona"]));
  });

  it("checks exclusions too", () => {
    const result = parse(reply(brief({ exclusions: [city("Flagstaff")] })));
    expect(result.reply.proposal).toBeNull();
    expect(result.note).toBe(`I couldn't use "Flagstaff" because it's not in this file.`);
  });

  it("removes em-dashes and cuts a long unknown value in the note", () => {
    const note = parse(reply(brief({ mustHaves: [city(`Flag—staff${"f".repeat(100)}`)] }))).note ?? "";
    expect(note).not.toMatch(/[—–]/);
    expect(note.length).toBeLessThan(200);
  });
});

describe("parseInterviewReply: only parts the form can edit", () => {
  it.each([
    ["a city preference", { preferences: [city("Phoenix")] }],
    ["a state preference", { preferences: [{ field: "state", operator: "equals", value: "AZ" }] }],
    ["an employees must-have", { mustHaves: [{ field: "employees", operator: "range", value: { min: 10, max: 99 } }] }],
    // Not "AZ": the base brief requires AZ, and leaving out a required value breaks a brief rule first.
    ["a state exclusion", { exclusions: [{ field: "state", operator: "equals", value: "NV" }] }],
  ])("drops the proposal with %s", (_, changes) => {
    expect(parse(reply(brief(changes)))).toEqual({
      ok: true,
      reply: { message: MESSAGE, proposal: null },
      note: VALIDATE_TEXT.notEditable,
    });
  });
});

describe("parseInterviewReply: parts that don't fit together", () => {
  const dropped = { ok: true, reply: { message: MESSAGE, proposal: null }, note: VALIDATE_TEXT.doesNotFit };

  it.each([
    ["listSize 500", { listSize: 500 }],
    ["listSize 0", { listSize: 0 }],
    ["an employees range of 99 to 10", { preferences: [{ field: "employees", operator: "range", value: { min: 99, max: 10 } }] }],
    ["Phoenix required and left out", { exclusions: [city("Phoenix")] }],
    ["Phoenix required and phoenix left out", { exclusions: [city("phoenix")] }],
    ["a priority with no preference", { priorityOrder: ["geography"] }],
    ["an empty city", { mustHaves: [city("  ")] }],
  ])("drops the proposal for %s and keeps the message", (_, changes) => {
    expect(parse(reply(brief(changes)))).toEqual(dropped);
  });

  it("re-checks the brief after the spelling fix", () => {
    // Fixed to "Fabrication" twice: preferred and left out, which the form can't hold either.
    const proposal = brief({ exclusions: [{ field: "industry", operator: "equals", value: "fabrication" }] });
    expect(parse(reply(proposal))).toEqual(dropped);
  });
});

describe("parseInterviewReply: nothing invalid gets through", () => {
  const cases = [
    brief(),
    brief({ mustHaves: [city("phoenix")] }),
    brief({ mustHaves: [city("Flagstaff")] }),
    brief({ listSize: 500 }),
    brief({ preferences: [city("Phoenix")] }),
    brief({ exclusions: [city("Phoenix")] }),
    brief({ intent: "everything" }),
    { ...brief(), extra: true },
  ];

  it.each(cases.map((proposal, i) => [i, proposal]))("case %i: the proposal is null or a valid brief from the file", (_, proposal) => {
    const result = parseInterviewReply(reply(proposal), summary);
    if (!result.ok || result.reply.proposal === null) return;
    const out = result.reply.proposal;
    expect(searchBriefSchema.safeParse(out).success).toBe(true);
    const inFile = new Set([...summary.cities, ...summary.states, ...summary.industries, ...summary.titles].map((v) => v.value));
    for (const criterion of [...out.mustHaves, ...out.preferences, ...out.exclusions]) {
      if (criterion.operator === "range") continue;
      for (const value of [criterion.value].flat()) expect(inFile.has(value)).toBe(true);
    }
  });
});
