import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/admin-page";
import { createProfile } from "@/features/profiles/actions";
import { ProfileForm } from "@/features/profiles/profile-form";
import { PROFILES_PATH } from "@/features/profiles/queries";
import { emptyProfileValues } from "@/features/profiles/schema";
import { requireAdmin } from "@/lib/auth";
import { getSiteSettings } from "@/lib/content";

export const metadata: Metadata = { title: "Add a profile" };

export default async function NewProfilePage() {
  await requireAdmin();
  const site = await getSiteSettings();

  return (
    <AdminPage
      back={{ href: "/admin/profiles", label: "All profiles" }}
      title="Add a profile"
      description={
        <>
          Save a draft whenever you like, even with only the name filled in. Drafts aren&apos;t shown on the public
          site. To publish, fill in every field marked &ldquo;Needed to publish&rdquo;.
        </>
      }
    >
      <ProfileForm
        action={createProfile}
        initialValues={emptyProfileValues}
        status="new"
        addressPrefix={`${new URL(site.url).host}${PROFILES_PATH}/`}
        cancelHref="/admin/profiles"
      />
    </AdminPage>
  );
}
