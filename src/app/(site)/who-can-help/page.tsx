import type { Metadata } from "next";
import { Container } from "@/components/ui/primitives";
import { ProfileCard } from "@/features/profiles/profile-card";
import { listPublishedProfiles, PROFILES_PATH } from "@/features/profiles/queries";
import { getPage, getSiteSettings } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

// Built ahead of time and refreshed every 30 seconds, so changes show within a minute (see features/profiles/queries.ts).
export const revalidate = 30;

export async function generateMetadata(): Promise<Metadata> {
  const [page, site] = await Promise.all([getPage("whoCanHelp"), getSiteSettings()]);
  return pageMetadata(page.seo, PROFILES_PATH, site);
}

export default async function WhoCanHelpPage() {
  const [page, profiles] = await Promise.all([getPage("whoCanHelp"), listPublishedProfiles()]);

  return (
    <Container className="py-10 md:py-16 lg:py-20">
      <header className="max-w-180">
        <h1 className="font-serif text-[38px] leading-[1.1] font-bold text-navy md:text-5xl lg:text-[64px] lg:leading-[1.06]">
          {page.heading}
        </h1>
        <p className="mt-4 font-serif text-xl leading-snug font-bold text-gold-text md:mt-5 md:text-[26px]">
          {page.intro}
        </p>
        <p className="mt-4 text-base text-muted md:text-[17px]">{page.note}</p>
      </header>

      {profiles.length > 0 ? (
        <ul className="mt-10 grid gap-5 md:mt-14 md:grid-cols-2 lg:grid-cols-3">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <ProfileCard profile={profile} linkLabel={page.cardLinkLabel} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-10 max-w-180 rounded-xl bg-parchment px-6 py-5 text-base text-parchment-text md:mt-14 md:text-[17px]">
          {page.emptyMessage}
        </p>
      )}
    </Container>
  );
}
