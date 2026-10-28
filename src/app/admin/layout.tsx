import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { logout } from "@/features/admin-auth/actions";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · JCA Admin" },
  robots: { index: false, follow: false },
};

/** The CMS admin area: its own header, none of the public site's header, footer or analytics. */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdmin();

  return (
    <>
      <header className="border-b border-sand bg-white">
        <Container className="flex min-h-16 items-center justify-between gap-4">
          <Link href="/admin" className="font-serif text-xl font-bold text-navy no-underline">
            JCA Admin
          </Link>
          <div className="flex items-center gap-5 text-[15px]">
            {admin && <span className="hidden text-slate md:inline">{admin.email}</span>}
            <Link href="/" className="font-semibold">
              View site
            </Link>
            {admin && (
              <form action={logout}>
                <button type="submit" className="cursor-pointer font-semibold text-navy transition-colors hover:text-green">
                  Log out
                </button>
              </form>
            )}
          </div>
        </Container>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
