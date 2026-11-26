import { describe, expect, it } from "vitest";
import { RS_FIXTURE_HEADERS, RS_FIXTURE_ROW } from "../__fixtures__/rs-row";
import { mapRow } from "../import/map-row";
import { REFERENCE_SOLUTIONS_MAPPING } from "../import/mappings/reference-solutions";
import { normalizeRecord } from "../normalize/normalize";
import { type IntroFields, pickIntroFields } from "./intro";
import {
  buildIntroRequest,
  type IntroAction,
  initialIntroState,
  INTRO_PANEL_TEXT,
  type IntroSessionState,
  interpretIntroResponse,
  introReducer,
  placeholderCount,
} from "./intro-session";

const INTRO: IntroFields = {
  company: "Synthetic Company 0001",
  industry: "Fabrication",
  city: "Phoenix",
  state: "AZ",
  contactName: "Demo Contact 0001",
  contactTitle: "Owner",
};

const request = (recordId = "SYN-0001", goal = ""): IntroAction => ({ type: "request", recordId, intro: INTRO, intent: "business_owner", goal });
const run = (...actions: IntroAction[]): IntroSessionState => actions.reduce(introReducer, initialIntroState);

describe("buildIntroRequest", () => {
  it("has exactly kind, intro and intent when the note is empty or only spaces", () => {
    for (const note of ["", "   ", "\n\t "]) {
      const body = buildIntroRequest(INTRO, "business_owner", note);
      expect(Object.keys(body).sort()).toEqual(["intent", "intro", "kind"]);
      expect(body).toEqual({ kind: "intro", intro: INTRO, intent: "business_owner" });
    }
  });

  it("adds the note as goal, trimmed", () => {
    expect(buildIntroRequest(INTRO, "job_seeker", "  I'm studying welding.  ")).toEqual({
      kind: "intro",
      intro: INTRO,
      intent: "job_seeker",
      goal: "I'm studying welding.",
    });
  });

  it("carries only the six intro keys for a full Reference Solutions row", () => {
    const record = normalizeRecord(mapRow(REFERENCE_SOLUTIONS_MAPPING, RS_FIXTURE_HEADERS, RS_FIXTURE_ROW, 7));
    const picked = pickIntroFields({ record: { normalized: record } });
    if (!picked.ok) throw new Error(picked.error);
    const body = buildIntroRequest(picked.intro, "business_owner", "");
    expect(Object.keys(body.intro).sort()).toEqual(["city", "company", "contactName", "contactTitle", "industry", "state"]);
    const json = JSON.stringify(body);
    for (const text of ["555", "synthetic-fixture", "100 Example Way", "85001", "Structural Metal", "20 to 49"]) {
      expect(json).not.toContain(text);
    }
  });
});

