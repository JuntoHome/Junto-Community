"use client";

import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { describeMapping, MAPPING_STATUS } from "../import/describe-mapping";
import { FIELD_LABELS } from "../import/fields";
import type { GroupedRecord } from "../normalize/duplicates";
import { summarizeImport, type ImportState, type ImportSummary } from "../normalize/summary";
import type { RowIssue } from "../normalize/validate-rows";

// Every string on this step. Plain language: "left out" and "warnings", never "invalid".
const TEXT = {
  fileHeading: "File",
  fileName: "File name",
  layout: "Layout",
  sheet: "Sheet",
  countsHeading: "What we found",
  counts: {
    rowsRead: "Rows read",
    skippedEmptyRows: "Empty rows skipped",
    duplicatesGrouped: "Duplicates grouped",
    uniqueRecords: "Unique records",
    rowsLeftOut: "Rows left out",
    rowsWithWarnings: "Rows with warnings",
  } satisfies Partial<Record<keyof ImportSummary, string>>,
  duplicatesHeading: "Duplicate groups",
  duplicatesIntro: "Rows that repeat an earlier row exactly are grouped under the earliest one.",
  showAllGroups: (count: number) => `Show all ${count.toLocaleString("en-US")} duplicate groups`,
  alsoAppearsAs: (recordId: string, others: string) => `${recordId} also appears as ${others}`,
  duplicateRow: (recordId: string, row: number) => `${recordId} (row ${row})`,
  mappingHeading: "Column mapping",
  mappingColumns: { field: "Field", source: "Spreadsheet column", status: "Status" },
  notInLayout: (labels: string) => `Not in this layout: ${labels}.`,
  issuesHeading: "Issues",
  noIssues: "No problems found.",
  showAllIssues: (count: number) => `Show all ${count.toLocaleString("en-US")} issues`,
  issueColumns: { row: "Row", recordId: "Record ID", reason: "What happened", result: "Result" },
  allRows: "All rows",
  result: { excluded: "Left out", warning: "Kept" } satisfies Record<RowIssue["severity"], string>,
  continue: "Continue to criteria",
  noRecords: "No usable rows were found in this file. Choose a different file.",
} as const;

/** More duplicate groups than this are shown inside a closed `<details>`. */
const MAX_OPEN_GROUPS = 5;
/** More issues than this are shown inside a closed `<details>`. */
const MAX_OPEN_ISSUES = 10;

const NO_RECORDS_ID = "translator-preview-no-records";

const formatCount = (n: number) => n.toLocaleString("en-US");

