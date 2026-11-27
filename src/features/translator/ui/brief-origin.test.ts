import { describe, expect, it } from "vitest";
import { BUSINESS_OWNER_BRIEF } from "../criteria/examples";
import type { SearchBrief } from "../criteria/schema";
import {
  type BriefOrigin,
  confirmedFromAi,
  confirmedFromForm,
  INITIAL_BRIEF_ORIGIN,
  savedInSummary,
} from "./brief-origin";

const AI_BRIEF: SearchBrief = BUSINESS_OWNER_BRIEF;
const SMALLER: SearchBrief = { ...AI_BRIEF, listSize: 30 };

describe("brief origin (TR-52)", () => {
  it("starts as a form brief with nothing asked", () => {
    expect(INITIAL_BRIEF_ORIGIN).toEqual({ briefSource: "form", editedAfterAi: false, firstAiRequest: null });
  });

  it("records the first chat message when an AI proposal is confirmed", () => {
    expect(confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix")).toEqual({
      briefSource: "ai",
      editedAfterAi: false,
      firstAiRequest: "owners in Phoenix",
    });
  });

  it("marks an AI brief as edited after a summary Save that changes it", () => {
    const ai = confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix");
    expect(savedInSummary(ai, AI_BRIEF, SMALLER)).toEqual({ ...ai, editedAfterAi: true });
  });

  it("leaves an AI brief as it is when the Save changed nothing", () => {
    const ai = confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix");
    expect(savedInSummary(ai, AI_BRIEF, { ...AI_BRIEF })).toBe(ai);
  });

  it("never marks a form brief as edited", () => {
    expect(savedInSummary(INITIAL_BRIEF_ORIGIN, AI_BRIEF, SMALLER)).toBe(INITIAL_BRIEF_ORIGIN);
  });

  it("keeps the first request after a Results revision, and clears the edit mark", () => {
    const edited = savedInSummary(confirmedFromAi(INITIAL_BRIEF_ORIGIN, "owners in Phoenix"), AI_BRIEF, SMALLER);
    expect(confirmedFromAi(edited, "make it 30")).toEqual({
      briefSource: "ai",
      editedAfterAi: false,
      firstAiRequest: "owners in Phoenix",
    });
  });

  it("goes back to the form on Continue, keeping the first request for a later AI confirm", () => {
    const ai: BriefOrigin = { briefSource: "ai", editedAfterAi: true, firstAiRequest: "owners in Phoenix" };
    const form = confirmedFromForm(ai);
    expect(form).toEqual({ briefSource: "form", editedAfterAi: false, firstAiRequest: "owners in Phoenix" });
    expect(confirmedFromAi(form, "a second chat").firstAiRequest).toBe("owners in Phoenix");
  });

  it("records the request of the first confirmed chat, even when it is the Results step's", () => {
    // Criteria set with the form, then changed in the Results step's chat.
    const form = confirmedFromForm(INITIAL_BRIEF_ORIGIN);
    expect(confirmedFromAi(form, "only 30 rows").firstAiRequest).toBe("only 30 rows");
  });
});
