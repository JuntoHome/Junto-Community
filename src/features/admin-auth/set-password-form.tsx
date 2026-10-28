"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { setPassword } from "./actions";
import { inputClasses } from "./login-form";
import type { PasswordLinkType, SetPasswordState } from "./schema";

const initialState: SetPasswordState = {};

/** New password, typed twice. Carries the email link's one-time code until it is used. */
export function SetPasswordForm({
  tokenHash,
  type,
  className,
}: {
  tokenHash?: string;
  type?: PasswordLinkType;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(setPassword, initialState);
  const id = useId();

  if (state.expired) {
    return (
      <div role="status" className={cn("flex flex-col gap-5", className)}>
        <p className="text-base leading-relaxed text-ink">
          {state.error} Ask for a new link and use it within the hour.
        </p>
        <Link href="/admin/forgot-password" className={buttonClasses("navy", "md", "w-full")}>
          Send me a new link
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className={cn("flex flex-col gap-5", className)}>
      {tokenHash && type && !state.codeUsed && (
        <>
          <input type="hidden" name="tokenHash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
        </>
      )}

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-password`} className="text-base font-medium text-ink">
          New password
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          maxLength={72}
          required
          aria-describedby={`${id}-hint`}
          className={inputClasses}
        />
        <p id={`${id}-hint`} className="text-sm text-muted">
          At least 10 characters.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-confirm`} className="text-base font-medium text-ink">
          Type it again
        </label>
        <input
          id={`${id}-confirm`}
          name="confirm"
          type="password"
          autoComplete="new-password"
          maxLength={72}
          required
          className={inputClasses}
        />
      </div>

      <p role="status" aria-live="polite" className="text-[15px] font-medium text-red-700 empty:hidden">
        {state.error ?? ""}
      </p>

      <button type="submit" disabled={pending} className={buttonClasses("navy", "md", "w-full")}>
        {pending ? "Saving..." : "Save password"}
      </button>
    </form>
  );
}