describe("introReducer", () => {
  it("keeps the request pending, then stores the draft by Record ID", () => {
    const waiting = run(request("SYN-0001", "My note"));
    expect(waiting.pending).toMatchObject({ recordId: "SYN-0001", requestId: 1, goal: "My note" });
    const done = introReducer(waiting, { type: "received", requestId: 1, draft: "Subject: Hi\n\nHello [Your name]." });
    expect(done.pending).toBeNull();
    expect(done.drafts["SYN-0001"]).toEqual({
      recordId: "SYN-0001",
      intro: INTRO,
      intent: "business_owner",
      goal: "My note",
      draft: "Subject: Hi\n\nHello [Your name].",
      aiDraft: "Subject: Hi\n\nHello [Your name].",
      edited: false,
    });
  });

  it("marks an edit: edited true, the draft updated, aiDraft kept", () => {
    const state = run(request(), { type: "received", requestId: 1, draft: "AI text" }, { type: "edit", recordId: "SYN-0001", text: "My text" });
    expect(state.drafts["SYN-0001"]).toMatchObject({ draft: "My text", aiDraft: "AI text", edited: true });
    // Editing back to the AI's text is no longer an edit.
    const back = introReducer(state, { type: "edit", recordId: "SYN-0001", text: "AI text" });
    expect(back.drafts["SYN-0001"]).toMatchObject({ draft: "AI text", edited: false });
  });

  it("ignores an edit for a record with no draft", () => {
    const state = run(request());
    expect(introReducer(state, { type: "edit", recordId: "SYN-0002", text: "x" })).toBe(state);
  });

  it("ignores a stale reply after a reset, and keeps the drafts", () => {
    const withDraft = run(request(), { type: "received", requestId: 1, draft: "First" }, request("SYN-0002"));
    const reset = introReducer(withDraft, { type: "reset" });
    expect(reset.pending).toBeNull();
    expect(introReducer(reset, { type: "received", requestId: 2, draft: "Late" })).toBe(reset);
    expect(introReducer(reset, { type: "failed", requestId: 2, error: "Late" })).toBe(reset);
    expect(reset.drafts["SYN-0001"].draft).toBe("First");
    expect(reset.drafts["SYN-0002"]).toBeUndefined();
  });

  it("ignores a reply to an older request", () => {
    const state = run(request(), request("SYN-0002"));
    expect(introReducer(state, { type: "received", requestId: 1, draft: "Old" })).toBe(state);
  });

  it("keeps a failure with its request, so Try again can resend it as it was", () => {
    const state = run(request("SYN-0001", "Note"), { type: "failed", requestId: 1, error: "The AI took too long to answer. Try again, or use the form." });
    expect(state.pending).toBeNull();
    expect(state.error).toEqual({
      recordId: "SYN-0001",
      message: "The AI took too long to answer. Try again, or use the form.",
      request: { recordId: "SYN-0001", intro: INTRO, intent: "business_owner", goal: "Note" },
    });
    // A new request clears it; a reset does too.
    expect(introReducer(state, request()).error).toBeNull();
    expect(introReducer(state, { type: "reset" }).error).toBeNull();
  });

  it("replaces a record's draft when it is written again", () => {
    const state = run(
      request(),
      { type: "received", requestId: 1, draft: "First" },
      { type: "edit", recordId: "SYN-0001", text: "Edited" },
      request(),
      { type: "received", requestId: 2, draft: "Second" },
    );
    expect(state.drafts["SYN-0001"]).toMatchObject({ draft: "Second", aiDraft: "Second", edited: false });
  });
});

describe("interpretIntroResponse", () => {
  it("reads a draft", () => {
    expect(interpretIntroResponse(200, JSON.stringify({ ok: true, kind: "intro", draft: "Hello." }))).toEqual({ type: "received", draft: "Hello." });
  });

  it("shows the route's error text as it is", () => {
    const body = JSON.stringify({ ok: false, error: "The draft came back too long. Try again." });
    expect(interpretIntroResponse(502, body)).toEqual({ type: "failed", error: "The draft came back too long. Try again." });
  });

  it.each([
    ["no response", 0, null],
    ["not JSON", 200, "<html>"],
    ["an interview reply", 200, JSON.stringify({ ok: true, kind: "interview", reply: "Hi", proposal: null, note: null })],
    ["an empty draft", 200, JSON.stringify({ ok: true, kind: "intro", draft: "  " })],
  ])("gives the cant-reach message for %s", (_, status, body) => {
    expect(interpretIntroResponse(status, body)).toEqual({ type: "failed", error: INTRO_PANEL_TEXT.cantReach });
  });
});

describe("placeholderCount", () => {
  it("counts the three placeholders", () => {
    expect(placeholderCount("Hi [Contact name], I'm [Your name] from [Your business].")).toBe(3);
  });

  it("counts each time one appears, [contact details] included, and nothing else", () => {
    expect(placeholderCount("[Your name]\n\nBest,\n[Your name]\nCall [contact details]")).toBe(3);
    expect(placeholderCount("No brackets here. Not even [] or [\nsplit]")).toBe(0);
  });
});

describe("INTRO_PANEL_TEXT", () => {
  it("has the agreed wording and no em-dashes", () => {
    expect(INTRO_PANEL_TEXT.whatIsSent).toBe(
      "These details will be sent to the AI: company, industry, city, state, contact name and title. Nothing else from your file.",
    );
    expect(INTRO_PANEL_TEXT.noteSent).toBe("Your note is sent too, if you write one.");
    expect(INTRO_PANEL_TEXT.title("Synthetic Company 0001")).toBe("Draft an intro for Synthetic Company 0001");
    expect(INTRO_PANEL_TEXT.toFillIn(3)).toBe("3 to fill in");
    const texts = Object.values(INTRO_PANEL_TEXT).flatMap((text) =>
      typeof text === "function" ? [text(3 as never)] : typeof text === "string" ? [text] : Object.values(text),
    );
    for (const text of texts) expect(text).not.toMatch(/[\u2013\u2014]/);
  });
});
