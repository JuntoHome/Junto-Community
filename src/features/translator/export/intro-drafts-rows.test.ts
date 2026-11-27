import { describe, expect, it } from "vitest";
import type { RankResult } from "../ranking";
import { type ExportIntroDraft, INTRO_DRAFTS_TEXT, introDraftsTable } from "./intro-drafts-rows";

/** A ranking result with just the shortlist the table reads: these Record IDs at ranks 1, 2, ... */
function shortlistOf(ids: readonly string[]): RankResult {
  const shortlist = ids.map((recordId, i) => ({ rank: i + 1, record: { normalized: { recordId } } }));
  return { shortlist } as unknown as RankResult;
}

const draft = (company: string, text: string): ExportIntroDraft => ({ draft: text, intro: { company } });

describe("introDraftsTable", () => {
  const ranked = shortlistOf(["SYN-0006", "SYN-0002", "SYN-0003", "SYN-0004", "SYN-0005", "SYN-0010", "SYN-0001"]);

  it("is null with no drafts", () => {
    expect(introDraftsTable({}, ranked)).toBeNull();
  });

  it("is null when the only draft is empty after trimming", () => {
    expect(introDraftsTable({ "SYN-0001": draft("Synthetic Co 0001", "  \n\t ") }, ranked)).toBeNull();
  });

  it("has the columns Rank, Record ID, Company, Draft", () => {
    const table = introDraftsTable({ "SYN-0001": draft("Synthetic Co 0001", "Hello") }, ranked);
    expect(table?.columns.map((c) => c.header)).toEqual(["Rank", "Record ID", "Company", "Draft"]);
  });

  it("lists drafts by rank, then the ones not in the shortlist by Record ID, and skips empty ones", () => {
    const table = introDraftsTable(
      {
        "SYN-0300": draft("Synthetic Co 0300", "Out of the list"),
        "SYN-0001": draft("Synthetic Co 0001", "Line one\nLine two"),
        "SYN-0020": draft("Synthetic Co 0020", "Also out"),
        "SYN-0004": draft("Synthetic Co 0004", " "),
        "SYN-0006": draft("Synthetic Co 0006", "First"),
      },
      ranked,
    );
    expect(table?.rows).toEqual([
      [1, "SYN-0006", "Synthetic Co 0006", "First"],
      [7, "SYN-0001", "Synthetic Co 0001", "Line one\nLine two"],
      [INTRO_DRAFTS_TEXT.notInShortlist, "SYN-0020", "Synthetic Co 0020", "Also out"],
      [INTRO_DRAFTS_TEXT.notInShortlist, "SYN-0300", "Synthetic Co 0300", "Out of the list"],
    ]);
    expect(INTRO_DRAFTS_TEXT.notInShortlist).toBe("Not in shortlist");
  });

  it("gives the same rows whatever order the drafts were written in", () => {
    const a = { "SYN-0001": draft("A", "a"), "SYN-0300": draft("C", "c"), "SYN-0006": draft("B", "b") };
    const b = { "SYN-0006": draft("B", "b"), "SYN-0300": draft("C", "c"), "SYN-0001": draft("A", "a") };
    expect(introDraftsTable(a, ranked)).toEqual(introDraftsTable(b, ranked));
  });
});
