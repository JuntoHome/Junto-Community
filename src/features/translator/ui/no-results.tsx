"use client";

import { buttonClasses } from "@/components/ui/button";
import type { BriefItemId } from "../criteria/describe";
import type { EmptyDiagnosis } from "../ranking/diagnose";
import { editableItemName } from "./criteria-summary";

// Every string the helper shows. Plain language, no em-dashes. The hints come from `diagnoseEmpty()`.
const TEXT = {
  heading: "No matches for these criteria",
  edit: "Edit",
} as const;

const HEADING_ID = "translator-no-results-heading";

/**
 * The no-results helper (TR-24), shown instead of the results table when the shortlist is
 * empty: a heading, then `diagnosis.hints` (from `diagnoseEmpty()`) as a list. A hint that
 * points at a criterion the summary can edit has an Edit button, which calls `onEdit` with
 * that summary item's id; the Results step passes it to the summary's `openItem()`.
 *
 * Hints are plain text from the brief and the counts, rendered as text.
 */
export function NoResults({ diagnosis, onEdit }: { diagnosis: EmptyDiagnosis; onEdit: (id: BriefItemId) => void }) {
  return (
    <section
      aria-labelledby={HEADING_ID}
      className="flex flex-col gap-3 rounded-xl border border-gold bg-ivory p-4 text-base md:p-5"
    >
      <h3 id={HEADING_ID} className="font-serif text-xl font-bold text-navy">
        {TEXT.heading}
      </h3>
      <ul className="flex flex-col divide-y divide-sand">
        {diagnosis.hints.map((hint, index) => {
          const name = hint.itemId === null ? null : editableItemName(hint.itemId);
          const itemId = hint.itemId;
          return (
            <li
              key={`${hint.itemId ?? "none"}-${index}`}
              className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <p className="min-w-0 wrap-anywhere text-ink">{hint.text}</p>
              {itemId !== null && name !== null && (
                <button
                  type="button"
                  onClick={() => onEdit(itemId)}
                  className={buttonClasses("outline", "sm", "cursor-pointer px-4")}
                >
                  {TEXT.edit}
                  <span className="sr-only"> {name}</span>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
