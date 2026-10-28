"use client";

import Link from "next/link";
import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { login } from "./actions";
import type { LoginState } from "./schema";

const initialState: LoginState = {};

export const inputClasses = cn(
  "h-12 rounded-md border border-field bg-white px-4 text-base text-ink transition-colors",
  "hover:border-slate focus:border-navy focus:outline-none",
);

/** Email and password login for the admin area. There is deliberately no sign-up link. */
export function LoginForm({ className }: { className?: string }) {
  const [state, formAction, pending] = useActionState(login, initialState);
  const id = useId();

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

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-password`} className="text-base font-medium text-ink">
          Password
        </label>
        <input
          id={`${id}-password`}
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={200}
          required
          className={inputClasses}
        />
      </div>

      <p role="status" aria-live="polite" className="text-[15px] font-medium text-red-700 empty:hidden">
        {state.error ?? ""}
      </p>

      <button type="submit" disabled={pending} className={buttonClasses("navy", "md", "w-full")}>
        {pending ? "Logging in..." : "Log in"}
      </button>

      <Link href="/admin/forgot-password" className="w-fit text-[15px] font-semibold">
        Forgot your password?
      </Link>
    </form>
  );
}
