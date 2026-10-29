import type { MetadataRoute } from "next";
import { listPublishedProfiles, PROFILES_PATH } from "@/features/profiles/queries";
import { getSiteSettings, listEvents, listReviews } from "@/lib/content";

// Profiles change without a deploy. The sitemap refreshes with the profile data
// (at most once a minute, see features/profiles/queries.ts), so they are listed without one.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, events, reviews, profiles] = await Promise.all([
    getSiteSettings(),
    listEvents(),
    listReviews(),
    listPublishedProfiles().catch((error) => {
      // Keep the rest of the sitemap if Supabase is unreachable.
      console.error(error);
      return [];
    }),
  ]);
  // These pages only change when the site is deployed.
  const lastModified = new Date(process.env.BUILT_AT ?? Date.now());

  return [
    { url: `${site.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...events.map((event) => ({
      url: `${site.url}${event.path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${site.url}/about`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${site.url}/library-intelligence`, lastModified, changeFrequency: "monthly", priority: 0.7 },
    // Reviews are listed once they have text.
    ...reviews
      .filter((review) => review.body)
      .map((review) => ({
        url: `${site.url}${review.path}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    {
      url: `${site.url}${PROFILES_PATH}`,
      // The overview changes whenever a profile on it does.
      lastModified: new Date(Math.max(lastModified.getTime(), ...profiles.map((p) => Date.parse(p.updatedAt)))),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...profiles.map((profile) => ({
      url: `${site.url}${PROFILES_PATH}/${profile.slug}`,
      lastModified: new Date(profile.updatedAt),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
