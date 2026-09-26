"use client";

import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { subscribe } from "./actions";
import { HONEYPOT_FIELD, type SubscribeField, type SubscribeState } from "./schema";

const initialState: SubscribeState = { status: "idle" };

const fields: Array<{
  name: SubscribeField;
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: "numeric" | "email";
  maxLength: number;
  pattern?: string;
}> = [
  { name: "firstName", label: "First name", type: "text", autoComplete: "given-name", maxLength: 100 },
  { name: "email", label: "Email", type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 },
  {
    name: "zip",
    label: "ZIP code",
    type: "text",
    autoComplete: "postal-code",
    inputMode: "numeric",
    maxLength: 5,
    pattern: "[0-9]{5}",
  },
];

export function SubscribeForm({ submitLabel, className }: { submitLabel: string; className?: string }) {
  const [state, formAction, pending] = useActionState(subscribe, initialState);
  const id = useId();
  const statusId = `${id}-status`;

  if (state.status === "success") {
    return (
      <div
        role="status"
        className={cn("flex min-h-60 items-center rounded-[14px] bg-white p-6 text-ink md:p-8", className)}
      >
        <p className="font-serif text-2xl leading-snug font-bold text-green-dark">{state.message}</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form
      action={formAction}
      noValidate
      aria-describedby={statusId}
      className={cn("flex flex-col gap-4 rounded-[14px] bg-white p-5 text-ink md:p-8", className)}
    >
      {fields.map((field) => {
        const error = errors?.[field.name];
        const errorId = `${id}-${field.name}-error`;
        return (
          <div key={field.name} className="flex flex-col gap-1.5 md:gap-2">
            <label htmlFor={`${id}-${field.name}`} className="text-sm font-semibold">
              {field.label}
            </label>
            <input
              id={`${id}-${field.name}`}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              inputMode={field.inputMode}
              maxLength={field.maxLength}
              pattern={field.pattern}
              required
              defaultValue={values?.[field.name]}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={cn(
                "h-[50px] rounded-lg border bg-white px-3.5 text-base text-ink",
                error ? "border-red-700" : "border-field",
              )}
            />
            {error && (
              <p id={errorId} className="text-sm font-medium text-red-700">
                {error}
              </p>
            )}
          </div>
        );
      })}

      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-${HONEYPOT_FIELD}`}>Company</label>
        <input id={`${id}-${HONEYPOT_FIELD}`} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button type="submit" disabled={pending} className={buttonClasses("green", "md", "mt-1 w-full")}>
        {pending ? "Joining..." : submitLabel}
      </button>

      <p id={statusId} role="status" aria-live="polite" className="text-sm font-medium text-red-700 empty:hidden">
        {state.status === "error" && !errors ? state.message : ""}
      </p>
    </form>
  );
}
