/**
 * The form two pieces of text are compared in. Workbook values (normalize.ts) and SearchBrief
 * values (TR-17) must both go through this one function, so they always line up.
 *
 * Steps, in order: Unicode NFKC (so a non-breaking space is a space and full-width letters are
 * plain ones), trim the ends, collapse inner whitespace to one space, then lower case. Lower
 * casing uses `toLowerCase()`, not the browser's locale, so every machine gives the same key.
 *
 * Deliberately conservative: no punctuation stripping ("St. Louis" and "St Louis" stay
 * different), no abbreviations ("Arizona" doesn't become "AZ") and no stemming. See
 * docs/KNOWN-ISSUES.md.
 *
 * Pure: no React, no I/O.
 */
export function matchKey(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}
