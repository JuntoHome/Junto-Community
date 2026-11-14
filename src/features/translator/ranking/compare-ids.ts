/**
 * Record ID order (TR-19), the tiebreak when two records have the same score. It must give the
 * same answer in every browser, so it never uses `localeCompare()` or `Intl.Collator`, whose
 * results depend on the browser and its locale data.
 *
 * Pure and deterministic: no React, no I/O, no logging.
 */

const ALL_DIGITS = /^[0-9]+$/;

/** Plain UTF-16 code unit order, the same in every JavaScript engine. */
function compareCodeUnits(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * Compares two Record IDs for an ascending sort. Returns a negative number when `a` comes first,
 * a positive number when `b` does, and 0 only when they are the same string.
 *
 * 1. IDs made only of digits (IUSA Numbers) come before every other ID. Between two of them the
 *    shorter one comes first, then code unit order. That is numeric order for IDs without leading
 *    zeros, without turning them into numbers, so long IDs keep every digit: `9001` comes before
 *    `123456789`, where plain text order would put it after.
 * 2. Any other two IDs (`ROW-0001`, `SYN-0001`): code unit order of the upper-cased IDs, then of
 *    the IDs as written, so `ROW-0002` comes before `SYN-0001`. `toUpperCase()` doesn't depend on
 *    the locale. The second comparison only matters for IDs that are equal once upper-cased,
 *    which the row checks (TR-11) never let through together.
 *
 * Digit IDs go first as a group, rather than being compared as text with the others, so the order
 * stays consistent: compared as text, `10` comes before `1A`, `1A` before `9` and `9` before `10`,
 * a loop that would let input order change the result. Text order already puts digits before
 * letters, so for the IDs this tool makes (`ROW-0001`) and the sample's (`SYN-0001`) the result is
 * the same.
 */
export function compareRecordIds(a: string, b: string): number {
  const aDigits = ALL_DIGITS.test(a);
  const bDigits = ALL_DIGITS.test(b);
  if (aDigits && bDigits) return a.length - b.length || compareCodeUnits(a, b);
  if (aDigits !== bDigits) return aDigits ? -1 : 1;
  return compareCodeUnits(a.toUpperCase(), b.toUpperCase()) || compareCodeUnits(a, b);
}
