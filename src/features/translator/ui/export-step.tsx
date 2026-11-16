"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { ExportSource } from "../export/criteria-rows";
import { shortlistFileName, XLSX_MIME_TYPE } from "../export/file-name";
import type { MappingRow } from "../import/describe-mapping";
import type { RankResult } from "../ranking";
import type { Counts } from "../ranking/counts";
import { errorText } from "./criteria-controls";

// Every string the Export step shows. Plain language, no em-dashes.
const TEXT = {
  /** "40 records will be exported." */
  willExport: (n: number) => `${n.toLocaleString("en-US")} ${n === 1 ? "record" : "records"} will be exported.`,
  download: "Download Excel",
  preparing: "Preparing your file...",
  failed: "The file couldn't be created. Try again.",
} as const;

/**
 * How long the object URL is kept after the click. Some browsers (Firefox) cancel a download
 * whose URL is revoked straight away, so it is revoked a moment later.
 */
const REVOKE_AFTER_MS = 1000;

/** Saves `bytes` as a download: a Blob, a temporary object URL and a hidden `<a download>`. */
function saveFile(bytes: ArrayBuffer, fileName: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: XLSX_MIME_TYPE }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.hidden = true;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  }
}

/**
 * The Export step (TR-25): how many records the file will have, and Download Excel, which
 * builds the workbook in the browser and saves it as `JCA_Shortlist_YYYY-MM-DD.xlsx`. The file
 * has the Shortlist sheet and the Criteria sheet (TR-26), which records how the list was made.
 *
 * Nothing is sent anywhere: the file is made from `results` in memory and handed to the browser
 * as a download. The uploaded workbook is never changed. A failure shows a message and is not
 * logged, because the error could quote row data.
 *
 * `counts` is `buildCounts()` for `results`: its `exported` figure is the shortlist length, and
 * the Criteria sheet lists the same count lines as the Results step.
 */
export function ExportStep({
  results,
  mapping,
  counts,
  source,
}: {
  results: RankResult;
  /** `describeMapping()` for the loaded file, for the Missing column. */
  mapping: readonly MappingRow[];
  counts: Counts;
  /** The file the rows came from, for the Criteria sheet. */
  source: ExportSource;
}) {
  const [state, setState] = useState<"idle" | "preparing" | "failed">("idle");
  // The button is disabled while the file is built, which takes focus away from it, so focus
  // goes back to it afterwards when it had focus before.
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);
  useEffect(() => {
    if (state === "preparing" || !refocus.current) return;
    refocus.current = false;
    buttonRef.current?.focus();
  }, [state]);

  async function download() {
    refocus.current = document.activeElement === buttonRef.current;
    setState("preparing");
    try {
      // Loaded on first use, like the parser, so ExcelJS isn't part of the page's first download.
      const { buildWorkbook } = await import("../export/workbook");
      const now = new Date();
      const bytes = await buildWorkbook(results, mapping, { counts, source, now });
      saveFile(bytes, shortlistFileName(now));
      setState("idle");
    } catch {
      // Not logged: the error could quote cell data.
      setState("failed");
    }
  }

  const preparing = state === "preparing";

  return (
    <div className="mt-3 flex flex-col gap-4">
      <p className="text-base text-ink">{TEXT.willExport(counts.exported)}</p>
      <div className="flex">
        <button
          ref={buttonRef}
          type="button"
          onClick={download}
          disabled={preparing}
          aria-describedby="translator-export-status"
          className={buttonClasses("navy", "md", "cursor-pointer")}
        >
          {TEXT.download}
        </button>
      </div>
      <p id="translator-export-status" role="status" className={state === "failed" ? errorText : "text-base text-muted"}>
        {preparing ? TEXT.preparing : state === "failed" ? TEXT.failed : ""}
      </p>
    </div>
  );
}
