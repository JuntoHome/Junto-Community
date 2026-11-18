/**
 * Loads one chosen workbook: the upload checks, one read of the file, the file gate and the
 * parser, in that order, stopping at the first problem (TR-31 moved this out of the wizard so it
 * can be tested from a `File`). The wizard (`ui/translator-wizard.tsx`) calls it for every
 * workbook, uploaded or sample, then normalizes the parsed rows.
 *
 * 1. `checkWorkbookFile()`: one file, not empty, at most 2 MB, .xlsx name, ZIP signature.
 * 2. `file.arrayBuffer()`: the only full read of the file.
 * 3. `checkAllowlist()`: the SHA-256 of those bytes must be in the allowlist.
 * 4. `parseWorkbook()` on the same bytes, loaded with `import()` on first use so ExcelJS isn't
 *    part of the page's first download.
 *
 * Pure: no React and no logging. When something unexpected fails, the result names the code the
 * caller should log (`logTranslatorError()` in `ui/`), never the error itself.
 */

import { checkWorkbookFile, type WorkbookFileInput, type WorkbookFileProblem } from "./check-file";
import { checkAllowlist, FILE_GATE_MESSAGES, type FileGateProblem, type GatedWorkbook } from "./file-gate";
import type { ParsedWorkbook, ParseResult } from "./parse";

export const LOAD_MESSAGES = {
  /** The parser's code couldn't be downloaded. */
  parserUnavailable: "The Translator couldn't finish loading. Check your connection, reload the page and try again.",
} as const;

/** A workbook that passed every step: the gated file and bytes, and what the parser read. */
export type LoadedWorkbook = GatedWorkbook & { parsed: ParsedWorkbook };

/** An unexpected failure the caller should log, by its code only. */
export type LoadLogCode = "file-unreadable" | "parser-unavailable";

export type LoadFailure = {
  ok: false;
  /** The step that refused the file. */
  step: "check" | "read" | "gate" | "parser" | "parse";
  code: WorkbookFileProblem | FileGateProblem | Extract<ParseResult, { ok: false }>["code"] | "parserUnavailable";
  /** What to show on the Upload step. A parse hint, when there is one, is on its own line. */
  message: string;
  /** Set only for failures that aren't the user's to fix. */
  log: LoadLogCode | null;
};

export type LoadResult = { ok: true; workbook: LoadedWorkbook } | LoadFailure;

/**
 * Runs the four steps on `input`. `isCurrent` is asked after each step that waits; once it says
 * false (the user chose another file meanwhile), loading stops and the result is `null`, so a
 * slow file can't replace a newer choice. A failure to log is still returned, so it is logged
 * even when a newer choice has started.
 */
export async function loadWorkbook(
  input: WorkbookFileInput,
  isCurrent: () => boolean = () => true,
): Promise<LoadResult | null> {
  const check = await checkWorkbookFile(input);
  if (!isCurrent()) return null;
  if (!check.ok) return { ok: false, step: "check", code: check.code, message: check.message, log: null };
  const file = check.file;

  // The only full read of the file. The size check above caps it at 2 MB.
  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    // The browser couldn't read it (for example, the file changed on disk after it was chosen).
    return { ok: false, step: "read", code: "unreadable", message: FILE_GATE_MESSAGES.unreadable, log: "file-unreadable" };
  }
  if (!isCurrent()) return null;

  const gate = await checkAllowlist(buffer);
  if (!isCurrent()) return null;
  if (!gate.ok) return { ok: false, step: "gate", code: gate.code, message: gate.message, log: null };

  // The layout comes from the headers, never from gate.entry.layout.
  let parsed: ParseResult;
  try {
    const { parseWorkbook } = await import("./parse");
    parsed = await parseWorkbook(buffer);
  } catch {
    // parseWorkbook never throws, so only the download of its code can fail here.
    return {
      ok: false,
      step: "parser",
      code: "parserUnavailable",
      message: LOAD_MESSAGES.parserUnavailable,
      log: "parser-unavailable",
    };
  }
  if (!isCurrent()) return null;
  if (!parsed.ok) {
    const message = parsed.hint ? `${parsed.message}\n${parsed.hint}` : parsed.message;
    return { ok: false, step: "parse", code: parsed.code, message, log: null };
  }

  return { ok: true, workbook: { file, buffer, entry: gate.entry, parsed: parsed.workbook } };
}
