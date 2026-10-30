import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { AdminProfileList } from "@/features/profiles/admin-profile-list";
import { listProfilesForAdmin } from "@/features/profiles/admin-queries";
import { PROFILES_PATH } from "@/features/profiles/queries";
import { requireAdmin } from "@/lib/auth";
import { getPage } from "@/lib/content";

export const metadata: Metadata = { title: "Profiles" };

export default async function ProfilesPage() {
  const admin = await requireAdmin();
  const [profiles, page] = await Promise.all([listProfilesForAdmin(), getPage("whoCanHelp")]);

  return (
    <Container className="py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="max-w-180">
          <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Profiles</h1>
          <p className="mt-3 text-base text-slate md:text-[17px]">
            Published profiles appear on the public{" "}
            <Link href={PROFILES_PATH} className="font-semibold">
              {page.heading}
            </Link>{" "}
            page. Drafts are only visible here.
          </p>
        </div>
        <ButtonLink href="/admin/profiles/new" size="sm">
          Add a profile
        </ButtonLink>
      </div>

      <div className="mt-8">
        {profiles.length > 0 ? (
          <AdminProfileList profiles={profiles} adminEmail={admin.email} />
        ) : (
          <p className="rounded-xl bg-parchment px-6 py-5 text-base text-parchment-text md:text-[17px]">
            No profiles yet. Choose &ldquo;Add a profile&rdquo; to write the first one.
          </p>
        )}
      </div>
    </Container>
  );
}
