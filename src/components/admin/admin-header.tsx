import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { logout } from "@/features/admin-auth/actions";
import type { Admin } from "@/lib/auth";
import { AdminMenu } from "./admin-menu";
import { AdminNavLinks } from "./admin-nav-links";

/** Logged in: module links and Log out (in a menu on phones). Logged out: just the name and View site. */
export function AdminHeader({ admin }: { admin: Admin | null }) {
  return (
    <header className="relative z-20 border-b border-sand bg-white">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/admin" className="font-serif text-xl font-bold text-navy no-underline">
            JCA Admin
          </Link>
          {admin && (
            <nav aria-label="Admin" className="hidden items-center gap-6 text-[15px] font-medium md:flex">
              <AdminNavLinks />
            </nav>
          )}
        </div>

        {admin ? (
          <>
            <div className="hidden items-center gap-5 text-[15px] md:flex">
              <span className="hidden text-slate lg:inline">{admin.email}</span>
              <Link href="/" className="font-semibold">
                View site
              </Link>
              <form action={logout}>
                <button type="submit" className="cursor-pointer font-semibold text-navy transition-colors hover:text-green">
                  Log out
                </button>
              </form>
            </div>
            <AdminMenu email={admin.email} />
          </>
        ) : (
          <Link href="/" className="text-[15px] font-semibold">
            View site
          </Link>
        )}
      </Container>
    </header>
  );
}
