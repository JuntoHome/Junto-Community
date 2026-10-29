"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { adminModules } from "./modules";

const links = [{ label: "Home", href: "/admin" }, ...adminModules];

/** Home plus one link per module. A module stays highlighted on its inner pages (e.g. editing a profile). */
export function AdminNavLinks({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return links.map((link) => {
    const active =
      link.href === "/admin" ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
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
