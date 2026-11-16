"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { TranslatorWizard } from "./translator-wizard";

/** Announced after Start over. */
const CLEARED = "Everything was cleared.";

/**
 * One Translator session (TR-28). `key` remounts the wizard, which throws away every piece of
 * its state at once: the file and its bytes, the parsed rows, the criteria, both briefs, the
 * pins and omits, the results and the export status. Nothing is cleared by hand, so state added
 * later is cleared too. `files` is what the user chose, to load straight into the new session.
 * `cleared` is true after Start over, so the new session moves focus to the Upload heading.
 */
type Session = { key: number; files: readonly File[] | null; cleared: boolean };

/**
 * Holds the wizard and starts a new session when the user clicks Start over, or chooses another
 * workbook while one is loaded (a new file is a fresh session, so nothing from the old file
 * carries over). The data lives only in the wizard's React state: nothing is stored or sent,
 * so refreshing or closing the page clears it too.
 *
 * The announcement region sits outside the wizard, so it survives the remount and screen
 * readers hear "Everything was cleared."
 */
export function TranslatorSession() {
  const [session, setSession] = useState<Session>({ key: 0, files: null, cleared: false });
  const [announcement, setAnnouncement] = useState("");

  function startOver() {
    // Emptied first, so the same words are announced again after a second Start over.
    flushSync(() => setAnnouncement(""));
    setSession((s) => ({ key: s.key + 1, files: null, cleared: true }));
    setAnnouncement(CLEARED);
  }

  function startWithFiles(files: readonly File[]) {
    setAnnouncement("");
    setSession((s) => ({ key: s.key + 1, files, cleared: false }));
  }

  return (
    <>
      <TranslatorWizard
        key={session.key}
        initialFiles={session.files}
        focusOnMount={session.cleared}
        onStartOver={startOver}
        onNewFiles={startWithFiles}
      />
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  );
}
