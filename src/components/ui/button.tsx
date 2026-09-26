import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  navy: "bg-navy text-white hover:bg-navy-deep hover:text-white",
  navyDeep: "bg-navy-deep text-white hover:bg-navy hover:text-white",
  gold: "bg-gold text-navy-deep font-bold hover:brightness-95 hover:text-navy-deep",
  green: "bg-green text-white font-bold hover:bg-green-dark hover:text-white",
  outline: "border border-navy bg-white text-navy hover:bg-ivory hover:text-navy",
} as const;

const sizes = {
  sm: "min-h-11 px-5 text-base rounded-lg",
  md: "min-h-13 px-6 text-[17px] rounded-[10px]",
  lg: "min-h-14 px-7 text-lg rounded-[10px]",
  xl: "min-h-16 px-9 text-xl rounded-[10px]",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClasses(variant: ButtonVariant = "navy", size: ButtonSize = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 text-center font-semibold no-underline transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonLinkProps = Omit<ComponentProps<"a">, "href"> & {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
};

/** A link styled as a button. Internal paths use `next/link`; external URLs a plain anchor. */
export function ButtonLink({ href, variant, size, className, ...props }: ButtonLinkProps) {
  const classes = buttonClasses(variant, size, className);
  if (/^https?:\/\//.test(href) || href.startsWith("mailto:")) {
    return <a href={href} className={classes} {...props} />;
  }
  return <Link href={href} className={classes} {...props} />;
}
