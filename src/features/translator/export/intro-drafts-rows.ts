import type { RankResult } from "../ranking";
import { compareRecordIds } from "../ranking/compare-ids";

/**
 * The Intro drafts sheet as plain data (TR-52): the intros the user drafted (TR-49), as they left
 * them. `workbook.ts` turns the table into the sheet, and this file knows nothing about ExcelJS.
 *
 * Only the draft text the user kept is exported, with the record it is for. Never the AI's own
 * text when the user changed it, the user's note, the chat or the file summary.
 *
 * Pure and deterministic: no React, no I/O, no logging. Same drafts and same ranking result give
 * the same rows in the same order.
 */

/**
 * What the table needs from one intro draft (`IntroDraft` in `ai/intro-session.ts`): the text as
 * the user last left it, and the company it was written for.
 */
export type ExportIntroDraft = { draft: string; intro: { company: string } };

/** The column keys, in sheet order. */
export type IntroDraftColumnKey = "rank" | "recordId" | "company" | "draft";

// Every string the Intro drafts sheet shows. Plain language, no em-dashes.
export const INTRO_DRAFTS_TEXT = {
  headers: {
    rank: "Rank",
    recordId: "Record ID",
    company: "Company",
    draft: "Draft",
  } satisfies Record<IntroDraftColumnKey, string>,
  /** The Rank of a draft whose record isn't in the current shortlist. */
  notInShortlist: "Not in shortlist",
} as const;

const COLUMN_KEYS: readonly IntroDraftColumnKey[] = ["rank", "recordId", "company", "draft"];

/** One sheet row: Rank (a number, or `notInShortlist`), Record ID, Company, Draft. */
export type IntroDraftRow = readonly [rank: number | string, recordId: string, company: string, draft: string];

export type IntroDraftsTable = {
  columns: { key: IntroDraftColumnKey; header: string }[];
  rows: IntroDraftRow[];
};

/**
 * The Intro drafts table for `drafts` (by Record ID, `IntroSessionState.drafts`), or null when
 * there is nothing to export.
 *
 * - Rank: the record's rank in `rankResult.shortlist`, or `Not in shortlist` when a later change
 *   took it out of the list. Those drafts are kept: the user wrote them.
 * - Draft: the current text, the user's edits included, line breaks kept.
 * - A draft that is empty after trimming is left out. No drafts left: null, so there is no sheet.
 * - Order: by rank, then the drafts not in the shortlist in Record ID order (`compareRecordIds()`).
 */
export function introDraftsTable(
  drafts: Readonly<Record<string, ExportIntroDraft>>,
  rankResult: RankResult,
): IntroDraftsTable | null {
  const rankById = new Map(rankResult.shortlist.map((row) => [row.record.normalized.recordId, row.rank]));
  const kept = Object.entries(drafts)
    .filter(([, { draft }]) => draft.trim() !== "")
    .map(([recordId, { draft, intro }]) => ({ recordId, rank: rankById.get(recordId) ?? null, draft, company: intro.company }));
  if (kept.length === 0) return null;

  kept.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank || compareRecordIds(a.recordId, b.recordId);
    if (a.rank !== null || b.rank !== null) return a.rank !== null ? -1 : 1;
    return compareRecordIds(a.recordId, b.recordId);
  });

  return {
    columns: COLUMN_KEYS.map((key) => ({ key, header: INTRO_DRAFTS_TEXT.headers[key] })),
    rows: kept.map(({ recordId, rank, draft, company }): IntroDraftRow => [
      rank ?? INTRO_DRAFTS_TEXT.notInShortlist,
      recordId,
      company,
      draft,
    ]),
  };
}
