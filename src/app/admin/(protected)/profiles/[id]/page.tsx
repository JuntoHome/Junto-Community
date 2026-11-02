import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/admin-page";
import { FlashNotice } from "@/components/admin/flash-notice";
import { ButtonLink } from "@/components/ui/button";
import { updateProfile } from "@/features/profiles/actions";
import { StatusBadge } from "@/features/profiles/admin-profile-list";
import { getProfileForAdmin } from "@/features/profiles/admin-queries";
import { ProfileForm } from "@/features/profiles/profile-form";
import { PROFILES_PATH } from "@/features/profiles/queries";
import { requireAdmin } from "@/lib/auth";
import { getSiteSettings } from "@/lib/content";
import { formatDateTime, timeAgo } from "@/lib/format";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; saved?: string; published?: string; hidden?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const profile = await getProfileForAdmin((await params).id);
  return { title: profile ? `Edit ${profile.name}` : "Profile not found" };
}

export default async function EditProfilePage({ params, searchParams }: Props) {
  const admin = await requireAdmin();
  const [profile, flags, site] = await Promise.all([
    getProfileForAdmin((await params).id),
    searchParams,
    getSiteSettings(),
  ]);
  if (!profile) notFound();

  const published = profile.status === "published";
  const by = profile.updatedBy === admin.email ? "you" : profile.updatedBy;
  const flash = flags.created
    ? "Saved as a draft. It isn't on the public site."
    : flags.published
      ? "Published. It's on the public site now."
      : flags.hidden
        ? "Hidden from the public site. It's a draft again, so only admins can see it."
        : flags.saved &&
          (published
            ? "Changes saved. They're live on the public site."
            : "Changes saved. This profile is a draft, so it isn't on the public site.");

  return (
    <AdminPage
      back={{ href: "/admin/profiles", label: "All profiles" }}
      eyebrow="Edit profile"
      title={profile.name}
      description={
        <>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StatusBadge status={profile.status} />
            {published
              ? "On the public site. Changes go live as soon as you save."
              : "Only admins can see drafts. Publish it when it's ready."}
          </span>
          <span className="mt-2 block text-[15px] text-muted">
            Last saved{" "}
            <time dateTime={profile.updatedAt} title={formatDateTime(profile.updatedAt)}>
              {timeAgo(profile.updatedAt, new Date())}
            </time>
            {by && <> by {by}</>}
          </span>
        </>
      }
      actions={
        published && (
          <ButtonLink
            href={`${PROFILES_PATH}/${profile.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
          >
            View on site <span aria-hidden="true">↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </ButtonLink>
        )
      }
    >
      {/* Keyed by the last save, so the form and message start fresh with the saved values. */}
      {flash && (
        <div key={`flash-${profile.updatedAt}`} className="mb-6 max-w-180">
          <FlashNotice>{flash}</FlashNotice>
        </div>
      )}
      <ProfileForm
        key={profile.updatedAt}
        action={updateProfile.bind(null, profile.id)}
        initialValues={profile.values}
        status={profile.status}
        addressPrefix={`${new URL(site.url).host}${PROFILES_PATH}/`}
        cancelHref="/admin/profiles"
      />
    </AdminPage>
  );
}
