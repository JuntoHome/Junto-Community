import type { Metadata } from "next";
import type { Event, Seo, SiteSettings } from "@/lib/content/types";

/** Page metadata with matching Open Graph and Twitter tags. The OG image comes from `app/opengraph-image`. */
export function pageMetadata(seo: Seo, path: string): Metadata {
  return {
    title: { absolute: seo.title },
    description: seo.description,
    alternates: { canonical: path },
    openGraph: { title: seo.title, description: seo.description, url: path },
    twitter: { title: seo.title, description: seo.description },
  };
}

/** schema.org `Event` structured data for search engines. */
export function eventJsonLd(event: Event, site: SiteSettings) {
  const { inPerson, online } = event.attendance;
  const mode =
    inPerson && online ? "MixedEventAttendanceMode" : online ? "OnlineEventAttendanceMode" : "OfflineEventAttendanceMode";

  const locations = [
    inPerson && {
      "@type": "Place",
      name: inPerson.venue.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: inPerson.venue.streetAddress,
        addressLocality: inPerson.venue.locality,
        addressRegion: inPerson.venue.region,
        postalCode: inPerson.venue.postalCode,
        addressCountry: inPerson.venue.country,
      },
    },
    online && { "@type": "VirtualLocation", url: event.registration.url },
  ].filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    description: event.seo.description,
    startDate: event.startsAt,
    endDate: event.endsAt,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: `https://schema.org/${mode}`,
    location: locations.length === 1 ? locations[0] : locations,
    image: [`${site.url}${site.logos.stacked.src}`],
    url: `${site.url}${event.path}`,
    offers: {
      "@type": "Offer",
      price: event.price,
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url: event.registration.url,
    },
    organizer: { "@type": "Organization", name: site.name, url: site.url },
    performer: { "@type": "Person", name: event.presenter.name },
  };
}

/** Serializes JSON-LD safely for a `<script>` tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
