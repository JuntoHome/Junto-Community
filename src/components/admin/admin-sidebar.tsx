"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { logout } from "@/features/admin-auth/actions";
import { cn } from "@/lib/cn";
import { AdminBrand } from "./admin-brand";
import { AdminNavLinks } from "./admin-nav-links";
import { plannedModules } from "./modules";

const accountButton =
  "flex min-h-10 items-center justify-center rounded-lg border border-white/15 px-3 text-sm font-semibold text-white no-underline transition-colors hover:bg-white/10 hover:text-white";

/**
 * The navy sidebar's contents: brand, module links, what's coming, and the account.
 * Fixed on the left on wide screens, and inside the slide-out menu on smaller ones.
 */
export function AdminSidebar({ email, onNavigate }: { email: string; onNavigate?: () => void }) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="px-5 pt-6 pb-5">
        <AdminBrand onDark onNavigate={onNavigate} />
      </div>

      <nav aria-label="Admin" className="flex flex-col gap-1 px-3">
        <AdminNavLinks onNavigate={onNavigate} />
      </nav>

      <p className="mt-8 px-6 text-xs font-bold tracking-[0.12em] text-white/60 uppercase">Coming later</p>
      <ul className="mt-2 flex flex-col gap-0.5 px-3">
        {plannedModules.map((item) => (
          <li key={item.label} className="flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] text-white/60">
            <Icon name={item.icon} size={20} />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="mt-auto border-t border-white/10 px-4 pt-5 pb-6">
        <div className="flex items-center gap-3 px-1">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold font-bold text-navy-deep uppercase"
          >
            {email.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-xs text-white/60">Logged in as</p>
            <p className="truncate text-sm font-semibold text-white" title={email}>
              {email}
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/" onClick={onNavigate} className={accountButton}>
            View site
          </Link>
          <form action={logout}>
            <button type="submit" className={cn(accountButton, "w-full cursor-pointer")}>
              Log out
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
