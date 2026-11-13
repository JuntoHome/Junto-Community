"use client";

import { useEffect, useRef, useState } from "react";
import { checkWorkbookFile, type WorkbookFileInput } from "../import/check-file";
import { checkAllowlist, FILE_GATE_MESSAGES, type GatedWorkbook } from "../import/file-gate";
import { FileUpload } from "./file-upload";
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
  // The accepted workbook: the file, its bytes (read once, for the gate and the parser) and its allowlist entry.
  const [workbook, setWorkbook] = useState<GatedWorkbook | null>(null);
  // The last workbook check's problem, shown on the Upload step.
  const [fileError, setFileError] = useState<string | null>(null);
  // Counts workbook attempts, so a slow check can't override a newer choice.
  const attempt = useRef(0);

  // After a workbook loads, the button that was clicked disappears, so move focus to the new step's heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [current]);

  /**
   * The single entry point for a workbook, whether it comes from a sample button, the file
   * picker or a drop. It checks the size and type first, then reads the file once and runs
   * the file gate on those bytes; on a problem it stays on Upload and shows why. A new
   * workbook replaces the previous one and resets later steps.
   */
  async function handleWorkbook(input: WorkbookFileInput) {
    const thisAttempt = ++attempt.current;
    // Cleared first so the same message is announced again if the next file has the same problem.
    setFileError(null);
    const check = await checkWorkbookFile(input);
    if (thisAttempt !== attempt.current) return;
    if (!check.ok) {
      setFileError(check.message);
      return;
    }
    const file = check.file;
    // The only full read of the file. The size check above caps it at 2 MB.
    let buffer: ArrayBuffer;
    try {
      buffer = await file.arrayBuffer();
    } catch {
      // The browser couldn't read it (for example, the file changed on disk after it was chosen).
      if (thisAttempt === attempt.current) setFileError(FILE_GATE_MESSAGES.unreadable);
      return;
    }
    if (thisAttempt !== attempt.current) return;
    const gate = await checkAllowlist(buffer);
    if (thisAttempt !== attempt.current) return;
    if (!gate.ok) {
      setFileError(gate.message);
      return;
    }
    // TODO(TR-08): parse `buffer` here (detect the layout from the headers, not from gate.entry.layout), before moving on.
    setWorkbook({ file, buffer, entry: gate.entry });
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
            <p className="text-base text-muted">
              Choose a contacts workbook from your computer.
            </p>
            <FileUpload onFiles={handleWorkbook} error={fileError} />
            <p className="text-base text-muted">Or try the Translator with a bundled workbook of fictional records.</p>
            <SampleButtons onWorkbook={handleWorkbook} />
          </div>
        ) : step.id === "preview" && workbook ? (
          <dl className="mt-3 grid gap-x-6 gap-y-1 text-base sm:grid-cols-[auto_1fr]">
            <dt className="font-semibold text-navy">File</dt>
            <dd className="break-all text-muted">{workbook.file.name}</dd>
            <dt className="font-semibold text-navy">Size</dt>
            <dd className="text-muted">{formatFileSize(workbook.file.size)}</dd>
          </dl>
        ) : (
          <p className="mt-3 text-base text-muted">This step isn’t built yet.</p>
        )}
      </section>
    </div>
  );
}
