"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AdminBrand } from "./admin-brand";
import { AdminSidebar } from "./admin-sidebar";

/** Below 1024px: a top bar with the brand and a menu button that slides the sidebar in from the left. */
export function AdminMenu({ email }: { email: string }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so it closes itself on navigation.
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const close = () => setOpenedOn(null);
  const panelId = useId();
  const menuButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const button = menuButton.current;
    const items = () => [...(panel.current?.querySelectorAll<HTMLElement>("a, button") ?? [])];
    items()[0]?.focus();
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenedOn(null);
      // Keep Tab inside the menu while it covers the page.
      if (e.key === "Tab") {
        const all = items();
        const first = all[0];
        const last = all[all.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      button?.focus();
    };
  }, [open]);

  return (
    <div className="contents lg:hidden">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-sand bg-white px-5 md:px-8">
        <AdminBrand />
        <button
          ref={menuButton}
          type="button"
          onClick={() => setOpenedOn(pathname)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label="Open menu"
          className="flex size-11 cursor-pointer items-center justify-center rounded-lg border border-sand text-navy"
        >
          <Icon name="menu" size={22} />
        </button>
      </header>

      <div id={panelId} hidden={!open} className="fixed inset-0 z-40">
        <div aria-hidden="true" onClick={close} className="absolute inset-0 bg-navy-deep/60" />
        <div
          ref={panel}
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
          className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-navy-deep shadow-card-strong"
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="absolute top-6 right-3 flex size-10 cursor-pointer items-center justify-center rounded-lg text-white hover:bg-white/10"
          >
            <Icon name="close" size={22} />
          </button>
          <AdminSidebar email={email} onNavigate={close} />
        </div>
      </div>
    </div>
  );
}
