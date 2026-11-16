"use client";

import { cn } from "@/lib/cn";
import { type Counts, describeCounts, describeCriterionCount } from "../ranking/counts";

// The strings only the screen shows. The count lines come from `describeCounts()`, shared with the
// export. Plain language, no em-dashes.
const TEXT = {
  heading: "From your file to your shortlist",
  whyHeading: "Why rows were filtered out",
  overlap: "A row can fail more than one rule, so these can add up to more than the total.",
} as const;

const HEADING_ID = "translator-counts-heading";

/**
 * The counts summary (TR-23) on the Results step: one line per stage, in the order the data
 * flows, from the rows read to the rows in the shortlist and export. Lines that are only
 * sometimes relevant (empty rows, warnings, omitted, not shown) are hidden at 0. Under it, a
 * closed "Why rows were filtered out" lists the rows each Leave out rule and must-have removed.
 *
 * The lines are `describeCounts()`, the same as the export's Criteria sheet (TR-26). `counts` is
 * `buildCounts()` for the current ranking, so it changes with every brief or override change.
 */
export function CountsSummary({ counts }: { counts: Counts }) {
  const lines = describeCounts(counts);

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-3 text-base">
      <h3 id={HEADING_ID} className="font-serif text-xl font-bold text-navy">
        {TEXT.heading}
      </h3>
      <ol className="flex flex-col divide-y divide-sand rounded-xl border border-sand">
        {lines.map((line) => (
          <li
            key={line.key}
            className={cn("px-4 py-2 md:px-5", line.key === "exported" ? "font-semibold text-ink" : "text-muted")}
          >
            {line.text}
          </li>
        ))}
      </ol>
      {counts.byCriterion.length > 0 && (
        <details>
          <summary className="cursor-pointer py-2.5 font-semibold text-navy">{TEXT.whyHeading}</summary>
          <ul className="mt-1 flex flex-col gap-1 text-muted">
            {counts.byCriterion.map((count) => (
              <li key={`${count.stage}-${count.index}`}>{describeCriterionCount(count)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[15px] text-slate">{TEXT.overlap}</p>
        </details>
      )}
    </section>
  );
}
