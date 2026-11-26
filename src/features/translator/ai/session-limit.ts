/**
 * Capability: the AI request limit for one Translator session (TR-51).
 * Input: how many requests this session has sent to `/api/translator/ai`.
 * Output: whether another may be sent, how many are left, and what to tell the user.
 * A courtesy limit in the browser, with a clear message: a reload or Start over resets it. The
 * real cost guard is the route's own rate limit (30 requests per 10 minutes per admin, TR-39).
 * Privacy: counts requests only. Nothing is sent, stored or logged.
 * This module is pure (no React, no I/O).
 */

/** Most AI requests one session may send (chat messages and intro drafts together). */
export const AI_SESSION_LIMIT = 40;

/** From this many left, the count is shown near the chat input and in the intro panel. */
export const SHOW_REMAINING_FROM = 5;

// The limit's strings. Plain language, no em-dashes.
export const SESSION_LIMIT_TEXT = {
  /** "5 AI requests left in this session." */
  left: (count: number) => `${count} AI ${count === 1 ? "request" : "requests"} left in this session.`,
  reached: "You've reached the AI limit for this session. Use the form, or start over to reset.",
} as const;

/** True while another AI request may be sent. */
export const canUseAi = (count: number): boolean => count < AI_SESSION_LIMIT;

/** How many AI requests are left, never below 0. */
export const remaining = (count: number): number => Math.max(0, AI_SESSION_LIMIT - count);

/**
 * What to show about the limit: the "reached" message at the limit, the count when
 * SHOW_REMAINING_FROM or fewer are left, otherwise nothing.
 */
export function limitNotice(count: number): string | null {
  if (!canUseAi(count)) return SESSION_LIMIT_TEXT.reached;
  const left = remaining(count);
  return left <= SHOW_REMAINING_FROM ? SESSION_LIMIT_TEXT.left(left) : null;
}
