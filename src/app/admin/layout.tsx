import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · JCA Admin" },
  robots: { index: false, follow: false },
};

/** The CMS admin area: its own header, none of the public site's header, footer or analytics. */
export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="border-b border-sand bg-white">
        <Container className="flex min-h-16 items-center justify-between gap-4">
          <Link href="/admin" className="font-serif text-xl font-bold text-navy no-underline">
            JCA Admin
          </Link>
          <Link href="/" className="text-[15px] font-semibold">
            View site
          </Link>
        </Container>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
