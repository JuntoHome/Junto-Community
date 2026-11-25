/**
 * Capability: check the AI's interview reply before anything in it reaches the app (TR-42).
 * Input: the raw reply (the JSON text, or the parsed value) and the file summary the AI was given.
 * Output: `{ ok: true, reply, note }`, where `reply.proposal` passed every check below or is null
 * and `note` says why a proposal was dropped (or is null); or `{ ok: false, reason: "shape" }`
 * when the reply isn't in the format at all (the caller may retry once).
 *
 * The checks, in order:
 * 1. Shape: JSON, then `fromTransport()`, then `interviewReplySchema`. A reply whose message is
 *    fine but whose proposal breaks a brief rule (list size, a range, a cross-field rule) keeps
 *    its message and loses the proposal, with the "don't fit together" note.
 * 2. Text: the message and each assumption go through `cleanAiText()`. At most 5 assumptions of
 *    200 characters each.
 * 3. The proposal, if there is one:
 *    - only the parts the form can edit (`MUST_HAVE_FIELDS`, `PREFERENCE_DIMENSIONS`,
 *      `EXCLUSION_FIELDS` in criteria/from-form.ts);
 *    - every city, state, industry and title value is in the file summary, compared by
 *      `matchKey()`, and takes the summary's spelling ("phoenix" becomes "Phoenix"). That is the
 *      same value, so it is a spelling fix, not a change. Anything else is never changed;
 *    - duplicates in an "in" list are removed, and an "in" with one value left becomes "equals";
 *    - the corrected brief passes `searchBriefSchema` again.
 *    Any part that fails drops the whole proposal (null) with a note. Nothing is applied in part.
 *
 * Privacy: reads only the AI's reply and the file summary. Never logs (the caller logs codes only).
 * This module is pure (zod only, no React, no I/O).
 */
import { EXCLUSION_FIELDS, MUST_HAVE_FIELDS, PREFERENCE_DIMENSIONS } from "../criteria/from-form";
import { searchBriefSchema, type BriefCriterion, type BriefField, type SearchBrief } from "../criteria/schema";
import { matchKey } from "../normalize/match-key";
import { cleanAiText, cutText, MAX_SUMMARY_VALUE_CHARS } from "./guardrails";
import { fromTransport, interviewReplySchema, type InterviewReply } from "./schema";
import type { FileSummary } from "./summary";

/** Most assumptions a proposal keeps. Extra ones are dropped. */
export const MAX_ASSUMPTIONS = 5;
/** Longest assumption, in characters. Longer ones are cut. */
export const MAX_ASSUMPTION_CHARS = 200;

/** `"A"`, `"A" and "B"`, `"A", "B" and "C"`. */
const quotedList = (values: readonly string[]) => {
  const quoted = values.map((value) => `"${value}"`);
  return quoted.length < 2 ? quoted.join("") : `${quoted.slice(0, -1).join(", ")} and ${quoted.at(-1)}`;
};

export const VALIDATE_TEXT = {
  notEditable:
    "I couldn't use that suggestion because it includes an option this tool can't edit yet. Try the form, or ask me again.",
  notInFile: (values: readonly string[]) =>
    `I couldn't use ${quotedList(values)} because ${values.length === 1 ? "it's" : "they're"} not in this file.`,
  doesNotFit: "I couldn't use that suggestion because some parts don't fit together. Try again, or use the form.",
} as const;

export type ParsedInterviewReply =
  | { ok: true; reply: InterviewReply; note: string | null }
  | { ok: false; reason: "shape" };

const SHAPE: ParsedInterviewReply = { ok: false, reason: "shape" };

type TextField = Exclude<BriefField, "employees">;

/** The summary list that holds each text field's values. */
const SUMMARY_LIST: Record<TextField, "cities" | "states" | "industries" | "titles"> = {
  city: "cities",
  state: "states",
  industry: "industries",
  title: "titles",
};

