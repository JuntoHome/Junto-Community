import type { Metadata } from "next";
import { AdminHeader } from "@/components/admin/admin-header";
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
      <AdminHeader admin={admin} />
      <main id="main" className="flex-1">
        {children}
      </main>
    </>
  );
}
