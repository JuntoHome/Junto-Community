"use client";

import { type KeyboardEvent, useActionState, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { DeleteProfileState } from "./actions";

/**
 * The edit page's delete section. Deleting takes two clicks: the first asks to confirm,
 * here on the page. The profile is kept in the database, so it can be restored.
 */
export function DeleteProfile({
  action,
  name,
  published,
  className,
}: {
  action: (prev: DeleteProfileState) => Promise<DeleteProfileState>;
  name: string;
  published: boolean;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [confirming, setConfirming] = useState(false);

  // Focus follows the change: to the question when it opens, back to Delete when cancelled.
  const deleteRef = useRef<HTMLButtonElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const open = () => {
    flushSync(() => setConfirming(true));
    questionRef.current?.focus();
  };
  const cancel = () => {
    flushSync(() => setConfirming(false));
    deleteRef.current?.focus();
  };
  const cancelOnEscape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !pending) cancel();
  };

  return (
    <section
      aria-labelledby="delete-profile"
      className={cn("max-w-180 rounded-[18px] border border-sand bg-white p-5 md:p-8", className)}
    >
      <h2 id="delete-profile" className="font-serif text-2xl font-bold text-navy">
        Delete this profile
      </h2>
      <p className="mt-1 text-[15px] text-muted">
        {published
          ? "Takes it off the public site and out of the admin. If you only want it off the public site for now, choose Hide from site instead."
          : "Takes it out of the admin. If you might want it later, keep it as a draft instead."}
      </p>

      {confirming ? (
        <div onKeyDown={cancelOnEscape} className="mt-5 rounded-xl border-2 border-red-700 p-5 md:p-6">
          <h3 ref={questionRef} tabIndex={-1} className="text-lg font-bold text-red-700 focus:outline-none">
            Delete “{name}”?
          </h3>
          <p className="mt-2 text-base text-slate">
            It will disappear from the admin{published && " and the public site"} straight away. Its details are kept,
            so your web developer can restore it if it was deleted by mistake.
          </p>
          {state.message && (
            <p role="alert" className="mt-3 text-base font-semibold text-red-700">
              {state.message}
            </p>
          )}
          <form action={formAction} className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button type="submit" disabled={pending} className={buttonClasses("danger", "md", "cursor-pointer")}>
              {pending ? "Deleting..." : "Yes, delete it"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={pending}
              className="min-h-11 cursor-pointer font-semibold text-navy underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          </form>
        </div>
      ) : (
        <button
          ref={deleteRef}
          type="button"
          onClick={open}
          className={buttonClasses("dangerOutline", "md", "mt-5 cursor-pointer")}
        >
          Delete profile
        </button>
      )}
    </section>
  );
}
