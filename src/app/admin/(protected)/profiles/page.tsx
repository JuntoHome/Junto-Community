import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AdminProfileList, NoProfilesYet } from "@/features/profiles/admin-profile-list";
import { listProfilesForAdmin } from "@/features/profiles/admin-queries";
import { PROFILES_PATH } from "@/features/profiles/queries";
import { requireAdmin } from "@/lib/auth";
import { getPage } from "@/lib/content";

export const metadata: Metadata = { title: "Profiles" };

export default async function ProfilesPage() {
  const admin = await requireAdmin();
  const [profiles, page] = await Promise.all([listProfilesForAdmin(), getPage("whoCanHelp")]);

  return (
    <AdminPage
      title="Profiles"
      description={
        <>
          Published profiles appear on the public{" "}
          <Link href={PROFILES_PATH} className="font-semibold">
            {page.heading}
          </Link>{" "}
          page. Drafts are only visible here.
        </>
      }
      actions={
        <ButtonLink href="/admin/profiles/new" size="sm">
          <Icon name="plus" size={18} />
          Add a profile
        </ButtonLink>
      }
    >
      {profiles.length > 0 ? (
        <AdminProfileList profiles={profiles} adminEmail={admin.email} />
      ) : (
        <div className="rounded-[18px] border border-sand bg-white">
          <NoProfilesYet />
        </div>
      )}
    </AdminPage>
  );
}
