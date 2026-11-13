"use client";

import { useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { SAMPLE_WORKBOOKS, XLSX_MIME_TYPE, type SampleWorkbook } from "./samples";

const LOAD_FAILED = "The sample couldn't be loaded. Refresh the page and try again.";

/** Fetches a bundled sample and turns it into a `File`, so it can take the same path as an upload. */
async function fetchSample(sample: SampleWorkbook): Promise<File> {
  const response = await fetch(sample.path);
  if (!response.ok) throw new Error(`Sample request failed with status ${response.status}`);
  const blob = await response.blob();
  return new File([blob], sample.fileName, { type: XLSX_MIME_TYPE });
}

/**
 * One primary button per bundled sample. A loaded sample is handed to `onWorkbook`, the
 * same entry point an uploaded file uses.
 */
export function SampleButtons({ onWorkbook }: { onWorkbook: (file: File) => void }) {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(sample: SampleWorkbook) {
    setLoadingId(sample.id);
    setError(null);
    let file: File;
    try {
      file = await fetchSample(sample);
    } catch {
      setError(LOAD_FAILED);
      return;
    } finally {
      setLoadingId(null);
    }
    // Outside the try: a problem with the workbook itself is reported by onWorkbook, not as a failed download.
    onWorkbook(file);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {SAMPLE_WORKBOOKS.map((sample) => {
          const isLoading = loadingId === sample.id;
          return (
            <button
              key={sample.id}
              type="button"
              onClick={() => load(sample)}
              disabled={loadingId !== null}
              aria-busy={isLoading}
              className={buttonClasses("navy", "md", "cursor-pointer")}
            >
              {isLoading ? "Loading sample..." : sample.label}
            </button>
          );
        })}
      </div>
      <p role="status" aria-live="polite" className="text-[15px] font-medium text-red-700 empty:hidden">
        {error ?? ""}
      </p>
    </div>
  );
}
