import type { MetadataRoute } from "next";
import { getSiteSettings, listEvents } from "@/lib/content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [site, events] = await Promise.all([getSiteSettings(), listEvents()]);

  return [
    { url: `${site.url}/`, changeFrequency: "weekly", priority: 1 },
    ...events.map((event) => ({
      url: `${site.url}${event.path}`,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    { url: `${site.url}/about`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
