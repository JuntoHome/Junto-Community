import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Page-width wrapper: 1280px content with 20px (mobile) to 80px (desktop) side padding. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-[1440px] px-5 md:px-10 lg:px-20", className)} {...props} />;
}

export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn("text-sm font-bold tracking-[0.12em] text-green uppercase", className)}
      {...props}
    />
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-gold px-3 py-1.5 text-[13px] font-bold tracking-[0.08em] text-navy-deep uppercase">
      {children}
    </span>
  );
}
