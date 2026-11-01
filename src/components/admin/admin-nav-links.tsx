"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { adminModules } from "./modules";

const links: { label: string; href: string; icon: IconName }[] = [
  { label: "Home", href: "/admin", icon: "home" },
  ...adminModules,
];

/** Home plus one link per module, for the navy sidebar. A module stays highlighted on its inner pages. */
export function AdminNavLinks({ onNavigate }: { onNavigate?: () => void }) {
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
        className={cn(
          "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] no-underline transition-colors",
          active
            ? "bg-white/10 font-semibold text-white before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-gold hover:text-white"
            : "text-fog hover:bg-white/5 hover:text-white",
        )}
      >
        <Icon name={link.icon} size={20} className={active ? "text-gold" : undefined} />
        {link.label}
      </Link>
    );
  });
}
