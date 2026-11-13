/**
 * The workbooks the Translator accepts during Phase 1, identified by their SHA-256 hash.
 * The file gate (`file-gate.ts`) refuses any workbook whose hash isn't listed here, so
 * real contact data can't be processed by accident. It runs in the browser, so it is a
 * guardrail, not a security control.
 *
 * Any change to a file changes its hash, even opening it in Excel and saving it again
 * without edits. To approve a new or updated file, compute its hash and add an entry:
 *
 *   macOS / Linux:  shasum -a 256 <file>
 *   Windows:        Get-FileHash -Algorithm SHA256 <file>
 *
 * Paste the hash in lowercase. Keep any copy of a listed file (for example the sample in
 * `public/translator/`) byte-identical, or it will be refused too.
 *
 * Pure: no React, no network, no logging.
 */

export type AllowedWorkbook = {
  /** SHA-256 of the whole file, 64 lowercase hex characters. */
  sha256: string;
  /** The file's usual name. For reference only: the gate matches on the hash, not the name. */
  fileName: string;
  /**
   * Which column layout the file uses. Information only: the parser (TR-08) must detect
   * the layout from the headers and not trust this field.
   */
  layout: "synthetic" | "reference-solutions";
  /** Where the file comes from and anything else worth knowing. */
  note: string;
};

export const ALLOWED_WORKBOOKS: readonly AllowedWorkbook[] = [
  {
    sha256: "67a510867ed6c7273cfebabea5c6895e43bd2cae2c98395acd09146ba6ed580b",
    fileName: "JCA_Synthetic_Contacts.xlsx",
    layout: "synthetic",
    note: "500 fictional records in the 9-column synthetic layout. Also served as the Load sample file from public/translator/.",
  },
  // TR-35 adds the Reference Solutions layout synthetic file here.
];
