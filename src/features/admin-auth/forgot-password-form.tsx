"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { requestPasswordReset } from "./actions";
import { inputClasses } from "./login-form";
import type { ForgotPasswordState } from "./schema";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const id = useId();

  if (state.sent) {
    return (
      <div role="status" className={cn("flex flex-col gap-5", className)}>
        <p className="text-base leading-relaxed text-ink">
          If that email belongs to an admin, a link to choose a new password is on its way. Check your inbox, and
          your spam folder if it isn&apos;t there in a few minutes.
        </p>
        <Link href="/admin/login" className="w-fit text-[15px] font-semibold">
          Back to log in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="text-base font-medium text-ink">
          Email
        </label>
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          required
          defaultValue={state.email}
          className={inputClasses}
        />
      </div>

      <p role="status" aria-live="polite" className="text-[15px] font-medium text-red-700 empty:hidden">
        {state.error ?? ""}
      </p>

      <button type="submit" disabled={pending} className={buttonClasses("navy", "md", "w-full")}>
        {pending ? "Sending..." : "Send reset link"}
      </button>

      <Link href="/admin/login" className="w-fit text-[15px] font-semibold">
        Back to log in
      </Link>
    </form>
  );
}
