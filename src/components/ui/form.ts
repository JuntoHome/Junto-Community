import { cn } from "@/lib/cn";

const fieldClasses = cn(
  "rounded-md border border-field bg-white px-4 text-base text-ink transition-colors",
  "hover:border-slate focus:border-navy focus:outline-none aria-invalid:border-red-700",
);

/** Text inputs on light backgrounds (admin forms). */
export const inputClasses = cn("h-12", fieldClasses);

/** Multi-line text on light backgrounds. Set the height with `rows`. */
export const textareaClasses = cn("resize-y py-3 leading-relaxed", fieldClasses);
