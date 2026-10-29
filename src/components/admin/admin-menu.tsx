"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { logout } from "@/features/admin-auth/actions";
import { AdminNavLinks } from "./admin-nav-links";

/** The admin navigation on phones: a menu button that opens a panel under the header. */
export function AdminMenu({ email }: { email: string }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so it closes itself on navigation.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenedOn(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-sand text-navy"
      >
        <Icon name={open ? "close" : "menu"} size={22} />
      </button>

      <nav
        id={panelId}
        aria-label="Admin"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-sand bg-white px-5 pt-2 pb-6 shadow-card"
      >
        <div className="flex flex-col text-lg font-medium">
          <AdminNavLinks onNavigate={close} className="border-b border-sand py-3.5" />
          <Link href="/" onClick={close} className="border-b border-sand py-3.5 text-ink no-underline">
            View site
          </Link>
        </div>
        <p className="mt-5 truncate text-[15px] text-slate">Logged in as {email}</p>
        <form action={logout} className="mt-3">
          <button type="submit" className={buttonClasses("outline", "sm", "w-full cursor-pointer")}>
            Log out
          </button>
        </form>
      </nav>
    </div>
  );
}