/** The fields the form can edit in each part of a brief (the TR-41 table). */
const ALLOWED_FIELDS: Record<"mustHaves" | "preferences" | "exclusions", readonly BriefField[]> = {
  mustHaves: MUST_HAVE_FIELDS,
  preferences: PREFERENCE_DIMENSIONS,
  exclusions: EXCLUSION_FIELDS,
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The parsed JSON, or undefined when a string isn't JSON. A value that isn't a string is passed on. */
function readJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** True when every criterion uses a field the form can edit in its part of the brief. */
const onlyEditableParts = (brief: SearchBrief) =>
  (Object.keys(ALLOWED_FIELDS) as (keyof typeof ALLOWED_FIELDS)[]).every((part) =>
    brief[part].every((criterion) => ALLOWED_FIELDS[part].includes(criterion.field)),
  );

/** For each text field: the summary's spelling of each value, by match key. */
function summarySpellings(summary: FileSummary): Record<TextField, Map<string, string>> {
  const spellings = {} as Record<TextField, Map<string, string>>;
  for (const field of Object.keys(SUMMARY_LIST) as TextField[]) {
    spellings[field] = new Map(summary[SUMMARY_LIST[field]].map(({ value }) => [matchKey(value), value]));
  }
  return spellings;
}

/** Values in order, each once (compared by match key). */
const unique = (values: readonly string[]) => {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = matchKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * The criterion with each text value in the summary's spelling, an "in" list without duplicates
 * (and "equals" when one value is left). Values that aren't in the summary are added to `unknown`.
 */
function fixSpelling(
  criterion: BriefCriterion,
  spellings: Record<TextField, Map<string, string>>,
  unknown: string[],
): BriefCriterion {
  if (criterion.operator === "range") return criterion;
  const inFile = spellings[criterion.field];
  const fix = (value: string) => {
    const spelling = inFile.get(matchKey(value));
    if (spelling === undefined) unknown.push(value);
    return spelling ?? value;
  };
  if (criterion.operator === "equals") return { ...criterion, value: fix(criterion.value) };
  const values = unique(criterion.value.map(fix));
  return values.length === 1
    ? { field: criterion.field, operator: "equals", value: values[0] }
    : { ...criterion, value: values };
}

/** Assumptions cleaned, empty ones left out, at most MAX_ASSUMPTIONS of MAX_ASSUMPTION_CHARS each. */
const cleanAssumptions = (assumptions: readonly string[]) =>
  assumptions
    .map((assumption) => cutText(cleanAiText(assumption), MAX_ASSUMPTION_CHARS))
    .filter((assumption) => assumption !== "")
    .slice(0, MAX_ASSUMPTIONS);

/** Step 3: the proposal, checked against the form and the file, or null with the note that says why. */
function checkProposal(proposal: SearchBrief, summary: FileSummary): { proposal: SearchBrief | null; note: string | null } {
  if (!onlyEditableParts(proposal)) return { proposal: null, note: VALIDATE_TEXT.notEditable };

  const spellings = summarySpellings(summary);
  const unknown: string[] = [];
  const fixAll = (criteria: readonly BriefCriterion[]) => criteria.map((criterion) => fixSpelling(criterion, spellings, unknown));
  const corrected: SearchBrief = {
    ...proposal,
    mustHaves: fixAll(proposal.mustHaves),
    preferences: fixAll(proposal.preferences),
    exclusions: fixAll(proposal.exclusions),
    assumptions: cleanAssumptions(proposal.assumptions),
  };
  if (unknown.length > 0) {
    // Shown to the user, so cleaned and cut like any AI text.
    const named = unique(unknown).map((value) => cutText(cleanAiText(value), MAX_SUMMARY_VALUE_CHARS));
    return { proposal: null, note: VALIDATE_TEXT.notInFile(named) };
  }

  const rechecked = searchBriefSchema.safeParse(corrected);
  return rechecked.success ? { proposal: rechecked.data, note: null } : { proposal: null, note: VALIDATE_TEXT.doesNotFit };
}

export function parseInterviewReply(raw: unknown, summary: FileSummary): ParsedInterviewReply {
  // Step 1: shape.
  const value = fromTransport(readJson(raw));
  let message: string;
  let proposal: SearchBrief | null;
  let note: string | null = null;

  const full = interviewReplySchema.safeParse(value);
  if (full.success) {
    ({ message, proposal } = full.data);
  } else {
    // The message may be fine and only the proposal break a brief rule: keep the message.
    if (!isPlainObject(value) || value.proposal === null || value.proposal === undefined) return SHAPE;
    const messageOnly = interviewReplySchema.safeParse({ ...value, proposal: null });
    if (!messageOnly.success) return SHAPE;
    message = messageOnly.data.message;
    proposal = null;
    note = VALIDATE_TEXT.doesNotFit;
  }

  // Step 2: text.
  message = cleanAiText(message);
  if (message === "") return SHAPE;

  // Step 3: the proposal.
  if (proposal !== null) ({ proposal, note } = checkProposal(proposal, summary));
  return { ok: true, reply: { message, proposal }, note };
}
