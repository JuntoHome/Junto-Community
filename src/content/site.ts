import type { SiteSettings } from "@/lib/content/types";

export const site: SiteSettings = {
  name: "Junto Community Alliance",
  shortName: "JCA",
  tagline: "Learn Something. Meet Someone. At the Library.",
  url: "https://www.juntocommunity.org",
  contactEmail: "paul@juntocommunity.org",
  logos: {
    wide: {
      src: "/jca-logo-wide.png",
      alt: "Junto Community Alliance",
      width: 1774,
      height: 887,
    },
    stacked: {
      src: "/jca-logo-stacked.png",
      alt: "Junto Community Alliance logo",
      width: 1254,
      height: 1254,
    },
  },
  nav: [
    { label: "About", href: "/about" },
    { label: "Workshops", href: "/BI101" },
    { label: "Join the Junto", href: "/#join" },
  ],
  featuredEventSlug: "bi101",
  headerCtaLabel: "Register for BI101",
  announcementLinkLabel: "Details and registration",
  footerLinks: [
    { label: "About", href: "/about" },
    { label: "Workshops", href: "/BI101" },
  ],
  copyright: "© 2026 Junto Community Alliance",
};
