"use client";

import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/button";

// The strings for choosing how to set the criteria (TR-43). Plain language, no em-dashes.
export const CHOOSER_TEXT = {
  chat: "Chat with AI",
  chatHelp: "Describe what you need and the AI will set up the criteria. You confirm before anything is ranked.",
  useForm: "Use the form instead",
  useChat: "Chat with AI instead",
  chatHeading: "Chat with AI",
} as const;

const CHOOSER_HELP_ID = "criteria-chooser-help";

/**
 * A button that looks like a link. It switches the view inside the page and doesn't navigate,
 * so it is a `<button>`, not an `<a>`, for keyboard and screen reader users.
 */
export function SwitchLink({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-11 cursor-pointer text-base font-semibold text-navy underline underline-offset-2 hover:text-navy-deep"
    >
      {children}
    </button>
  );
}

/**
 * The chooser at the top of the Criteria step when the AI is on: Chat with AI is the main
 * button, the form is a link under it. It only reports the choice; the wizard holds the mode.
 */
export function CriteriaChooser({ onChat, onForm }: { onChat: () => void; onForm: () => void }) {
  return (
    <div className="mt-5 flex flex-col items-start gap-3 text-base">
      <button
        type="button"
        onClick={onChat}
        aria-describedby={CHOOSER_HELP_ID}
        className={buttonClasses("navy", "md", "cursor-pointer")}
      >
        {CHOOSER_TEXT.chat}
      </button>
      <p id={CHOOSER_HELP_ID} className="text-muted">
        {CHOOSER_TEXT.chatHelp}
      </p>
      <SwitchLink onClick={onForm}>{CHOOSER_TEXT.useForm}</SwitchLink>
    </div>
  );
}
