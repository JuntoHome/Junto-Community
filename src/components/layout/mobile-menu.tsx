"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { Link } from "@/lib/content/types";
import { NavLinks } from "./nav-links";

export function MobileMenu({ links, cta }: { links: Link[]; cta: Link | null }) {
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
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenedOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        className="flex size-11 items-center justify-center rounded-lg border border-sand text-navy"
      >
        <Icon name={open ? "close" : "menu"} size={22} />
      </button>

      <nav
        id={panelId}
        aria-label="Main"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-sand bg-white px-5 pt-2 pb-6 shadow-card md:px-10"
      >
        <div className="flex flex-col text-lg font-medium">
          <NavLinks links={links} onNavigate={close} className="border-b border-sand py-3.5" />
        </div>
        {cta && (
          <ButtonLink href={cta.href} className="mt-5 w-full">
            {cta.label}
          </ButtonLink>
        )}
      </nav>
    </div>
  );
}
