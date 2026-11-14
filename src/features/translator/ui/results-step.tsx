"use client";

import { useEffect, useRef } from "react";
import type { CriteriaForm } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import type { GroupedRecord } from "../normalize/duplicates";
import type { RankResult } from "../ranking";
import { CriteriaSummary } from "./criteria-summary";

const TEXT = {
  placeholder: "Ranked against the criteria above. Results table comes in TR-22.",
} as const;

/**
 * The Results step: the criteria summary (TR-16), then, once confirmed, the results. The
 * results table is TR-22; until then a placeholder says the ranking ran.
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
          {/* TODO(TR-22): the results table, from results.rows. */}
          <p className="text-base text-muted">{TEXT.placeholder}</p>        </div>
      )}
    </div>
  );
}
