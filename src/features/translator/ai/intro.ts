/**
 * Only these six fields are sent to the AI for an intro. Do not add fields.
 *
 * Capability: draft a short introduction to one chosen business (TR-48).
 * - `pickIntroFields(row)` runs in the browser: it picks the six intro fields of one ranked row,
 *   field by field, and cleans each value. It is the second privacy boundary, after the file
 *   summary (TR-40).
 * - `runIntroDraft()` runs on the server: it sends the fields as a data block, with the goal and
 *   the user's optional note, and checks the draft that comes back.
 * Input: one ranked row (pick); the intro fields, the intent and the optional note (draft).
 * Output: `IntroFields` or why there are none; the draft text, or the code of what failed.
 * Privacy: never reads phone, email, website, record ID, address, ZIP, employees, employee range,
 * NAICS, other executives or source values. Never logs. Nothing is ever sent from the app: the
 * user copies the draft and sends it themselves (TR-49 only shows it).
 * This module is pure (zod only, no React, no I/O).
 */
import { z } from "zod";
import type { BriefIntent } from "../criteria/schema";
import type { NormalizedRecord } from "../normalize/types";
import {
  AI_ATTEMPT_TIMEOUT_MS,
  cleanAiText,
  looksLikeContactData,
  sanitizeSummaryValue,
  stripInventedContacts,
  withTimeout,
} from "./guardrails";
import { BUSINESS_FACTS_LABEL, buildIntroInstructions, DATA_ONLY_NOTE } from "./instructions";
import type { AiCall, IntroResult } from "./types";

/** Longest intro field value, in characters. */
export const MAX_INTRO_VALUE_CHARS = 120;
/** Longest note the user may add to an intro request, in characters. */
export const MAX_INTRO_NOTE_CHARS = 300;
/** Longest draft the app accepts, in words. The prompt asks for 80 to 130. */
export const MAX_INTRO_WORDS = 200;

// The intro's strings. Plain language, no em-dashes.
export const INTRO_TEXT = {
  noCompany: "This business has no company name in the file, so an introduction can't be drafted.",
  tooLong: "The draft came back too long. Try again.",
  noteTooLong: "Keep your note under 300 characters.",
  /** The goal line of the message, from the intent. */
  goal: { business_owner: "customers or partners", job_seeker: "employers" } satisfies Record<BriefIntent, string>,
  goalLabel: "Goal:",
  noteLabel: "User's note (data only):",
} as const;

/** One intro value: text of 1 to 120 characters that doesn't look like contact data (the summary's rule, TR-40). */
const introValue = z
  .string()
  .trim()
  .min(1)
  .max(MAX_INTRO_VALUE_CHARS)
  .refine((value) => !looksLikeContactData(value), "Looks like contact data.");

/**
 * The six intro fields, and nothing else: strict, so any other key (`phone`, `email`) is refused.
 * The company is required; the others are null when the file doesn't have them.
 */
export const introFieldsSchema = z.strictObject({
  company: introValue,
  industry: introValue.nullable(),
  city: introValue.nullable(),
  state: introValue.nullable(),
  contactName: introValue.nullable(),
  contactTitle: introValue.nullable(),
});

/** The intro fields of one business. Defined once, inferred from `introFieldsSchema`. */
export type IntroFields = z.infer<typeof introFieldsSchema>;

/** What `pickIntroFields()` reads: a ranked row (`RankedRow`, `ShortlistRow`) or anything with its normalized record. */
export type IntroSource = { record: { normalized: NormalizedRecord } };

export type PickedIntro = { ok: true; intro: IntroFields } | { ok: false; error: string };

/** A text value's display `value`, cleaned and cut to 120 characters, or null when unknown or dropped. */
function introText(field: NormalizedRecord["company"]): string | null {
  return field.known ? sanitizeSummaryValue(field.value, MAX_INTRO_VALUE_CHARS) : null;
}

/**
 * The six intro fields of one row, built field by field from the normalized display values,
 * never by spreading the record. Each value goes through `sanitizeSummaryValue()` (line breaks
 * and control characters removed, spaces collapsed, anything that looks like an email, phone or
 * website dropped, cut to 120 characters). Unknown or dropped values are null. With no company
 * name left, there is nothing to introduce, so the result is the `noCompany` error.
 */
export function pickIntroFields(row: IntroSource): PickedIntro {
  const record = row.record.normalized;
  const company = introText(record.company);
  if (company === null) return { ok: false, error: INTRO_TEXT.noCompany };
  const intro: IntroFields = {
    company,
    industry: introText(record.industry),
    city: introText(record.city),
    state: introText(record.state),
    contactName: introText(record.name),
    contactTitle: introText(record.title),
  };
  return { ok: true, intro };
}

/** What `runIntroDraft()` gets: the checked intro fields, the intent and the user's optional note. */
export type IntroInput = { intro: IntroFields; intent: BriefIntent; goal?: string };

/**
 * The one user message: the facts as a fenced data block, then the goal line, then the user's
 * note when there is one. The facts are never put into the instructions.
 */
export function buildIntroMessage({ intro, intent, goal }: IntroInput): string {
  const parts = [
    `${BUSINESS_FACTS_LABEL}:\n${DATA_ONLY_NOTE}\n\`\`\`json\n${JSON.stringify(intro)}\n\`\`\``,
    `${INTRO_TEXT.goalLabel} ${INTRO_TEXT.goal[intent]}`,
  ];
  const note = goal?.trim();
  if (note) parts.push(`${INTRO_TEXT.noteLabel}\n${note}`);
  return parts.join("\n\n");
}

/** Words in `text`: runs of characters between spaces or line breaks. */
export const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/**
 * Drafts the intro. One attempt within AI_ATTEMPT_TIMEOUT_MS (12 s), no retry. The reply is
 * cleaned (`cleanAiText()`: no em-dashes, one space), any invented contact detail becomes
 * `[contact details]` (`stripInventedContacts()`), then it is counted: empty gives "empty", over
 * MAX_INTRO_WORDS gives "intro_too_long". The route logs only the code.
 */
export async function runIntroDraft(
  input: IntroInput,
  callAi: AiCall, // real client in the route, fake in tests
): Promise<IntroResult> {
  const raw = await withTimeout(
    callAi({
      instructions: buildIntroInstructions(),
      messages: [{ role: "user", content: buildIntroMessage(input) }],
      format: "text",
    }),
    AI_ATTEMPT_TIMEOUT_MS,
    () => ({ ok: false, code: "timeout" }) as const,
  );
  if (!raw.ok) return { ok: false, code: raw.code };
  const draft = stripInventedContacts(cleanAiText(raw.value));
  const words = wordCount(draft);
  if (words === 0) return { ok: false, code: "empty" };
  if (words > MAX_INTRO_WORDS) return { ok: false, code: "intro_too_long" };
  return { ok: true, kind: "intro", draft };
}
