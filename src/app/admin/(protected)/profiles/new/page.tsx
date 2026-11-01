import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/primitives";
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
    <Container className="py-10 md:py-14">
      <Link href="/admin/profiles" className="text-[15px] font-semibold">
        ← All profiles
      </Link>
      <h1 className="mt-6 font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Add a profile</h1>
      <p className="mt-3 max-w-180 text-base text-slate md:text-[17px]">
        Save a draft whenever you like, even with only the name filled in. Drafts aren&apos;t shown on the public site.
        Fields marked &ldquo;Needed to publish&rdquo; must be filled in before the profile can go live.
      </p>
      <ProfileForm
        action={createProfile}
        initialValues={emptyProfileValues}
        addressPrefix={`${new URL(site.url).host}${PROFILES_PATH}/`}
        submitLabel="Save draft"
        cancelHref="/admin/profiles"
        className="mt-8"
      />
    </Container>
  );
}
