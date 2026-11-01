import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

/** Every logged-in admin page: content width and padding, an optional back link, and the page header. */
export function AdminPage({
  title,
  eyebrow,
  description,
  actions,
  back,
  children,
}: {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  /** Buttons on the right of the header (below it on phones). */
  actions?: ReactNode;
  back?: { href: string; label: string };
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10 xl:px-12">
      {back && (
        <Link href={back.href} className="text-[15px] font-semibold">
          ← {back.label}
        </Link>
      )}
      <header className={cn("flex flex-wrap items-end justify-between gap-x-8 gap-y-5", back && "mt-5")}>
        <div className="max-w-180">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <h1 className={cn("font-serif text-3xl leading-tight font-bold text-navy md:text-4xl", eyebrow && "mt-2")}>
            {title}
          </h1>
          {description && <p className="mt-3 text-base text-slate md:text-[17px]">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </header>
      {children && <div className="mt-8">{children}</div>}
    </div>
  );
}
