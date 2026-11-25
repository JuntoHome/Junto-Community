/**
 * Capability: limits that keep an AI call safe.
 * - `withTimeout()`: a promise's value, or a fallback when it takes too long.
 * - `sanitizeSummaryValue()`: one workbook value made safe for the file summary, or null to drop it.
 * - `cleanAiText()` and `cutText()`: AI text made fit to show (no em-dashes, one space, a length cap).
 * Privacy: `withTimeout()` handles no content. `sanitizeSummaryValue()` drops values that look
 * like contact data, so a column holding the wrong data can't leak an email, phone or website.
 * This module is pure (no React, no I/O).
 */

/**
 * How long one AI call (one attempt) may take, in milliseconds. The OpenAI client uses the same
 * limit, and each capability wraps every attempt in `withTimeout()` with it (TR-42).
 */
export const AI_ATTEMPT_TIMEOUT_MS = 12_000;

/**
 * How long one request to the route may take, retry included, in milliseconds. Two attempts
 * (12 + 12 s) fit inside it. The route's `maxDuration` (30 s) leaves room for the rest.
 */
export const AI_REQUEST_TIMEOUT_MS = 25_000;

/** Longest value the file summary may hold, in characters (UTF-16 code units, as zod counts them). */
export const MAX_SUMMARY_VALUE_CHARS = 80;

/**
 * Control characters, tabs and line breaks included. The Unicode line and paragraph separators
 * (U+2028, U+2029) aren't listed: `\s` matches them, so the space collapse turns them into spaces.
 */
const CONTROL_OR_LINE_BREAK = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * True when `text` looks like contact data: it contains `@`, `http` or `www.` (any case), or 7
 * or more digits in all. `sanitizeSummaryValue()` drops such values in the browser, and
 * `fileSummarySchema` refuses them on the server, so both use this one rule.
 */
export const looksLikeContactData = (text: string) =>
  text.includes("@") ||
  /http|www\./i.test(text) ||
  (text.match(/[0-9]/g)?.length ?? 0) >= 7;

/**
 * One value made safe for the file summary (TR-40), or null when it must be left out.
 *
 * 1. Control characters and line breaks become spaces, runs of spaces become one, ends are trimmed.
 * 2. Null (drop) when nothing is left, or when the value looks like contact data: it contains
 *    `@`, `http` or `www.` (any case), or 7 or more digits in all ("602 555 0100" has 10).
 *    Checked on the whole value, before it is cut, and dropped rather than masked, so no part
 *    of it gets through.
 * 3. Cut to MAX_SUMMARY_VALUE_CHARS, without splitting an emoji or other two-unit character,
 *    and trimmed again.
 */
export function sanitizeSummaryValue(text: string): string | null {
  const clean = text
    .replace(CONTROL_OR_LINE_BREAK, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean === "" || looksLikeContactData(clean)) return null;
  return cutText(clean, MAX_SUMMARY_VALUE_CHARS);
}

/**
 * `text` cut to at most `max` characters (UTF-16 code units), without splitting an emoji or
 * other two-unit character, and trimmed at the end.
 */
export function cutText(text: string, max: number): string {
  let cut = text.slice(0, max);
  // A high surrogate at the end is half of a two-unit character: leave it out.
  if (/[\ud800-\udbff]$/.test(cut)) cut = cut.slice(0, -1);
  return cut.trimEnd();
}

/** Spaces, tabs and other whitespace except a line break. */
const INLINE_SPACE = "[^\\S\\n]";
const DASH_WITH_SPACES = new RegExp(`${INLINE_SPACE}*[—–]${INLINE_SPACE}*`, "g");
const INLINE_SPACES = new RegExp(`${INLINE_SPACE}+`, "g");

/**
 * AI text made fit to show (TR-42): each em-dash or en-dash, with the spaces around it, becomes
 * ", "; runs of spaces become one space (line breaks are kept); the ends are trimmed. The
 * prompt already asks for no em-dashes; this makes sure.
 */
export function cleanAiText(text: string): string {
  return text.replace(DASH_WITH_SPACES, ", ").replace(INLINE_SPACES, " ").trim();
}

/**
 * `promise`'s value, or `onTimeout()` after `ms` milliseconds, whichever comes first. Holds
 * even if the SDK ignores its own timeout. A rejection is passed on; the timer is always cleared.
 */
export function withTimeout<T, F>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => F,
): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
