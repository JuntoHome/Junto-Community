"use client";

import { useId, useState } from "react";
import { inputClasses } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { matchKey } from "../normalize/match-key";

const TEXT = {
  filter: "Type to filter",
  clear: "Clear",
  selected: (count: number) => `${count.toLocaleString("en-US")} selected`,
  option: (label: string, count: number) => `${label} (${count.toLocaleString("en-US")})`,
  noMatch: (query: string) => `No values match "${query}".`,
  noValues: "This file has no values for this field.",
} as const;

export type ValuePickerOption = { key: string; label: string; count: number };

/**
 * A multi-select for the values found in a field: a filter box, a scrolling list of checkboxes
 * ("Phoenix (100)"), how many are selected and a Clear button. Selection is by option key.
 * Filtering only hides options: selected ones stay selected while hidden.
 *
 * `id` goes on the filter box, so an error summary link can focus the picker.
 */
export function ValuePicker({
  id,
  legend,
  options,
  selected,
  onChange,
  error,
}: {
  id: string;
  legend: string;
  options: readonly ValuePickerOption[];
  selected: readonly string[];
  onChange: (keys: string[]) => void;
  error?: string;
}) {
  const [query, setQuery] = useState("");
  const uid = useId();
  const ids = { count: `${uid}-count`, error: `${uid}-error` };
  const picked = new Set(selected);
  const filter = matchKey(query);
  const shown = filter ? options.filter((option) => matchKey(option.label).includes(filter)) : options;
  const describedBy = [ids.count, error && ids.error].filter(Boolean).join(" ");

  function toggle(key: string, checked: boolean) {
    // Kept in option order, so the result doesn't depend on the order of clicks.
    onChange(options.filter((option) => (option.key === key ? checked : picked.has(option.key))).map((o) => o.key));
  }

  return (
    <fieldset aria-describedby={error ? ids.error : undefined} className="flex min-w-0 flex-col gap-3">
      <legend className="mb-3 text-base font-semibold text-ink">{legend}</legend>
      {options.length === 0 ? (
        <p className="text-[15px] text-muted">{TEXT.noValues}</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={id} className="text-[15px] text-slate">
              {TEXT.filter}
            </label>
            <input
              id={id}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              // Enter in a text box would submit the whole form; here it should only filter.
              onKeyDown={(event) => {
                if (event.key === "Enter") event.preventDefault();
              }}
              aria-describedby={describedBy}
              aria-invalid={error ? true : undefined}
              className={inputClasses}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <p id={ids.count} aria-live="polite" className="text-[15px] text-slate">
              {TEXT.selected(picked.size)}
            </p>
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={picked.size === 0}
              className="min-h-11 cursor-pointer px-2 font-semibold text-navy hover:underline disabled:cursor-not-allowed disabled:text-subtle disabled:no-underline"
            >
              {TEXT.clear}
              <span className="sr-only"> {legend}</span>
            </button>
          </div>
          {shown.length === 0 ? (
            <p className="text-[15px] text-muted">{TEXT.noMatch(query.trim())}</p>
          ) : (
            <ul
              className={cn(
                "max-h-64 overflow-y-auto overscroll-contain rounded-md border bg-white px-1 py-1",
                error ? "border-red-700" : "border-field",
              )}
            >
              {shown.map((option) => (
                <li key={option.key}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded px-3 py-2 text-base text-ink hover:bg-ivory">
                    <input
                      type="checkbox"
                      checked={picked.has(option.key)}
                      onChange={(event) => toggle(option.key, event.target.checked)}
                      className="size-5 shrink-0 cursor-pointer accent-navy"
                    />
                    <span className="min-w-0 wrap-anywhere">{TEXT.option(option.label, option.count)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {error && (
        <p id={ids.error} className="text-[15px] font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  );
}
