"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FALLBACK_TEXT } from "../ai";
import type { ExportSource } from "../export/criteria-rows";
import { type CriteriaForm, EMPTY_CRITERIA_FORM } from "../criteria/from-form";
import type { SearchBrief } from "../criteria/schema";
import { briefToFormState } from "../criteria/to-form";
import type { WorkbookFileInput } from "../import/check-file";
import { describeMapping } from "../import/describe-mapping";
import type { GatedWorkbook } from "../import/file-gate";
import { loadWorkbook } from "../import/load";
import { groupDuplicates } from "../normalize/duplicates";
import { normalizeWorkbook } from "../normalize/normalize";
import { type ImportState, summarizeImport } from "../normalize/summary";
import { compareIssues, validateRows } from "../normalize/validate-rows";
import { rank } from "../ranking";
import { buildCounts } from "../ranking/counts";
import { NO_OVERRIDES, type Overrides, pinContext } from "../ranking/overrides";
import { type CriteriaMode, initialCriteriaMode, MODE_ANNOUNCEMENT } from "./criteria-mode";
import { CriteriaStep } from "./criteria-step";
import { ExportStep } from "./export-step";
import { FileUpload } from "./file-upload";
import { logTranslatorError } from "./log-error";
import { PreviewStep } from "./preview-step";
import { useIntroDrafts } from "./chat/use-intro-drafts";
import { ResultsStep } from "./results-step";
import { SampleButtons } from "./sample-buttons";
import { StartOver } from "./start-over";
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

/**
 * Where the confirmed criteria came from (TR-45), for the export (TR-52). Session state only:
 * never part of `SearchBrief`.
 */
export type BriefSource = "ai" | "form";

/** What a workbook input holds, as a list: one File, a FileList or an array. */
function toFiles(input: WorkbookFileInput): readonly File[] {
  if (input == null) return [];
  return input instanceof File ? [input] : Array.from(input);
}

/**
 * The Translator's steps and the panel for the current one. Everything happens in the
 * browser: the workbook and its rows are kept in this component's state only, never stored or
 * sent. `TranslatorSession` (TR-28) remounts it with a new `key` to start over, so all of this
 * state goes at once; don't keep Translator data anywhere else.
 */
