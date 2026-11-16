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
  console.error(`[translator] ${code}`);
}
