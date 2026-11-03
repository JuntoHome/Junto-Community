import type { Metadata } from "next";
import Link from "next/link";
import { AdminPage } from "@/components/admin/admin-page";
import { FlashNotice } from "@/components/admin/flash-notice";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AdminProfileList, NoProfilesYet } from "@/features/profiles/admin-profile-list";
import { getDeletedProfileName, listProfilesForAdmin } from "@/features/profiles/admin-queries";
import { PROFILES_PATH } from "@/features/profiles/queries";
import { requireAdmin } from "@/lib/auth";
import { getPage } from "@/lib/content";

export const metadata: Metadata = { title: "Profiles" };

type Props = { searchParams: Promise<{ deleted?: string }> };

export default async function ProfilesPage({ searchParams }: Props) {
  const admin = await requireAdmin();
  const { deleted } = await searchParams;
  const [profiles, page, deletedName] = await Promise.all([
    listProfilesForAdmin(),
    getPage("whoCanHelp"),
    deleted ? getDeletedProfileName(deleted) : null,
  ]);

  return (
    <AdminPage
      title="Profiles"
      description={
        <>
          Published profiles appear on the public{" "}
          <Link href={PROFILES_PATH} className="font-semibold">
            {page.heading}
          </Link>{" "}
          page in the order below. Use the arrows to move one up or down. Drafts are only visible here.
        </>
      }
      actions={
        <ButtonLink href="/admin/profiles/new" size="sm">
          <Icon name="plus" size={18} />
          Add a profile
        </ButtonLink>
      }
    >
      {deletedName && (
        <div className="mb-6 max-w-180">
          <FlashNotice>“{deletedName}” was deleted. It no longer appears here or on the public site.</FlashNotice>
        </div>
      )}
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
