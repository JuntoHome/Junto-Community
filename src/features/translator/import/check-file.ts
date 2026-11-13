/**
 * The first checks on a chosen workbook, before anything else reads it. They run in the
 * browser on every workbook, uploaded or sample, and stop at the first problem.
 *
 * Only the size, the name and the first 4 bytes are looked at. The browser's MIME type
 * (`file.type`) is ignored because it is unreliable. The contents are not validated here:
 * any real ZIP named .xlsx passes (a renamed .docx too). The file gate (TR-07) and the
 * parser (TR-08) catch those.
 *
 * Pure: no React, no network, no logging.
 */

// Messages. They name the problem and say how to fix it.
export const WORKBOOK_FILE_MESSAGES = {
  count: "Choose one .xlsx file.",
  empty: "This file is empty. Choose a .xlsx file that contains your contacts.",
  tooLarge: "This file is larger than 2 MB. Please upload a smaller .xlsx file.",
  extension: "Only .xlsx files are supported. If your file is .xls or .csv, open it in Excel and save it as .xlsx.",
  signature: "This file isn't a valid .xlsx workbook. Open it in Excel and save it as .xlsx again.",
} as const;

export type WorkbookFileProblem = keyof typeof WORKBOOK_FILE_MESSAGES;

/** Largest accepted workbook: 2 MB. */
export const MAX_WORKBOOK_BYTES = 2 * 1024 * 1024;

/** Every .xlsx is a ZIP archive, and a ZIP starts with these bytes ("PK\3\4"). */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04] as const;

/**
 * What can be handed in: one `File` (a sample), or the list from a file input or a drop,
 * which may hold zero or several files.
 */
export type WorkbookFileInput = File | ArrayLike<File> | null | undefined;

export type WorkbookFileCheck =
  | { ok: true; file: File }
  | { ok: false; code: WorkbookFileProblem; message: string };

const fail = (code: WorkbookFileProblem): WorkbookFileCheck => ({
  ok: false,
  code,
  message: WORKBOOK_FILE_MESSAGES[code],
});

function onlyFile(input: WorkbookFileInput): File | null {
  if (input == null) return null;
  if (input instanceof File) return input;
  return input.length === 1 ? input[0] : null;
}

/** True when the file starts with the ZIP signature. Reads only the first 4 bytes. */
async function hasZipSignature(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, ZIP_SIGNATURE.length).arrayBuffer());
    return ZIP_SIGNATURE.every((byte, i) => head[i] === byte);
  } catch {
    // The browser couldn't read it (a dropped folder, or the file changed on disk).
    return false;
  }
}

/**
 * Checks, in order: exactly one file, not empty, at most 2 MB, name ends in .xlsx (any
 * case), starts with the ZIP signature. Returns the file, or the first problem found.
 */
export async function checkWorkbookFile(input: WorkbookFileInput): Promise<WorkbookFileCheck> {
  const file = onlyFile(input);
  if (!file) return fail("count");
  if (file.size === 0) return fail("empty");
  if (file.size > MAX_WORKBOOK_BYTES) return fail("tooLarge");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return fail("extension");
  if (!(await hasZipSignature(file))) return fail("signature");
  return { ok: true, file };
}
