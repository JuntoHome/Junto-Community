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

  const path = pathname.toLowerCase();
  return links.map((link) => {
    const href = link.href.toLowerCase();
    const isPage = !href.includes("#") && path === href;
    // Pages inside a section (e.g. one profile under /who-can-help) highlight the section's link.
    const inSection = !href.includes("#") && href !== "/" && path.startsWith(`${href}/`);
    const active = isPage || inSection;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        aria-current={isPage ? "page" : inSection ? "true" : undefined}
        className={cn("no-underline", active ? "font-bold text-navy" : "text-ink", className)}
      >
        {link.label}
      </Link>
    );
  });
}