/** "A", "A and B", "A, B and C". */
function joinList(items: readonly string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "SYN-0001 also appears as SYN-0500 (row 501)". */
function groupLine(record: GroupedRecord): string {
  const others = record.duplicateIds.map((id, i) => TEXT.duplicateRow(id, record.duplicateRows[i]));
  return TEXT.alsoAppearsAs(record.normalized.recordId, joinList(others));
}

/** Content that is closed behind a `<details>` when it is long. The summary is a 44 px touch target. */
function Collapsible({ collapse, summary, children }: { collapse: boolean; summary: string; children: ReactNode }) {
  if (!collapse) return children;
  return (
    <details>
      <summary className="cursor-pointer py-2.5 font-semibold text-navy">{summary}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

/**
 * A wide table scrolls inside this box, never the page. `contain: inline-size` stops the table's
 * minimum width from widening the page through content-sized parents. Focusable so keyboard
 * users can scroll it.
 */
function TableScroll({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <div
      role="region"
      aria-labelledby={labelledBy}
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-sand [contain:inline-size]"
    >
      {children}
    </div>
  );
}

const th = "px-4 py-3 text-sm font-bold tracking-[0.08em] text-slate uppercase";
const td = "px-4 py-3 align-top";

function SectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h3 id={id} className="font-serif text-xl font-bold text-navy">
      {children}
    </h3>
  );
}

/**
 * The Preview step (TR-13): what was read from the workbook, before the user sets criteria.
 * File details, the counts, duplicate groups, how each field is filled, and every row issue.
 * Shows no row data. Everything comes from the import state in the wizard's memory.
 */
export function PreviewStep({
  workbook,
  onContinue,
}: {
  workbook: ImportState & { file: { name: string } };
  onContinue: () => void;
}) {
  const summary = summarizeImport(workbook);
  const mapping = describeMapping(workbook.parsed.layout, workbook.parsed.headers);
  const mapped = mapping.filter((row) => row.status !== MAPPING_STATUS.notInLayout);
  const notInLayout = mapping.filter((row) => row.status === MAPPING_STATUS.notInLayout);
  const groups = workbook.records.filter((record) => record.duplicateIds.length > 0);
  const { issues } = workbook;
  const canContinue = summary.uniqueRecords > 0;

  const counts: { label: string; value: number }[] = [
    { label: TEXT.counts.rowsRead, value: summary.rowsRead },
    ...(summary.skippedEmptyRows > 0 ? [{ label: TEXT.counts.skippedEmptyRows, value: summary.skippedEmptyRows }] : []),
    { label: TEXT.counts.duplicatesGrouped, value: summary.duplicatesGrouped },
    { label: TEXT.counts.uniqueRecords, value: summary.uniqueRecords },
    { label: TEXT.counts.rowsLeftOut, value: summary.rowsLeftOut },
    { label: TEXT.counts.rowsWithWarnings, value: summary.rowsWithWarnings },
  ];

  return (
    <div className="mt-5 flex flex-col gap-8 text-base">
      <section aria-labelledby="preview-file" className="flex flex-col gap-3">
        <SectionHeading id="preview-file">{TEXT.fileHeading}</SectionHeading>
        <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
          <dt className="font-semibold text-navy">{TEXT.fileName}</dt>
          <dd className="break-all text-muted">{workbook.file.name}</dd>
          <dt className="font-semibold text-navy">{TEXT.layout}</dt>
          <dd className="text-muted">{workbook.parsed.layout.label}</dd>
          <dt className="font-semibold text-navy">{TEXT.sheet}</dt>
          <dd className="break-all text-muted">{workbook.parsed.sheetName}</dd>
        </dl>
      </section>

      <section aria-labelledby="preview-counts" className="flex flex-col gap-3">
        <SectionHeading id="preview-counts">{TEXT.countsHeading}</SectionHeading>
        <dl className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3", counts.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5")}>
          {counts.map((count) => (
            <div key={count.label} className="flex flex-col rounded-xl border border-sand bg-ivory px-4 py-3">
              <dt className="text-[15px] text-slate">{count.label}</dt>
              <dd className="font-serif text-2xl font-bold text-navy">{formatCount(count.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      {groups.length > 0 && (
        <section aria-labelledby="preview-duplicates" className="flex flex-col gap-3">
          <SectionHeading id="preview-duplicates">{TEXT.duplicatesHeading}</SectionHeading>
          <p className="text-muted">{TEXT.duplicatesIntro}</p>
          <Collapsible collapse={groups.length > MAX_OPEN_GROUPS} summary={TEXT.showAllGroups(groups.length)}>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-ink">
              {groups.map((record) => (
                <li key={record.sourceRow} className="wrap-anywhere">
                  {groupLine(record)}
                </li>
              ))}
            </ul>
          </Collapsible>
        </section>
      )}

      <section aria-labelledby="preview-mapping" className="flex flex-col gap-3">
        <SectionHeading id="preview-mapping">{TEXT.mappingHeading}</SectionHeading>
        <TableScroll labelledBy="preview-mapping">
          <table className="w-full min-w-120 text-left">
            <thead className="border-b border-sand bg-ivory">
              <tr>
                <th scope="col" className={th}>
                  {TEXT.mappingColumns.field}
                </th>
                <th scope="col" className={th}>
                  {TEXT.mappingColumns.source}
                </th>
                <th scope="col" className={th}>
                  {TEXT.mappingColumns.status}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand">
              {mapped.map((row) => (
                <tr key={row.field}>
                  <td className={`${td} font-semibold text-navy`}>{row.fieldLabel}</td>
                  <td className={`${td} text-ink`}>{row.source}</td>
                  <td className={`${td} ${row.status === MAPPING_STATUS.found ? "text-green" : "font-semibold text-parchment-text"}`}>
                    {row.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
        {notInLayout.length > 0 && (
          <p className="text-muted">{TEXT.notInLayout(joinList(notInLayout.map((row) => FIELD_LABELS[row.field])))}</p>
        )}
      </section>

      <section aria-labelledby="preview-issues" className="flex flex-col gap-3">
        <SectionHeading id="preview-issues">{TEXT.issuesHeading}</SectionHeading>
        {issues.length === 0 ? (
          <p className="text-muted">{TEXT.noIssues}</p>
        ) : (
          <Collapsible collapse={issues.length > MAX_OPEN_ISSUES} summary={TEXT.showAllIssues(issues.length)}>
            {/* Reasons may quote cell values: shown here, never logged. */}
            <TableScroll labelledBy="preview-issues">
              <table className="w-full min-w-150 text-left">
                <thead className="border-b border-sand bg-ivory">
                  <tr>
                    <th scope="col" className={th}>
                      {TEXT.issueColumns.row}
                    </th>
                    <th scope="col" className={th}>
                      {TEXT.issueColumns.recordId}
                    </th>
                    <th scope="col" className={th}>
                      {TEXT.issueColumns.reason}
                    </th>
                    <th scope="col" className={th}>
                      {TEXT.issueColumns.result}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand">
                  {issues.map((issue) => (
                    <tr key={`${issue.sourceRow ?? "file"}-${issue.code}`}>
                      <td className={`${td} whitespace-nowrap text-ink`}>
                        {issue.sourceRow === null ? TEXT.allRows : issue.sourceRow}
                      </td>
                      <td className={`${td} whitespace-nowrap text-ink`}>{issue.recordId ?? ""}</td>
                      <td className={`${td} text-ink`}>{issue.reason}</td>
                      <td
                        className={`${td} whitespace-nowrap font-semibold ${issue.severity === "excluded" ? "text-red-700" : "text-green"}`}
                      >
                        {TEXT.result[issue.severity]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </Collapsible>
        )}
      </section>

      <div className="flex flex-col items-start gap-3 border-t border-sand pt-6">
        <button
          type="button"
          onClick={onContinue}
          disabled={!canContinue}
          aria-describedby={canContinue ? undefined : NO_RECORDS_ID}
          className={buttonClasses("navy", "md", "cursor-pointer")}
        >
          {TEXT.continue}
        </button>
        {!canContinue && (
          <p id={NO_RECORDS_ID} className="text-[15px] font-medium text-red-700">
            {TEXT.noRecords}
          </p>
        )}
      </div>
    </div>
  );
}