export function TranslatorWizard({
  aiEnabled,
  simulateAiFailure,
  initialFiles,
  focusOnMount,
  onStartOver,
  onNewFiles,
  onAnnounce,
}: {
  /** Chat with AI may run (`aiEnabled()` on the server page). Off: the form shows directly, as in Phase 1. */
  aiEnabled: boolean;
  /** TR-50 test mode (`?aiFail=1` where allowed): every chat message fails, without calling the route. */
  simulateAiFailure: boolean;
  /** Files chosen in the previous session, loaded as soon as this one starts. */
  initialFiles: readonly File[] | null;
  /** After Start over: move focus to the Upload heading on mount. */
  focusOnMount: boolean;
  /** Clears everything: called by Start over. */
  onStartOver: () => void;
  /** Another workbook was chosen while one is loaded: start a new session with it. */
  onNewFiles: (files: readonly File[]) => void;
  /** Says the text in the session's live region. */
  onAnnounce: (text: string) => void;
}) {
  const [current, setCurrent] = useState<StepId>("upload");
  // Later tickets mark each step done as its work is built.
  const [done, setDone] = useState<ReadonlySet<StepId>>(() => new Set());
  // The accepted workbook: the file, its bytes (read once, for the gate and the parser), its allowlist entry and its parsed rows.
  // `buffer` is read-only: it is used only for hashing (file gate) and parsing, and is never
  // changed, written back or passed to the export (TR-27). The export builds a new file from the
  // ranking result, so the uploaded file stays exactly as it was.
  const [workbook, setWorkbook] = useState<LoadedWorkbook | null>(null);
  // The last workbook check's problem, shown on the Upload step.
  const [fileError, setFileError] = useState<string | null>(null);
  // What the Criteria step's form holds, kept here so going back to Criteria shows the same choices.
  const [criteriaForm, setCriteriaForm] = useState<CriteriaForm>(EMPTY_CRITERIA_FORM);
  // How the Criteria step is filled in (TR-43): the chooser, the chat or the form. Kept here, so
  // going back to Criteria shows the mode already chosen and the remount resets it.
  const [criteriaMode, setCriteriaMode] = useState<CriteriaMode>(() => initialCriteriaMode(aiEnabled));
  // Whether the AI may be used this session (TR-50): the server's `aiEnabled`, until the route
  // answers 503. Then the chooser, both chats and the Draft intro buttons go, and the form shows.
  // Start over (the remount) sets it back to the server's value.
  const [aiAvailable, setAiAvailable] = useState(aiEnabled);
  // The note above the Criteria form (TR-50): why the form opened, or null.
  const [formNote, setFormNote] = useState<string | null>(null);
  // The brief waiting to be ranked: set by Continue on Criteria and by a Save in the criteria
  // summary (TR-16), with the form that produced it, so the summary's editors start from that form.
  const [pendingBrief, setPendingBrief] = useState<SearchBrief | null>(null);
  const [pendingForm, setPendingForm] = useState<CriteriaForm | null>(null);
  // The brief the user confirmed with "Confirm and rank". Only this one is ranked.
  const [confirmedBrief, setConfirmedBrief] = useState<SearchBrief | null>(null);
  // Where the brief came from: "ai" only after Confirm and rank on an AI proposal card (the
  // Criteria step's, TR-45, or the Results step's chat for changes, TR-46);
  // "form" by default and after Continue on the form (also when the form was filled by Edit in
  // form). Start over resets it with the remount. A Save in the criteria summary on Results
  // doesn't change it: TR-52 decides how to report an AI brief edited by hand.
  // Nothing reads it yet: the export's "Criteria set by" line (TR-52) will.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [briefSource, setBriefSource] = useState<BriefSource>("form");
  // The user's pins and omits (TR-21), two lists of Record IDs. They survive brief edits.
  const [overrides, setOverrides] = useState<Overrides>(NO_OVERRIDES);
  // Pins the last brief change removed because those rows stopped matching, for a notice on Results.
  const [unpinned, setUnpinned] = useState<string[]>([]);
  // The intro drafts (TR-49), by Record ID, as the user left them. Here, so Start over and a new
  // file clear them through the remount; TR-52 will export them. Never stored or logged.
  const introDrafts = useIntroDrafts({ onUnavailable: turnAiOff });
  // Counts workbook attempts, so a slow check can't override a newer choice.
  const attempt = useRef(0);

  // After a workbook loads, the button that was clicked disappears, so move focus to the new step's heading.
  const headingRef = useRef<HTMLHeadingElement>(null);
  // True on mount after Start over, so focus lands on the Upload heading.
  const focusHeading = useRef(focusOnMount);
  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    headingRef.current?.focus();
  }, [current]);

  /**
   * The single entry point for a workbook, whether it comes from a sample button, the file
   * picker or a drop. While a workbook is loaded, another one starts a new session (TR-28), so
   * nothing from the old file (criteria, briefs, pins, omits, results) carries over; the new
   * session then loads it with `checkAndLoad()`.
   */
  function handleWorkbook(input: WorkbookFileInput) {
    const files = toFiles(input);
    if (workbook && files.length > 0) {
      onNewFiles(files);
      return;
    }
    void checkAndLoad(files);
  }

  /**
   * Loads the workbook with `loadWorkbook()` (size and type checks, one read, the file gate,
   * the parser), then cleans, checks and groups its rows. On a problem it stays on Upload and
   * shows why.
   */
  async function checkAndLoad(input: WorkbookFileInput) {
    const thisAttempt = ++attempt.current;
    // Cleared first so the same message is announced again if the next file has the same problem.
    setFileError(null);
    const isCurrent = () => thisAttempt === attempt.current;
    const loaded = await loadWorkbook(input, isCurrent);
    // Logged even if a newer choice has started, as an unexpected failure is worth knowing about.
    if (loaded && !loaded.ok && loaded.log) logTranslatorError(loaded.log);
    if (!loaded || !isCurrent()) return;
    if (!loaded.ok) {
      setFileError(loaded.message);
      return;
    }
    const { file, buffer, entry, parsed } = loaded.workbook;
    // Values are cleaned for matching here; the originals stay on each row for display and export.
    const normalized = normalizeWorkbook(parsed);
    // Then rows with problems are flagged; duplicate Record IDs are left out of `kept`.
    const validation = validateRows(normalized.rows, normalized.layout);
    // Then exact duplicates among the kept rows are folded into the earliest one; look-alikes are flagged.
    const { records, duplicateCount, issues: duplicateIssues } = groupDuplicates(validation.kept);
    const issues = [...validation.issues, ...duplicateIssues].sort(compareIssues);
    // `buffer` is kept read-only: only the gate and the parser above ever read it (TR-27).
    // The session is new (a second workbook starts a new one), so later steps have nothing to reset.
    setWorkbook({ file, buffer, entry, parsed: normalized, validation, records, duplicateCount, issues });
    setDone(new Set<StepId>(["upload"]));
    focusHeading.current = true;
    setCurrent("preview");
  }

  // A workbook chosen in the previous session starts this one. Run once, even in Strict Mode.
  const startedWithFiles = useRef(false);
  useEffect(() => {
    if (startedWithFiles.current || !initialFiles) return;
    startedWithFiles.current = true;
    void checkAndLoad(initialFiles);
    // Only on mount: initialFiles never changes for one session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ranked again whenever the confirmed brief or the overrides change. `results.brief` is the
  // brief the rows came from, and `results.overrides` the pins and omits they were made with.
  const records = workbook?.records;
  const results = useMemo(
    () => (records && confirmedBrief ? rank(records, confirmedBrief, overrides) : null),
    [records, confirmedBrief, overrides],
  );
  // A pin whose row no longer matches the brief is dropped from state, and the user is told. Done
  // while rendering, so the stale pin is never shown; the next render has nothing to drop.
  if (results && results.droppedPins.length > 0) {
    setOverrides(results.overrides);
    setUnpinned(results.droppedPins);
  }
  // What a typed Record ID is checked against before it is pinned.
  const leftOutRows = workbook?.validation.excluded;
  const statusById = results?.filter.statusById;
  const pinCheckContext = useMemo(
    () => (records && leftOutRows && statusById ? pinContext(records, leftOutRows, statusById) : null),
    [records, leftOutRows, statusById],
  );

  // Which fields the file has columns for, so the shortlist lists only the gaps in those (TR-22).
  const parsedWorkbook = workbook?.parsed;
  const mapping = useMemo(
    () => (parsedWorkbook ? describeMapping(parsedWorkbook.layout, parsedWorkbook.headers) : []),
    [parsedWorkbook],
  );

  // The import's counts, for the Results step's counts summary (TR-23).
  const importSummary = useMemo(() => (workbook ? summarizeImport(workbook) : null), [workbook]);

  // The file the rows came from, recorded on the export's Criteria sheet (TR-26).
  const source = useMemo<ExportSource | null>(
    () =>
      workbook && {
        fileName: workbook.file.name,
        layout: workbook.parsed.layout.label,
        sheetName: workbook.parsed.sheetName,
        sha256: workbook.entry.sha256,
      },
    [workbook],
  );

  /**
   * Confirms a brief from the AI (TR-45 on the Criteria step, TR-46 on the Results step): the
   * form's Continue and Confirm and rank in one go. The form becomes `briefToFormState(next)`, so
   * the criteria summary's editors and the form show it; the pending and confirmed brief become
   * `next` itself, and the results re-rank with the same `rank()`. Pins and omits are kept, as for
   * any brief change, and pins that stop matching are reported (TR-21).
   */
  function confirmAiBrief(next: SearchBrief) {
    const form = briefToFormState(next);
    setCriteriaForm(form);
    setPendingBrief(next);
    setPendingForm(form);
    setUnpinned([]);
    setConfirmedBrief(next);
    setBriefSource("ai");
  }

  /**
   * Turns the AI off for the session (TR-50): the route answered 503. The form shows with the
   * `unavailable` note; the chats, the "Chat with AI instead" link and Draft intro go.
   */
  function turnAiOff() {
    setAiAvailable(false);
    setCriteriaMode("form");
    setFormNote(FALLBACK_TEXT.unavailable);
  }

  /**
   * Opens the Criteria step's form, filled in with `brief` when one is given (Edit in form on the
   * Results step's card, Use the form on its chat), with `note` above it (TR-50).
   */
  function openCriteriaForm(brief?: SearchBrief | null, note: string | null = null) {
    if (brief) setCriteriaForm(briefToFormState(brief));
    setFormNote(note);
    setCriteriaMode("form");
    focusHeading.current = true;
    setCurrent("criteria");
    onAnnounce(MODE_ANNOUNCEMENT.form);
  }

  const step = STEPS.find((s) => s.id === current) ?? STEPS[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <StepIndicator
          current={current}
          done={done}
          onSelect={(id) => {
            if (isStepAvailable(id, done)) setCurrent(id);
          }}
        />
        {/* Once a workbook is loaded there is something to clear. Only results need a confirm. */}
        {workbook && <StartOver confirm={results !== null} onStartOver={onStartOver} />}
      </div>
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
            aiEnabled={aiAvailable}
            simulateAiFailure={simulateAiFailure}
            formNote={formNote}
            onFormNoteChange={setFormNote}
            onAiUnavailable={turnAiOff}
            layout={workbook.parsed.layout.id}
            pendingBrief={pendingBrief}
            mode={criteriaMode}
            onModeChange={setCriteriaMode}
            onAnnounce={onAnnounce}
            focusStepHeading={() => headingRef.current?.focus()}
            records={workbook.records}
            form={criteriaForm}
            onFormChange={setCriteriaForm}
            onContinue={(next, form) => {
              // A new brief from the form replaces the pending one and has to be confirmed again.
              setFormNote(null);
              setPendingBrief(next);
              setPendingForm(form);
              setConfirmedBrief(null);
              setBriefSource("form");
              setDone(new Set<StepId>(["upload", "preview", "criteria"]));
              focusHeading.current = true;
              setCurrent("results");
            }}
            onConfirmProposal={(next) => {
              // The brief ranked is the proposal as shown on the card, unchanged.
              confirmAiBrief(next);
              setDone(new Set<StepId>(["upload", "preview", "criteria"]));
              focusHeading.current = true;
              setCurrent("results");
            }}
          />
        ) : step.id === "results" && workbook && importSummary && pendingBrief && pendingForm ? (
          <ResultsStep
            aiEnabled={aiAvailable}
            aiOffNote={aiEnabled && !aiAvailable ? FALLBACK_TEXT.unavailable : null}
            simulateAiFailure={simulateAiFailure}
            onAiUnavailable={turnAiOff}
            introDrafts={aiAvailable ? introDrafts : null}
            layout={workbook.parsed.layout.id}
            onConfirmRevision={confirmAiBrief}
            onEditRevision={openCriteriaForm}
            onUseForm={(brief) => openCriteriaForm(brief, FALLBACK_TEXT.resultsUnchanged)}
            records={workbook.records}
            importSummary={importSummary}
            pendingBrief={pendingBrief}
            pendingForm={pendingForm}
            results={results}
            pinContext={pinCheckContext}
            mapping={mapping}
            unpinned={unpinned}
            onSave={(next, form) => {
              // The form is committed too, so going back to Criteria shows what the summary shows.
              setCriteriaForm(form);
              setPendingForm(form);
              setPendingBrief(next);
              // With results showing, the edit re-ranks straight away. The overrides are kept.
              if (confirmedBrief) {
                setUnpinned([]);
                setConfirmedBrief(next);
              }
            }}
            onConfirm={() => {
              setUnpinned([]);
              setConfirmedBrief(pendingBrief);
            }}
            onOverridesChange={(change) => {
              setUnpinned([]);
              setOverrides(change);
            }}
            onContinueToExport={() => {
              setDone(new Set<StepId>(["upload", "preview", "criteria", "results"]));
              focusHeading.current = true;
              setCurrent("export");
            }}
          />
        ) : step.id === "export" && results && importSummary && source ? (
          <ExportStep results={results} mapping={mapping} counts={buildCounts(importSummary, results)} source={source} />
        ) : (
          <p className="mt-3 text-base text-muted">This step isn’t built yet.</p>
        )}
      </section>
    </div>
  );
}
