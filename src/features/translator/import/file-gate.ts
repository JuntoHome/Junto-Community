/**
 * The file gate: during Phase 1 only the workbooks listed in `allowlist.ts` are accepted,
 * matched by the SHA-256 hash of the whole file. It runs in the browser after
 * `checkWorkbookFile()` (size and type), so the file read here is at most 2 MB.
 *
 * Fails closed: if the browser can't compute the hash (no secure context), the workbook
 * is refused. The hash is never logged or sent anywhere.
 *
 * Pure: no React, no network, no logging.
 */

import { ALLOWED_WORKBOOKS, type AllowedWorkbook } from "./allowlist";

// Messages. They name the problem and say how to fix it.
export const FILE_GATE_MESSAGES = {
  notAllowed:
    "Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it.",
  insecureContext:
    "This page needs a secure connection (https) to check the file. Open it from the staging or localhost address.",
  unreadable: "This file couldn't be read. Choose it again, or use the Load sample button.",
} as const;

export type FileGateProblem = keyof typeof FILE_GATE_MESSAGES;

export type FileGateCheck =
  | { ok: true; entry: AllowedWorkbook }
  | { ok: false; code: FileGateProblem; message: string };

/**
 * A workbook that passed the file gate. `buffer` holds the bytes that were hashed, so the
 * parser (TR-08) reads these and never reads the file again.
 */
export type GatedWorkbook = { file: File; buffer: ArrayBuffer; entry: AllowedWorkbook };

const fail = (code: FileGateProblem): FileGateCheck => ({
  ok: false,
  code,
  message: FILE_GATE_MESSAGES[code],
});

/**
 * SHA-256 of `buffer` as 64 lowercase hex characters. Needs `crypto.subtle`, which
 * browsers only provide on https or localhost; throws when it is missing.
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error("crypto.subtle is not available");
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Finds the allowlist entry for this workbook's bytes, or says why it is refused. */
export async function checkAllowlist(buffer: ArrayBuffer): Promise<FileGateCheck> {
  let hash: string;
  try {
    hash = await sha256Hex(buffer);
  } catch {
    // No secure context (for example http on a LAN address). Never skip the gate.
    return fail("insecureContext");
  }
  const entry = ALLOWED_WORKBOOKS.find((allowed) => allowed.sha256 === hash);
  return entry ? { ok: true, entry } : fail("notAllowed");
}
