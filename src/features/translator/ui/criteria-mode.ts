/**
 * How the Criteria step is filled in (TR-43). No React, so it can be tested in Node.
 * - `choose`: the chooser, Chat with AI or the form. Only when the AI is on.
 * - `chat`: Chat with AI (the chat itself is TR-44).
 * - `form`: the Phase 1 form.
 * The wizard holds the mode, so Start over and a new workbook reset it with the remount (TR-28).
 */
export type CriteriaMode = "choose" | "chat" | "form";

/** The mode a new session starts in: the chooser when the AI is on, otherwise the form, as in Phase 1. */
export function initialCriteriaMode(aiEnabled: boolean): CriteriaMode {
  return aiEnabled ? "choose" : "form";
}

/** Announced after the user chooses or switches, so screen readers hear what opened. */
export const MODE_ANNOUNCEMENT = {
  chat: "Showing the chat.",
  form: "Showing the form.",
} as const satisfies Record<Exclude<CriteriaMode, "choose">, string>;
