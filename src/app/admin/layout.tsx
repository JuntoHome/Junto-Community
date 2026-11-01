import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · JCA Admin" },
  robots: { index: false, follow: false },
};

/**
 * The CMS admin area: none of the public site's header, footer or analytics. Logged-in admins
 * get the sidebar layout; the login and password pages get a plain header.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const admin = await getAdmin();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}
