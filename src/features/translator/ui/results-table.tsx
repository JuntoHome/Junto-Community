"use client";

import { type ReactNode, useId, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { MappingRow } from "../import/describe-mapping";
import type { ShortlistRow } from "../ranking";
import { contactLines, MISSING_SEPARATOR, missingFields } from "../ranking/missing";
import { REASON_TEXT } from "../ranking/reasons";
import type { Text } from "../normalize/types";

// Every string the results table shows. Plain language, no em-dashes.
const TEXT = {
  caption: "Your shortlist",
  columns: {
    rank: "Rank",
    company: "Company",
    location: "Location",
    name: "Name",
    title: "Title",
    contact: "Contact",
    score: "Score",
    why: "Why",
    missing: "Missing",
    actions: "Actions",
  },
  unknown: "Unknown",
  none: "None",
  /** "Rank 1" on a card. */
  rank: (rank: number) => `Rank ${rank}`,
  pin: "Pin",
  unpin: "Unpin",
  omit: "Omit",
  details: "Details",
  detailLabels: {
    otherExecutives: "Other executives",
    naics: "Industry (NAICS)",
    employeeRange: "Employee range",
    address: "Address",
  },
  /** "Row 2 in your file" */
  sourceRow: (row: number) => `Row ${row} in your file`,
  /** "Also in your file as SYN-0500 (row 501)" */
  alsoAs: (others: string) => `Also in your file as ${others}`,
  duplicateRow: (recordId: string, row: number) => `${recordId} (row ${row})`,
} as const;

/** "A", "A and B", "A, B and C". */
function joinList(items: readonly string[]): string {
  return items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** A value's display text, or null when the record doesn't have it. */
const known = (text: Text): string | null => (text.known ? text.value : null);

/** A value as a list of lines: its text, or nothing when the record doesn't have it. */
const linesOf = (text: Text): string[] => (text.known ? [text.value] : []);

/** The known parts of `parts`, joined with ", ", or null when none is known. */
function joinKnown(parts: readonly Text[]): string | null {
  const values = parts.flatMap((part) => (part.known ? [part.value] : []));
  return values.length > 0 ? values.join(", ") : null;
}

/** One labelled group of extra lines in a row's Details. */
type DetailItem = { label: string; lines: string[] };

/**
 * Everything one row shows, worked out once, so the table and the cards can't differ. Null
 * means the record has no value, shown as "Unknown". Values are plain text, never links.
 */
type RowView = {
  id: string;
  rank: number;
  pinned: boolean;
  company: string | null;
  /** "Phoenix, AZ", or the one part that is known. */
  location: string | null;
  name: string | null;
  title: string | null;
  /** The email when known, otherwise phone and website (each that is known), one per line. Empty when none is known. */
  contact: string[];
  score: number;
  /** The `reasons` texts as ranking gave them. */
  reasons: string[];
  /** `missingFields()`, empty for none. */
  missing: string[];
  /** Only the items that have a value. */
  details: DetailItem[];
  /** "Row 2 in your file" and, for a row with duplicates, "Also in your file as ...". */
  source: string[];
};

function rowView(row: ShortlistRow, mapping: readonly MappingRow[]): RowView {
  const { record } = row;
  const r = record.normalized;
  const contact = contactLines(r);

  const executives = r.otherExecutives.flatMap((e) => {
    const line = [e.name, e.title].filter((part) => part !== null).join(", ");
    return line === "" ? [] : [line];
  });
  const address = joinKnown([r.address, r.zip]);
  const details: DetailItem[] = [
    { label: TEXT.detailLabels.otherExecutives, lines: executives },
    { label: TEXT.detailLabels.naics, lines: linesOf(r.naicsDescription) },
    { label: TEXT.detailLabels.employeeRange, lines: linesOf(r.employeeRange) },
    { label: TEXT.detailLabels.address, lines: address === null ? [] : [address] },
  ].filter((item) => item.lines.length > 0);

  const duplicates = record.duplicateIds.map((id, i) => TEXT.duplicateRow(id, record.duplicateRows[i]));
  const source = [TEXT.sourceRow(record.sourceRow), ...(duplicates.length > 0 ? [TEXT.alsoAs(joinList(duplicates))] : [])];

  return {
    id: r.recordId,
    rank: row.rank,
    pinned: row.override === "pinned",
    company: known(r.company),
    location: joinKnown([r.city, r.state]),
    name: known(r.name),
    title: known(r.title),
    contact,
    score: row.displayScore,
    reasons: row.reasons.map((reason) => reason.text),
    missing: missingFields(r, mapping),
    details,
    source,
  };
}

/** The pin and omit buttons' handlers and refs, from the Results step. */
export type RowControls = {
  /** Registers a Pin or Omit button, so the Results step can move focus to it. */
  buttonRef: (view: ResultsView, action: "pin" | "omit", recordId: string) => (element: HTMLButtonElement | null) => void;
  onPin: (view: ResultsView, row: ShortlistRow, index: number) => void;
  onOmit: (view: ResultsView, row: ShortlistRow, index: number) => void;
};

/** The two renderings of the shortlist. Only one is visible at a time. */
export type ResultsView = "table" | "cards";

/** "Unknown", muted, as real text so it doesn't rely on colour. */
function Unknown() {
  return <span className="text-subtle italic">{TEXT.unknown}</span>;
}

function Value({ value }: { value: string | null }) {
  return value === null ? <Unknown /> : <>{value}</>;
}

function Lines({ lines, fallback }: { lines: readonly string[]; fallback: ReactNode }) {
  if (lines.length === 0) return fallback;
  return (
    <ul className="flex flex-col gap-1">
      {lines.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
  );
}

function Missing({ missing }: { missing: readonly string[] }) {
  return missing.length === 0 ? <>{TEXT.none}</> : <>{missing.join(MISSING_SEPARATOR)}</>;
}

/** `wrap`: the badge may break onto more lines, for the table's narrow Rank column. */
function PinnedBadge({ wrap = false }: { wrap?: boolean }) {
  return (
    <span
      className={`inline-block rounded-md bg-navy px-2 py-0.5 text-sm font-semibold text-white ${wrap ? "wrap-break-word" : "whitespace-nowrap"}`}
    >
      {REASON_TEXT.pinned}
    </span>
  );
}

/**
 * A row's Details: the extra items that have a value, then where the row is in the file. The
 * table has no Contact or Missing column (TR-36), so its Details start with those two
 * (`withContactAndMissing`); a card shows them in its body instead.
 */
function DetailsContent({ view, withContactAndMissing = false }: { view: RowView; withContactAndMissing?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {(withContactAndMissing || view.details.length > 0) && (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          {withContactAndMissing && (
            <>
              <dt className="font-semibold text-navy">{TEXT.columns.contact}</dt>
              <dd className="min-w-0 wrap-anywhere text-ink">
                <Lines lines={view.contact} fallback={<Unknown />} />
              </dd>
              <dt className="font-semibold text-navy">{TEXT.columns.missing}</dt>
              <dd className="min-w-0 wrap-break-word text-ink">
                <Missing missing={view.missing} />
              </dd>
            </>
          )}
          {view.details.map((item) => (
            <div key={item.label} className="contents">
              <dt className="font-semibold text-navy">{item.label}</dt>
              <dd className="min-w-0 wrap-break-word text-ink">
                <Lines lines={item.lines} fallback={null} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="flex flex-col gap-1 text-muted">
        {view.source.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

const action = buttonClasses("outline", "sm", "cursor-pointer px-4");

function PinOmitButtons({
  view,
  row,
  index,
  rendering,
  controls,
}: {
  view: RowView;
  row: ShortlistRow;
  index: number;
  rendering: ResultsView;
  controls: RowControls;
}) {
  return (
    <>
      <button
        ref={controls.buttonRef(rendering, "pin", view.id)}
        type="button"
        onClick={() => controls.onPin(rendering, row, index)}
        className={action}
      >
        {view.pinned ? TEXT.unpin : TEXT.pin}
        <span className="sr-only"> {view.id}</span>
      </button>
      <button
        ref={controls.buttonRef(rendering, "omit", view.id)}
        type="button"
        onClick={() => controls.onOmit(rendering, row, index)}
        className={action}
      >
        {TEXT.omit}
        <span className="sr-only"> {view.id}</span>
      </button>
    </>
  );
}

/**
 * The table's columns, in order, with their widths for the fixed table layout (TR-36). The fixed
 * layout makes the table keep to its box: one long value wraps instead of widening it. Contact
 * and Missing are in each row's Details instead, so Why and Actions fit without sideways
 * scrolling from 1280px up.
 *
 * Every column but Why has a set width, just wide enough for its header and an ordinary word
 * (a city, "Synthetic", "Operations", the "Pinned" badge, the Details button), so words don't
 * break in the middle. Why has no width, so it gets the rest: the most of any column.
 *
 * The table's `min-w-208` (832px) keeps Why at least 160px wide. The box is wider than that
 * from 1280px up (844px there), so the table fits; on narrower screens it scrolls inside its box.
 */
const TABLE_COLUMNS = [
  { key: "rank", width: "w-20" },
  { key: "company", width: "w-26" },
  { key: "location", width: "w-26" },
  { key: "name", width: "w-24" },
  { key: "title", width: "w-26" },
  { key: "score", width: "w-18" },
  { key: "why", width: "" },
  { key: "actions", width: "w-28" },
] as const satisfies readonly { key: keyof typeof TEXT.columns; width: string }[];

const th = "px-2 py-3 text-sm font-bold tracking-[0.08em] text-slate uppercase";
const td = "px-2 py-3 align-top";

/**
 * The shortlist (TR-22): a table from `md` up and stacked cards below it, both built from the
 * same `rowView()`, so they always show the same data. Both are rendered; CSS hides one, and a
 * hidden one (`display: none`) is left out of the accessibility tree.
 *
 * Each row has Pin (or Unpin), Omit and Details. In the table Details opens a row under it; on
 * a card it is a `<details>`. Values are plain text: no `mailto:` or web links, so nothing from
 * the spreadsheet becomes a link. Reasons are shown exactly as ranking wrote them.
 */
export function ResultsTable({
  rows,
  mapping,
  controls,
}: {
  rows: readonly ShortlistRow[];
  /** `describeMapping()` for the loaded file, for the Missing column. */
  mapping: readonly MappingRow[];
  controls: RowControls;
}) {
  const views = rows.map((row) => rowView(row, mapping));
  const idPrefix = useId();
  // Record IDs of the table rows whose Details are open.
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const captionId = `${idPrefix}-caption`;

  function toggle(id: string) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      {/*
        Desktop: a table that fits its box from 1280px up (see TABLE_COLUMNS) and, below that,
        scrolls inside its own box, so it never widens the page.
        `relative` keeps the buttons' screen reader text (absolutely positioned) inside the box,
        so it can't widen the page.
      */}
      <div
        role="region"
        aria-labelledby={captionId}
        tabIndex={0}
        className="relative hidden overflow-x-auto rounded-xl border border-sand [contain:inline-size] md:block"
      >
        <table className="w-full min-w-208 table-fixed text-left text-base">
          <caption id={captionId} className="sr-only">
            {TEXT.caption}
          </caption>
          <colgroup>
            {TABLE_COLUMNS.map((column) => (
              <col key={column.key} className={column.width} />
            ))}
          </colgroup>
          <thead className="border-b border-sand bg-ivory">
            <tr>
              {TABLE_COLUMNS.map((column) => (
                <th key={column.key} scope="col" className={th}>
                  {TEXT.columns[column.key]}
                </th>
              ))}
            </tr>
          </thead>
          {views.map((view, index) => {
            const row = rows[index];
            const detailsId = `${idPrefix}-details-${index}`;
            const isOpen = open.has(view.id);
            return (
              // One tbody per record, so a row and its Details stay together.
              <tbody key={view.id} className="border-b border-sand last:border-b-0">
                <tr>
                  <td className={`${td} text-ink`}>
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-semibold">{view.rank}</span>
                      {view.pinned && <PinnedBadge wrap />}
                    </div>
                  </td>
                  <th scope="row" className={`${td} font-semibold wrap-break-word text-navy`}>
                    <Value value={view.company} />
                  </th>
                  <td className={`${td} wrap-break-word text-ink`}>
                    <Value value={view.location} />
                  </td>
                  <td className={`${td} wrap-break-word text-ink`}>
                    <Value value={view.name} />
                  </td>
                  <td className={`${td} wrap-break-word text-ink`}>
                    <Value value={view.title} />
                  </td>
                  <td className={`${td} font-semibold text-ink`}>{view.score}</td>
                  <td className={`${td} text-[15px] wrap-break-word text-ink`}>
                    <Lines lines={view.reasons} fallback={null} />
                  </td>
                  <td className={td}>
                    <div className="flex flex-col items-stretch gap-2">
                      <PinOmitButtons view={view} row={row} index={index} rendering="table" controls={controls} />
                      <button
                        type="button"
                        onClick={() => toggle(view.id)}
                        aria-expanded={isOpen}
                        aria-controls={detailsId}
                        className={action}
                      >
                        {TEXT.details}
                        <span className="sr-only"> {view.id}</span>
                      </button>
                    </div>
                  </td>
                </tr>
                <tr id={detailsId} hidden={!isOpen} className="bg-ivory">
                  <td colSpan={TABLE_COLUMNS.length} className="px-3 py-4">
                    {/* Sticky, so it shows at the box's left edge even when the table is scrolled sideways. */}
                    <div className="sticky left-3 max-w-xl">
                      <DetailsContent view={view} withContactAndMissing />
                    </div>
                  </td>
                </tr>
              </tbody>
            );
          })}
        </table>
      </div>

      {/* Phone: the same rows as stacked cards. */}
      <ol aria-label={TEXT.caption} className="flex flex-col gap-4 md:hidden">
        {views.map((view, index) => (
          <li key={view.id} className="flex min-w-0 flex-col gap-4 rounded-xl border border-sand p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2 text-[15px] text-slate">
                  <span>{TEXT.rank(view.rank)}</span>
                  {view.pinned && <PinnedBadge />}
                </div>
                <h3 className="font-serif text-lg font-bold wrap-break-word text-navy">
                  <Value value={view.company} />
                </h3>
              </div>
              <p className="flex shrink-0 flex-col items-end text-[15px] text-slate">
                {TEXT.columns.score}
                <span className="font-serif text-2xl font-bold text-navy">{view.score}</span>
              </p>
            </div>
            <dl className="flex flex-col gap-3">
              <CardItem label={TEXT.columns.location}>
                <Value value={view.location} />
              </CardItem>
              <CardItem label={TEXT.columns.name}>
                <Value value={view.name} />
              </CardItem>
              <CardItem label={TEXT.columns.title}>
                <Value value={view.title} />
              </CardItem>
              <CardItem label={TEXT.columns.contact}>
                <Lines lines={view.contact} fallback={<Unknown />} />
              </CardItem>
              <CardItem label={TEXT.columns.why}>
                <Lines lines={view.reasons} fallback={null} />
              </CardItem>
              <CardItem label={TEXT.columns.missing}>
                <Missing missing={view.missing} />
              </CardItem>
            </dl>
            <details className="rounded-lg border border-sand">
              <summary className="cursor-pointer px-3 py-2.5 font-semibold text-navy">
                {TEXT.details}
                <span className="sr-only"> {view.id}</span>
              </summary>
              <div className="border-t border-sand bg-ivory px-3 py-3">
                <DetailsContent view={view} />
              </div>
            </details>
            <div className="flex flex-wrap gap-3">
              <PinOmitButtons view={view} row={rows[index]} index={index} rendering="cards" controls={controls} />
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

function CardItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[15px] font-semibold text-slate">{label}</dt>
      <dd className="min-w-0 wrap-break-word text-ink">{children}</dd>
    </div>
  );
}
