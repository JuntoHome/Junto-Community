"use client";

import { useActionState, useId } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { subscribe } from "./actions";
import { HONEYPOT_FIELD, type SubscribeField, type SubscribeState } from "./schema";

const initialState: SubscribeState = { status: "idle" };

// Order matches the layout: First name and ZIP on one row, Email full width below.
const fields: Array<{
  name: SubscribeField;
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: "numeric" | "email";
  maxLength: number;
  pattern?: string;
  wide?: boolean;
}> = [
  { name: "firstName", label: "First name", type: "text", autoComplete: "given-name", maxLength: 100 },
  {
    name: "zip",
    label: "ZIP code",
    type: "text",
    autoComplete: "postal-code",
    inputMode: "numeric",
    maxLength: 5,
    pattern: "[0-9]{5}",
  },
  { name: "email", label: "Email", type: "email", autoComplete: "email", inputMode: "email", maxLength: 254, wide: true },
];

/** Subscribe form styled for a navy background. */
export function SubscribeForm({
  submitLabel,
  note,
  className,
}: {
  submitLabel: string;
  /** Small reassurance line under the button. */
  note?: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(subscribe, initialState);
  const id = useId();
  const statusId = `${id}-status`;

  if (state.status === "success") {
    return (
      <div role="status" className={cn("flex items-center", className)}>
        <p className="font-serif text-2xl leading-snug font-medium text-gold-light md:text-3xl">{state.message}</p>
      </div>
    );
  }

  const errors = state.status === "error" ? state.fieldErrors : undefined;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form action={formAction} noValidate aria-describedby={statusId} className={cn("relative text-white", className)}>
      <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 md:gap-y-6">
        {fields.map((field) => {
          const error = errors?.[field.name];
          const errorId = `${id}-${field.name}-error`;
          return (
            <div key={field.name} className={cn("flex flex-col gap-2.5", field.wide && "sm:col-span-2")}>
              <label htmlFor={`${id}-${field.name}`} className="text-base font-medium text-mist">
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
                  "h-14 rounded-md border bg-navy-deep/70 px-4 text-base text-white transition-colors",
                  "focus:border-gold-light focus:outline-none",
                  error ? "border-red-300" : "border-white/25 hover:border-white/40",
                )}
              />
              {error && (
                <p id={errorId} className="text-sm font-medium text-red-200">
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-${HONEYPOT_FIELD}`}>Company</label>
        <input id={`${id}-${HONEYPOT_FIELD}`} name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("gold", "lg", "mt-7 w-full rounded-md px-12 sm:w-auto md:mt-8")}
      >
        {pending ? "Joining..." : submitLabel}
      </button>

      {note && <p className="mt-4 text-[15px] text-fog">{note}</p>}

      <p id={statusId} role="status" aria-live="polite" className="mt-3 text-sm font-medium text-red-200 empty:hidden">
        {state.status === "error" && !errors ? state.message : ""}
      </p>
    </form>
  );
}
