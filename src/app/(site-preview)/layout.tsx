import type { Metadata } from "next";
import { SiteShell } from "@/components/layout/site-shell";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Admin previews of pages that aren't public yet, inside the public site's header and
 * footer so they look exactly as visitors will see them. Admins only; each page still
 * calls requireAdmin() itself (layouts don't re-run when moving between pages).
 */
export default async function SitePreviewLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  return <SiteShell analytics={false}>{children}</SiteShell>;
}
