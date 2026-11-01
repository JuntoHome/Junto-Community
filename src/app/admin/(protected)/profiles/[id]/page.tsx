import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { FlashNotice } from "@/components/admin/flash-notice";
import { getProfileForAdmin } from "@/features/profiles/admin-queries";
import { requireAdmin } from "@/lib/auth";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const profile = await getProfileForAdmin((await params).id);
  return { title: profile ? `Edit ${profile.name}` : "Profile not found" };
}

// Placeholder until the edit form (CMS-18).
export default async function EditProfilePage({ params, searchParams }: Props) {
  await requireAdmin();
  const [profile, { created }] = await Promise.all([getProfileForAdmin((await params).id), searchParams]);
  if (!profile) notFound();

  return (
    <AdminPage
      back={{ href: "/admin/profiles", label: "All profiles" }}
      title={profile.name}
      description="Editing profiles is being built now."
    >
      {created && (
        <div className="max-w-180">
          <FlashNotice>Saved as a draft. It isn&apos;t on the public site.</FlashNotice>
        </div>
      )}
    </AdminPage>
  );
}
