"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Link as NavLink } from "@/lib/content/types";
import { cn } from "@/lib/cn";

export function NavLinks({
  links,
  className,
  onNavigate,
}: {
  links: NavLink[];
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return links.map((link) => {
    const active = !link.href.includes("#") && pathname.toLowerCase() === link.href.toLowerCase();
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={cn("no-underline", active ? "font-bold text-navy" : "text-ink", className)}
      >
        {link.label}
      </Link>
    );
  });
}
