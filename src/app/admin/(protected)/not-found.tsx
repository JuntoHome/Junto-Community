import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not found" };

// Shown inside the admin layout when an admin page calls notFound(), e.g. a deleted profile.
// It lives in (protected) so pages for logged-out visitors (login) never carry it.
export default function AdminNotFound() {
  return (
    <AdminPage title="We couldn't find that." description="It may have been deleted, or the link is old or mistyped.">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/admin/profiles" size="sm">
          All profiles
        </ButtonLink>
        <ButtonLink href="/admin" variant="outline" size="sm">
          Admin home
        </ButtonLink>
      </div>
    </AdminPage>
  );
}
