"use client";

import { useEffect, useRef } from "react";
import type { CriteriaForm } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import type { FilterCounts } from "../ranking/filter";
import type { RankResult } from "../ranking";
import { CriteriaSummary } from "./criteria-summary";

const TEXT = {
  /** "100 match. 0 left out by your exclusions. 399 didn't meet a must-have (0 only because of missing data)." */
  filterCounts: (counts: FilterCounts) =>
    `${counts.eligible} ${counts.eligible === 1 ? "matches" : "match"}. ` +
    `${counts.excluded} left out by your exclusions. ` +
    `${counts.failedMustHave} didn't meet a must-have (${counts.failedOnlyMissing} only because of missing data).`,
  /** "Top score: 100 (1 record)." */
  topScore: (displayScore: number, count: number) =>
    `Top score: ${displayScore} (${count} ${count === 1 ? "record" : "records"}).`,
} as const;

/** The highest score among `rows` and how many rows have exactly it, or null when there are none. */
function topScore(rows: RankResult["rows"]): { displayScore: number; count: number } | null {
  if (rows.length === 0) return null;
  const top = Math.max(...rows.map((row) => row.score));
  const best = rows.filter((row) => row.score === top);
  return { displayScore: best[0].displayScore, count: best.length };
}

/**
 * The Results step: the criteria summary (TR-16), then, once confirmed, the results. The
 * results table is TR-22 and the counts summary TR-23; until then placeholder lines give the
 * filter counts (TR-17) and the top score (TR-18).
 *
 * The summary describes `results.brief` once there are results, the exact brief `rank()` got,
 * and the pending brief before that. It is never rebuilt from form state.
 */
export function ResultsStep({
  records,
  pendingBrief,
  pendingForm,
  results,
  onSave,
  onConfirm,
}: {
  records: readonly GroupedRecord[];
  pendingBrief: SearchBrief;
  /** The form that produced `pendingBrief`; the summary's editors start from it. */
  pendingForm: CriteriaForm;
  results: RankResult | null;
  onSave: (brief: SearchBrief, form: CriteriaForm) => void;
  onConfirm: () => void;
}) {
  // After Confirm and rank the button disappears, so move focus to what replaced it.
  const resultsRef = useRef<HTMLDivElement>(null);
  const focusResults = useRef(false);
  useEffect(() => {
    if (!focusResults.current || !results) return;
    focusResults.current = false;
    resultsRef.current?.focus();
  }, [results]);

  const top = results ? topScore(results.rows) : null;

  return (
    <div className="flex flex-col gap-8">
      <CriteriaSummary
        records={records}
        brief={results?.brief ?? pendingBrief}
        form={pendingForm}
        confirmed={results !== null}
        onSave={onSave}
        onConfirm={() => {
          focusResults.current = true;
          onConfirm();
        }}
      />
      {results && (
        <div ref={resultsRef} tabIndex={-1} className="border-t border-sand pt-6 focus:outline-none">
          {/* TODO(TR-22, TR-23): the results table from results.rows, and the counts summary. */}
          <p className="text-base text-muted">{TEXT.filterCounts(results.filter.counts)}</p>
          {top && <p className="mt-2 text-base text-muted">{TEXT.topScore(top.displayScore, top.count)}</p>}
        </div>
      )}
    </div>
  );
}
