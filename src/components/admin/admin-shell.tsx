import type { ReactNode } from "react";
import type { Admin } from "@/lib/auth";
import { AdminHeader } from "./admin-header";
import { AdminMenu } from "./admin-menu";
import { AdminSidebar } from "./admin-sidebar";

/**
 * Logged in: the navy sidebar on wide screens, a top bar with a menu below 1024px.
 * Logged out (login, password pages): a plain header.
 *
 * Both cases share one structure, with the page always in the same place, so a page keeps
 * its state when the login changes under it: the set-password form logs the admin in and
 * may then still show an error.
 */
export function AdminShell({ admin, children }: { admin: Admin | null; children: ReactNode }) {
  return (
    <div className="flex flex-1">
      {admin && (
        <aside className="sticky top-0 hidden h-dvh w-68 shrink-0 overflow-y-auto bg-navy-deep lg:block">
          <AdminSidebar email={admin.email} />
        </aside>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        {admin ? <AdminMenu email={admin.email} /> : <AdminHeader />}
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
