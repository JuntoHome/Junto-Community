"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { buttonClasses } from "@/components/ui/button";

// Every string Start over shows. Plain language, no em-dashes.
const TEXT = {
  button: "Start over",
  question: "Start over?",
  warning: "This clears your file, criteria and shortlist. Download your file first if you need it.",
  confirm: "Clear everything",
  cancel: "Cancel",
} as const;

/**
 * The Start over button (TR-28), shown next to the step indicator once a workbook is loaded.
 * With results on screen it asks first, here on the page: "Clear everything" calls `onStartOver`,
 * Cancel (or Escape) closes the question and changes nothing. Before results exist there is
 * nothing to lose that the user can download, so it clears straight away.
 */
export function StartOver({ confirm, onStartOver }: { confirm: boolean; onStartOver: () => void }) {
  const [confirming, setConfirming] = useState(false);

  // Focus follows the change: to the question when it opens, back to Start over when cancelled.
  const buttonRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const open = () => {
    if (!confirm) {
      onStartOver();
      return;
    }
    flushSync(() => setConfirming(true));
    questionRef.current?.focus();
  };
  const cancel = () => {
    flushSync(() => setConfirming(false));
    buttonRef.current?.focus();
  };
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape") cancel();
  };

  if (!confirming) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={open}
        className={buttonClasses("outline", "sm", "cursor-pointer self-end")}
      >
        {TEXT.button}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby="translator-start-over-question"
      onKeyDown={cancelOnEscape}
      className="rounded-xl border-2 border-red-700 bg-white p-5 md:p-6"
    >
      <h2
        id="translator-start-over-question"
        ref={questionRef}
        tabIndex={-1}
        className="text-lg font-bold text-red-700 focus:outline-none"
      >
        {TEXT.question}
      </h2>
      <p className="mt-2 text-base text-slate">{TEXT.warning}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button type="button" onClick={onStartOver} className={buttonClasses("danger", "md", "cursor-pointer")}>
          {TEXT.confirm}
        </button>
        <button
          type="button"
          onClick={cancel}
          className="min-h-11 cursor-pointer font-semibold text-navy underline-offset-2 hover:underline"
        >
          {TEXT.cancel}
        </button>
      </div>
    </div>
  );
}
