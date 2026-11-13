"use client";

import { useEffect, useRef, useState } from "react";
import { SampleButtons } from "./sample-buttons";
import { StepIndicator } from "./step-indicator";
import { isStepAvailable, STEPS, type StepId } from "./steps";

/** "27,412 bytes (26.8 KB)": exact bytes plus a rounded size people can read at a glance. */
function formatFileSize(bytes: number): string {
  const exact = `${bytes.toLocaleString("en-US")} bytes`;
  if (bytes < 1024) return exact;
  const rounded = bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${exact} (${rounded})`;
}

/**
 * The Translator's steps and the panel for the current one. Everything happens in the
 * browser: the workbook and its rows are kept in this component's state only.
 */
export function TranslatorWizard() {
  const [current, setCurrent] = useState<StepId>("upload");
  // Later tickets mark each step done as its work is built.
  const [done, setDone] = useState<ReadonlySet<StepId>>(() => new Set());
  const [workbook, setWorkbook] = useState<File | null>(null);

  // After a workbook loads, the button that was clicked disappears, so move focus to the new step's heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [current]);

  /**
   * The single entry point for a workbook, whether it comes from a sample button or an
   * upload (TR-06). A new workbook replaces the previous one and resets later steps.
   */
  function handleWorkbook(file: File) {
    // TODO(TR-07, TR-08): check the file (TR-07 file gate) and parse it (TR-08) here, before moving on.
    setWorkbook(file);
    setDone(new Set<StepId>(["upload"]));
    focusHeading.current = true;
    setCurrent("preview");
  }

  const step = STEPS.find((s) => s.id === current) ?? STEPS[0];

  return (
    <div className="flex flex-col gap-6">
      <StepIndicator
        current={current}
        done={done}
        onSelect={(id) => {
          if (isStepAvailable(id, done)) setCurrent(id);
        }}
      />
      <section
        aria-labelledby="translator-step-title"
        className="rounded-[18px] border border-sand bg-white p-6 md:p-8"
      >
        <h2
          id="translator-step-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-serif text-2xl font-bold text-navy focus:outline-none"
        >
          {step.label}
        </h2>
        {step.id === "upload" ? (
          <div className="mt-3 flex flex-col gap-5">
            <p className="text-base text-muted">Try the Translator with a bundled workbook of fictional records.</p>
            <SampleButtons onWorkbook={handleWorkbook} />
          </div>
        ) : step.id === "preview" && workbook ? (
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-base sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold text-navy">File</dt>
            <dd className="break-all text-muted">{workbook.name}</dd>
            <dt className="font-semibold text-navy">Size</dt>
            <dd className="text-muted">{formatFileSize(workbook.size)}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-base text-muted">This step isn’t built yet.</p>
        )}
      </section>
    </div>
  );
}
