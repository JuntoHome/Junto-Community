import type { MetadataRoute } from "next";
import { getSiteSettings, listEvents } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, events] = await Promise.all([getSiteSettings(), listEvents()]);
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
  ];
}
