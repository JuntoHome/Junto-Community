/**
 * Why something failed unexpectedly. A fixed code, never data: only these values can be logged.
 *
 * - `file-unreadable`: the browser couldn't read the chosen file.
 * - `parser-unavailable`: the parser's code couldn't be downloaded.
 * - `sample-load-failed`: a bundled sample couldn't be fetched.
 * - `export-failed`: the Excel file couldn't be built or saved.
 */
export type TranslatorErrorCode = "file-unreadable" | "parser-unavailable" | "sample-load-failed" | "export-failed";

/**
 * The only way Translator code writes to the console (TR-28): `[translator] <code>`. It never
 * takes the error object, its message, a file name or a value, because those can quote workbook
 * contents (ExcelJS errors can echo cell text). The user sees a plain-language message instead.
 */
export function logTranslatorError(code: TranslatorErrorCode): void {
  // One string literal per code, never built from a value, so the static test
  // (`__tests__/no-content-logging.test.ts`, TR-51) can prove nothing else is logged.
  switch (code) {
    case "file-unreadable":
      console.error("[translator] file-unreadable");
      return;
    case "parser-unavailable":
      console.error("[translator] parser-unavailable");
      return;
    case "sample-load-failed":
      console.error("[translator] sample-load-failed");
      return;
    case "export-failed":
      console.error("[translator] export-failed");
      return;
  }
}
