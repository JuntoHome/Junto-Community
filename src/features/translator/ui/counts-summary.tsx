"use client";

import { cn } from "@/lib/cn";
import type { Counts, LabelledCriterionCount } from "../ranking/counts";

const formatCount = (n: number) => n.toLocaleString("en-US");

/** "1 row", "500 rows". */
const rows = (n: number) => `${formatCount(n)} ${n === 1 ? "row" : "rows"}`;

// Every string the counts summary shows. Plain language, no em-dashes.
const TEXT = {
  heading: "From your file to your shortlist",
  rowsRead: (n: number) => `${rows(n)} read from your file`,
  skippedEmptyRows: (n: number) => `${formatCount(n)} empty ${n === 1 ? "row" : "rows"} skipped`,
  rowsLeftOut: (n: number) => `${rows(n)} left out because of problems in the file`,
  rowsWithWarnings: (n: number) => `${rows(n)} ${n === 1 ? "has" : "have"} warnings (still included)`,
  duplicatesGrouped: (n: number) => `${formatCount(n)} ${n === 1 ? "duplicate" : "duplicates"} grouped`,
  uniqueRecords: (n: number) => `${formatCount(n)} unique ${n === 1 ? "record" : "records"}`,
  excluded: (n: number) => `${formatCount(n)} removed by your Leave out rules`,
  failedMustHave: (n: number, onlyMissing: number) =>
    `${formatCount(n)} didn't meet your must-haves (${formatCount(onlyMissing)} only because a value was blank)`,
  eligible: (n: number) => `${formatCount(n)} ${n === 1 ? "matches" : "match"} your criteria`,
  omittedByUser: (n: number) => `${formatCount(n)} omitted by you`,
  notShown: (n: number, listSize: number) =>
    `${formatCount(n)} more ${n === 1 ? "match" : "matches"} not shown (list size ${formatCount(listSize)})`,
  exported: (n: number) => `${formatCount(n)} in your shortlist and export`,
  whyHeading: "Why rows were filtered out",
  /** "Must-have City: 399 rows (0 with a blank value)". A blank value never matches a Leave out rule, so exclusions have no blank count. */
  criterion: (count: LabelledCriterionCount) =>
    count.stage === "mustHaves"
      ? `${count.label}: ${rows(count.removed)} (${formatCount(count.removedMissing)} with a blank value)`
      : `${count.label}: ${rows(count.removed)}`,
  overlap: "A row can fail more than one rule, so these can add up to more than the total.",
} as const;

const HEADING_ID = "translator-counts-heading";

/**
 * The counts summary (TR-23) on the Results step: one line per stage, in the order the data
 * flows, from the rows read to the rows in the shortlist and export. Lines that are only
 * sometimes relevant (empty rows, warnings, omitted, not shown) are hidden at 0. Under it, a
 * closed "Why rows were filtered out" lists the rows each Leave out rule and must-have removed.
 *
 * `counts` is `buildCounts()` for the current ranking, so it changes with every brief or
 * override change. `listSize` is the brief's list size, for the "not shown" line.
 */
export function CountsSummary({ counts, listSize }: { counts: Counts; listSize: number }) {
  const lines = [
    { key: "rowsRead", text: TEXT.rowsRead(counts.rowsRead), show: true },
    { key: "skippedEmptyRows", text: TEXT.skippedEmptyRows(counts.skippedEmptyRows), show: counts.skippedEmptyRows > 0 },
    { key: "rowsLeftOut", text: TEXT.rowsLeftOut(counts.rowsLeftOut), show: true },
    { key: "rowsWithWarnings", text: TEXT.rowsWithWarnings(counts.rowsWithWarnings), show: counts.rowsWithWarnings > 0 },
    { key: "duplicatesGrouped", text: TEXT.duplicatesGrouped(counts.duplicatesGrouped), show: true },
    { key: "uniqueRecords", text: TEXT.uniqueRecords(counts.uniqueRecords), show: true },
    { key: "excluded", text: TEXT.excluded(counts.excluded), show: true },
    { key: "failedMustHave", text: TEXT.failedMustHave(counts.failedMustHave, counts.failedOnlyMissing), show: true },
    { key: "eligible", text: TEXT.eligible(counts.eligible), show: true },
    { key: "omittedByUser", text: TEXT.omittedByUser(counts.omittedByUser), show: counts.omittedByUser > 0 },
    { key: "notShown", text: TEXT.notShown(counts.notShownListSize, listSize), show: counts.notShownListSize > 0 },
    { key: "exported", text: TEXT.exported(counts.exported), show: true },
  ].filter((line) => line.show);

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
              <li key={`${count.stage}-${count.index}`}>{TEXT.criterion(count)}</li>
            ))}
          </ul>
          <p className="mt-2 text-[15px] text-slate">{TEXT.overlap}</p>
        </details>
      )}
    </section>
  );
}
