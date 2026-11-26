/**
 * Capability: what the user sees when the AI fails (TR-50): the message and the actions for each
 * kind of failure from `postAi()`. The chat panel only renders them.
 * Input: the failure kind and the route's own `error` text, if any.
 * Output: the message to show and which buttons to offer.
 * Privacy: reads only the failure. Nothing is sent, stored or logged.
 * This module is pure (no React, no I/O).
 */
import type { AiFailureKind } from "./post-ai";

// The fallback's strings. Plain language, no em-dashes.
export const FALLBACK_TEXT = {
  aiFailure: "The AI didn't respond. Your criteria so far are kept. You can try again or use the form.",
  sessionExpired: "Your login has expired. Log in again to keep using the AI.",
  logInAgain: "Log in again",
  /** Under Log in again, which opens the login page in a new tab. */
  logInHelp: "Then come back here and press Try again. Your work on this page is kept.",
  /** Also the note above the form once the AI is off for the session (503). */
  unavailable: "The AI assistant is not available right now. Use the form instead.",
  /** For a 413, 429 or 400 that came without the route's own text. */
  somethingWrong: "Something went wrong with that request. Try again, or use the form.",
  tryAgain: "Try again",
  useForm: "Use the form",
  startOverChat: "Start over chat",
  /** Above the form after two AI failures in a row on the Criteria step. */
  switchedToForm: "The AI isn't responding, so we switched to the form. Your criteria so far are filled in.",
  /** Above the form after Use the form on the Results step's chat. */
  resultsUnchanged: "Your current results haven't changed.",
  /** The banner while the failure simulation is on. */
  simulationBanner: "Test mode: AI failures are simulated. Remove ?aiFail=1 from the address to turn it off.",
} as const;

/** Where Log in again goes. Opened in a new tab, so nothing on this page is lost. */
export const LOGIN_PATH = "/admin/login";

/** The message for a failure. 413, 429 and 400 show the route's own text, which says what to do. */
export function failureMessage(kind: AiFailureKind, error: string | null): string {
  switch (kind) {
    case "ai-failure":
    case "network":
      return FALLBACK_TEXT.aiFailure;
    case "session-expired":
      return FALLBACK_TEXT.sessionExpired;
    case "unavailable":
      return FALLBACK_TEXT.unavailable;
    case "too-long":
    case "rate-limited":
    case "bad-request":
      return error ?? FALLBACK_TEXT.somethingWrong;
  }
}

/** The buttons under a failure message. */
export type FailureActions = { tryAgain: boolean; useForm: boolean; logIn: boolean; startOverChat: boolean };

/**
 * Which buttons a failure offers. `unavailable` offers none: the AI is turned off for the session
 * and the form shows on its own.
 */
export function failureActions(kind: AiFailureKind): FailureActions {
  switch (kind) {
    case "ai-failure":
    case "network":
    case "rate-limited":
    case "bad-request":
      return { tryAgain: true, useForm: true, logIn: false, startOverChat: false };
    case "session-expired":
      return { tryAgain: true, useForm: true, logIn: true, startOverChat: false };
    case "too-long":
      return { tryAgain: false, useForm: true, logIn: false, startOverChat: true };
    case "unavailable":
      return { tryAgain: false, useForm: false, logIn: false, startOverChat: false };
  }
}
