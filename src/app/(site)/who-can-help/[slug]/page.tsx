import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProfileArticle } from "@/features/profiles/profile-article";
import { getPublishedProfile, listPublishedProfiles, PROFILES_PATH } from "@/features/profiles/queries";
import { getPage, getSiteSettings } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

// Published profiles are built ahead of time and refreshed every 30 seconds, so changes show
// within a minute (see features/profiles/queries.ts). A profile published later is built on its first visit.
export const revalidate = 30;

export async function generateStaticParams() {
  try {
    const profiles = await listPublishedProfiles();
    return profiles.map((profile) => ({ slug: profile.slug }));
  } catch (error) {
    // Don't fail the deploy if Supabase is unreachable; the pages are then built on first visit.
    console.error(error);
    return [];
  }
}

/** Addresses are lowercase words joined by hyphens; anything else can't be a profile. */
async function findProfile(params: Props["params"]) {
  const { slug } = await params;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? getPublishedProfile(slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [profile, page, site] = await Promise.all([findProfile(params), getPage("whoCanHelp"), getSiteSettings()]);
  if (!profile) return {};
  const seo = { title: `${profile.name} | ${page.heading} | ${site.name}`, description: profile.tagline };
  return pageMetadata(seo, `${PROFILES_PATH}/${profile.slug}`, site);
}

export default async function ProfilePage({ params }: Props) {
  const [profile, page] = await Promise.all([findProfile(params), getPage("whoCanHelp")]);
  if (!profile) notFound();
  return <ProfileArticle profile={profile} page={page} />;
}
