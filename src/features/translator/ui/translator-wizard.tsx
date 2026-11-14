"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { type CriteriaForm, EMPTY_CRITERIA_FORM } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import { checkWorkbookFile, type WorkbookFileInput } from "../import/check-file";
import { checkAllowlist, FILE_GATE_MESSAGES, type GatedWorkbook } from "../import/file-gate";
import type { ParseResult } from "../import/parse";
import { groupDuplicates } from "../normalize/duplicates";
import { normalizeWorkbook } from "../normalize/normalize";
import type { ImportState } from "../normalize/summary";
import { compareIssues, validateRows } from "../normalize/validate-rows";
import { rank } from "../ranking";
import { CriteriaStep } from "./criteria-step";
import { FileUpload } from "./file-upload";
import { PreviewStep } from "./preview-step";
import { ResultsStep } from "./results-step";
import { SampleButtons } from "./sample-buttons";
import { StepIndicator } from "./step-indicator";
import { isStepAvailable, STEPS, type StepId } from "./steps";

/**
 * A workbook that passed every check: the gated file and bytes, plus what the import made of
 * them (`ImportState`). Each row keeps `sourceRow`, `sourceValues` and `record` as parsed, plus
 * `normalized` (TR-10). `validation` splits those rows into `kept` and `excluded` (TR-11).
 * `records` is `kept` with exact duplicates folded into the earliest row, `duplicateCount` the
 * rows folded (TR-12). Later steps, ranking (TR-17) first, use only `records`. `issues` is every
 * issue from both steps, sorted by row then code.
 */
type LoadedWorkbook = GatedWorkbook & ImportState;

/** Shown when the parser's code can't be downloaded. */
const PARSER_UNAVAILABLE = "The Translator couldn't finish loading. Check your connection, reload the page and try again.";

/**
 * The Translator's steps and the panel for the current one. Everything happens in the
 * browser: the workbook and its rows are kept in this component's state only.
 */
export function TranslatorWizard() {
  const [current, setCurrent] = useState<StepId>("upload");
  // Later tickets mark each step done as its work is built.
  const [done, setDone] = useState<ReadonlySet<StepId>>(() => new Set());
  // The accepted workbook: the file, its bytes (read once, for the gate and the parser), its allowlist entry and its parsed rows.
  const [workbook, setWorkbook] = useState<LoadedWorkbook | null>(null);
  // The last workbook check's problem, shown on the Upload step.
  const [fileError, setFileError] = useState<string | null>(null);
  // What the Criteria step's form holds, kept here so going back to Criteria shows the same choices.
  const [criteriaForm, setCriteriaForm] = useState<CriteriaForm>(EMPTY_CRITERIA_FORM);
  // The brief waiting to be ranked: set by Continue on Criteria and by a Save in the criteria
  // summary (TR-16), with the form that produced it, so the summary's editors start from that form.
  const [pendingBrief, setPendingBrief] = useState<SearchBrief | null>(null);
  const [pendingForm, setPendingForm] = useState<CriteriaForm | null>(null);
  // The brief the user confirmed with "Confirm and rank". Only this one is ranked.
  const [confirmedBrief, setConfirmedBrief] = useState<SearchBrief | null>(null);
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
   * picker or a drop. It checks the size and type first, then reads the file once, runs the
   * file gate on those bytes and parses them; on a problem it stays on Upload and shows why.
   * A new workbook replaces the previous one and resets later steps.
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
    // The layout comes from the headers, never from gate.entry.layout.
    let parsed: ParseResult;
    try {
      // Loaded on first use, so the workbook library isn't part of the page's initial download.
      const { parseWorkbook } = await import("../import/parse");
      parsed = await parseWorkbook(buffer);
    } catch {
      // parseWorkbook never throws, so only the download of its code can fail here.
      if (thisAttempt === attempt.current) setFileError(PARSER_UNAVAILABLE);
      return;
    }
    if (thisAttempt !== attempt.current) return;
    if (!parsed.ok) {
      // The hint, when there is one, goes on its own line under the message.
      setFileError(parsed.hint ? `${parsed.message}\n${parsed.hint}` : parsed.message);
      return;
    }
    // Values are cleaned for matching here; the originals stay on each row for display and export.
    const normalized = normalizeWorkbook(parsed.workbook);
    // Then rows with problems are flagged; duplicate Record IDs are left out of `kept`.
    const validation = validateRows(normalized.rows, normalized.layout);
    // Then exact duplicates among the kept rows are folded into the earliest one; look-alikes are flagged.
    const { records, duplicateCount, issues: duplicateIssues } = groupDuplicates(validation.kept);
    const issues = [...validation.issues, ...duplicateIssues].sort(compareIssues);
    setWorkbook({ file, buffer, entry: gate.entry, parsed: normalized, validation, records, duplicateCount, issues });
    // A new workbook has its own values, so earlier criteria no longer apply.
    setCriteriaForm(EMPTY_CRITERIA_FORM);
    setPendingBrief(null);
    setPendingForm(null);
    setConfirmedBrief(null);
    setDone(new Set<StepId>(["upload"]));
    focusHeading.current = true;
    setCurrent("preview");
  }

  // Ranked again whenever the confirmed brief changes. `results.brief` is the brief the rows came from.
  const records = workbook?.records;
  const results = useMemo(
    () => (records && confirmedBrief ? rank(records, confirmedBrief) : null),
    [records, confirmedBrief],
  );

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
          <PreviewStep
            workbook={workbook}
            onContinue={() => {
              setDone(new Set<StepId>(["upload", "preview"]));
              focusHeading.current = true;
              setCurrent("criteria");
            }}
          />
        ) : step.id === "criteria" && workbook ? (
          <CriteriaStep
            records={workbook.records}
            form={criteriaForm}
            onFormChange={setCriteriaForm}
            onContinue={(next, form) => {
              // A new brief from the form replaces the pending one and has to be confirmed again.
              setPendingBrief(next);
              setPendingForm(form);
              setConfirmedBrief(null);
              setDone(new Set<StepId>(["upload", "preview", "criteria"]));
              focusHeading.current = true;
              setCurrent("results");
            }}
          />
        ) : step.id === "results" && workbook && pendingBrief && pendingForm ? (
          <ResultsStep
            records={workbook.records}
            pendingBrief={pendingBrief}
            pendingForm={pendingForm}
            results={results}
            onSave={(next, form) => {
              // The form is committed too, so going back to Criteria shows what the summary shows.
              setCriteriaForm(form);
              setPendingForm(form);
              setPendingBrief(next);
              // With results showing, the edit re-ranks straight away.
              if (confirmedBrief) setConfirmedBrief(next);
            }}
            onConfirm={() => setConfirmedBrief(pendingBrief)}
          />
        ) : (
          <p className="mt-3 text-base text-muted">This step isn’t built yet.</p>
        )}
      </section>
    </div>
  );
}
