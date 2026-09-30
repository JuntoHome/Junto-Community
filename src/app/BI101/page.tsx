import type { Metadata } from "next";
import { EventPage } from "@/components/event/event-page";
import { getSiteSettings, requireEvent } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

// This URL is printed on flyers as a QR code. Do not rename this route.
// Other casings (/bi101, /Bi101, ...) redirect here via src/proxy.ts.
const SLUG = "bi101";

export async function generateMetadata(): Promise<Metadata> {
  const [event, site] = await Promise.all([requireEvent(SLUG), getSiteSettings()]);
  return pageMetadata(event.seo, event.path, site);
}

export default async function BI101Page() {
  const [event, site] = await Promise.all([requireEvent(SLUG), getSiteSettings()]);
  return <EventPage event={event} site={site} />;
}
