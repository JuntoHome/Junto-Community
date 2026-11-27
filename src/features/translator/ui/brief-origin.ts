import { diffBriefs } from "../ai";
import type { SearchBrief } from "../criteria/schema";

/**
 * How the confirmed brief was made (TR-45, TR-52), for the export's Criteria sheet. No React, so
 * it can be tested in Node. `TranslatorWizard` holds one `BriefOrigin` and changes it only
 * through the functions below, so Start over and a new workbook reset it with the remount
 * (TR-28). Session state only: never part of `SearchBrief`, never stored, sent or logged.
 */

/** Where the confirmed criteria came from: the form, or a proposal confirmed in the chat. */
export type BriefSource = "ai" | "form";

export type BriefOrigin = {
  /**
   * "ai" only after Confirm and rank on an AI proposal card (the Criteria step's, TR-45, or the
   * Results step's chat for changes, TR-46). "form" by default and after Continue on the form,
   * also when the form was filled by Edit in form.
   */
  briefSource: BriefSource;
  /** An AI brief was then changed by a Save in the criteria summary. A new AI brief clears it. */
  editedAfterAi: boolean;
  /**
   * The first message the user typed in the conversation whose proposal was the first one
   * confirmed this session. Set once: a later confirm, on either step, never replaces it.
   */
  firstAiRequest: string | null;
};

/** A new session: nothing confirmed from the AI yet. */
export const INITIAL_BRIEF_ORIGIN: BriefOrigin = { briefSource: "form", editedAfterAi: false, firstAiRequest: null };

/** Continue on the Criteria step's form. The first AI request, if any, is kept. */
export function confirmedFromForm(origin: BriefOrigin): BriefOrigin {
  return { ...origin, briefSource: "form", editedAfterAi: false };
}

/**
 * Confirm and rank on an AI proposal card. `firstRequest` is that chat's first user message
 * (`firstUserMessage()`); it is recorded only if nothing was recorded before.
 */
export function confirmedFromAi(origin: BriefOrigin, firstRequest: string | null): BriefOrigin {
  return { briefSource: "ai", editedAfterAi: false, firstAiRequest: origin.firstAiRequest ?? firstRequest };
}

/**
 * A Save in the criteria summary changed the brief from `before` to `after`. An AI brief is then
 * marked as edited, but only when the Save really changed something (`diffBriefs()`, the one way
 * to compare briefs). A form brief stays a form brief.
 */
export function savedInSummary(origin: BriefOrigin, before: SearchBrief | null, after: SearchBrief): BriefOrigin {
  if (origin.briefSource !== "ai" || origin.editedAfterAi) return origin;
  if (before && diffBriefs(before, after).length === 0) return origin;
  return { ...origin, editedAfterAi: true };
}
