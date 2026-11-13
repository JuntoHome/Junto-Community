"use client";

import { useId, useState, type DragEvent } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { XLSX_MIME_TYPE } from "./samples";

/**
 * The file picker on the Upload step, inside a drop zone. Both hand the chosen files to
 * `onFiles` (the wizard's `handleWorkbook`), which checks them; nothing is sent anywhere.
 * The input stays focusable and labelled, so keyboard users don't need the drop zone.
 */
export function FileUpload({
  onFiles,
  error,
}: {
  onFiles: (files: readonly File[]) => void;
  /** The last check's problem, shown under the control. A line break starts a new line. */
  error: string | null;
}) {
  const id = useId();
  const ids = { hint: `${id}-hint`, error: `${id}-error` };
  const [dragging, setDragging] = useState(false);

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    // Needed so the browser allows a drop here instead of opening the file.
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    // Moving over a child element also fires dragleave; only clear when leaving the zone.
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    onFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-navy bg-mist" : "border-sand bg-ivory",
        )}
      >
        <p className="text-base text-muted">Drag a workbook here, or</p>
        {/* Hidden but focusable; the label below is its button. */}
        <input
          id={id}
          type="file"
          accept={`.xlsx,${XLSX_MIME_TYPE}`}
          aria-describedby={[ids.hint, error && ids.error].filter(Boolean).join(" ")}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            // Clear it so the same file can be picked again after it is fixed.
            event.target.value = "";
            onFiles(files);
          }}
          className="peer sr-only"
        />
        <label
          htmlFor={id}
          className={buttonClasses(
            "outline",
            "md",
            "cursor-pointer peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold",
          )}
        >
          Choose a workbook
        </label>
        <p id={ids.hint} className="text-[15px] text-subtle">
          .xlsx only, up to 2 MB
        </p>
      </div>
      <p
        id={ids.error}
        role="status"
        aria-live="polite"
        className="whitespace-pre-line text-[15px] font-medium text-red-700 empty:hidden"
      >
        {error ?? ""}
      </p>
    </div>
  );
}
