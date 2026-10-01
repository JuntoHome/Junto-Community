import type { MetadataRoute } from "next";
import { getSiteSettings, listEvents, listReviews } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, events, reviews] = await Promise.all([getSiteSettings(), listEvents(), listReviews()]);
  // Pages are static, so each deploy is when content last changed.
  const lastModified = new Date();

  return [
    { url: `${site.url}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...events.map((event) => ({
      url: `${site.url}${event.path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${site.url}/about`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    // Reviews are listed once they have text.
    ...reviews
      .filter((review) => review.body)
      .map((review) => ({
        url: `${site.url}${review.path}`,
        lastModified,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
  ];
}
