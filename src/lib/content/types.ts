/**
 * Content model for the site.
 *
 * These types are the contract between content and UI. Pages and components
 * only ever see these shapes, never the raw data from a specific source.
 * When a CMS is added, its adapter maps CMS documents into these types, so
 * the UI does not change.
 */

/**
 * Inline rich text as a small Markdown subset: `*em*`, `**strong**` and
 * `[label](href)`. In block lists, a block starting with `## ` is a subhead,
 * `> ` a pull quote (newlines become line breaks) and `- ` a bullet. Most headless CMSs can export this easily, and it keeps
 * content free of JSX.
 */
export type RichText = string;

export type Link = {
  label: string;
  href: string;
};

export type ImageAsset = {
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type Seo = {
  title: string;
  description: string;
};

export type SiteSettings = {
  name: string;
  shortName: string;
  tagline: string;
  /** Canonical origin, no trailing slash. */
  url: string;
  /** Direct contact. Not shown on the site; receives new-subscriber notifications. */
  contactEmail: string;
  /** Public address shown to visitors (footer, workshop questions). */
  questionsEmail: string;
  logos: {
    wide: ImageAsset;
    stacked: ImageAsset;
  };
  nav: Link[];
  /** Slug of the event the header "Register" button points to. */
  featuredEventSlug: string;
  headerCtaLabel: string;
  /** Link text in the announcement bar for the featured event. */
  announcementLinkLabel: string;
  footerLinks: Link[];
  copyright: string;
};

export type Person = {
  slug: string;
  name: string;
  /** One-line credit, e.g. "Business owner, consultant and author of *The Culture Architect*". */
  role: RichText;
  organization?: string;
  bio: RichText[];
};

export type Venue = {
  name: string;
  streetAddress: string;
  locality: string;
  region: string;
  postalCode: string;
  country: string;
};

export type EventAttendance = {
  inPerson: {
    venue: Venue;
    /** Short note, e.g. "In person · limited seating". */
    note: string;
  } | null;
  online: {
    /** e.g. "Zoom". `null` while pending; the UI renders a marked placeholder. */
    platform: string | null;
    note: string;
  } | null;
};

export type Event = {
  slug: string;
  /** Public URL path. Printed on flyers for some events, so it must stay stable. */
  path: string;
  name: string;
  /** Short code used in labels, e.g. "BI101". */
  code: string;
  /** ISO 8601 with offset. */
  startsAt: string;
  endsAt: string;
  /** IANA zone used for display, e.g. "America/Phoenix". */
  timeZone: string;
  /** Label shown after times, e.g. "MST". */
  timeZoneLabel: string;
  attendance: EventAttendance;
  /** Price in USD. 0 means free. */
  price: number;
  registration: {
    url: string;
    provider: string;
  };
  presenter: Person;
  hero: {
    lead: RichText;
    seatingNote: RichText;
    /** e.g. "With **Darryl T. Anderson**, Tr33 LLC, author of *The Culture Architect*". */
    presenterLine: RichText;
  };
  about: {
    heading: string;
    intro: RichText;
    body: RichText[];
    highlightsHeading: string;
    highlights: string[];
  };
  saveYourSeat: {
    heading: string;
    note: string;
  };
  /** Optional line under the presenter bio linking to related reading. The link opens in a new tab. */
  readingPrompt?: {
    lead: RichText;
    linkLabel: RichText;
    href: string;
  };
  seo: Seo;
};

export type BookReview = {
  slug: string;
  /** Public URL path. */
  path: string;
  book: {
    title: string;
    author: string;
  };
  /** Line under the book title, e.g. "A Reader's Take". */
  subtitle: string | null;
  /** Framing sentence shown before the review. */
  intro: RichText | null;
  reviewer: {
    name: string;
    role: string;
  };
  /** Stars out of 5, or `null` to hide the rating. */
  rating: number | null;
  /** Review text. `null` shows a marked placeholder until the text arrives. */
  body: RichText[] | null;
  /** Link to the original review (e.g. on Amazon), or `null`. */
  sourceUrl: string | null;
  /** Event the page sends readers back to. */
  eventSlug: string;
  seo: Seo;
};

export type HomePage = {
  seo: Seo;
  /** Organization-first hero: full-width photo with an overlapping text card. */
  hero: {
    /** Heading lines, each on its own line. */
    heading: string[];
    /** Final heading line, shown in green italics. */
    headingAccent: string;
    body: RichText;
    primaryCta: Link;
    secondaryCta: Link;
    /** `null` shows a plain panel until a photo is supplied. */
    photo: ImageAsset | null;
  };
  /** "We bring three things together" section. */
  approach: {
    heading: string;
    link: Link;
    /** Three cards. `photo: null` shows a tinted icon panel until a photo is supplied. */
    pillars: Array<{ tag: string; title: string; photo: ImageAsset | null }>;
    centerLine: string;
    audience: {
      heading: string;
      rows: Array<{ label: string; value: string; emphasis?: boolean }>;
    };
  };
  /** Section promoting the site's featured event (`SiteSettings.featuredEventSlug`). The heading is the event name. */
  featuredEvent: {
    eyebrow: string;
    /** Hook question, shown as an italic quote. */
    hook: string;
    accent: string;
    body: RichText[];
    detailsLinkLabel: string;
  };
  /** Small teaser for the latest Library Intelligence note, shown below the featured event. */
  noteTeaser: {
    label: string;
    title: string;
    link: Link;
  };
  join: {
    body: RichText;
    heading: string;
    storyLink: Link;
    submitLabel: string;
    /** Small line under the submit button. */
    formNote?: string;
  };
};

export type AboutPage = {
  seo: Seo;
  eyebrow: string;
  heading: string;
  lead: string;
  /** Rich text blocks. `null` hides the section. */
  body: RichText[] | null;
  cta: {
    heading: string;
    body: string;
    link: Link;
  };
};

/** One research note on the Library Intelligence page. */
export type ResearchNote = {
  /** Anchor id on the page. The archive links to it. */
  slug: string;
  /** Month shown in the archive, e.g. "October 2026". */
  date: string;
  /** Small label above the title, e.g. "October 2026 | Research note 01". */
  label: string;
  title: string;
  subtitle: string;
  body: RichText[];
  /** Attribution shown after "Source:". Opens in a new tab. */
  source: Link | null;
};

export type LibraryIntelligencePage = {
  seo: Seo;
  heading: string;
  intro: string;
  editorNote: {
    heading: string;
    body: RichText[];
    signature: string;
  };
  /** Newest first. Every note is listed in the archive automatically. */
  notes: ResearchNote[];
  furtherReading: {
    heading: string;
    /** External links. Each opens in a new tab. */
    items: Array<Link & { description: string }>;
  };
  archiveHeading: string;
  /** Link back to the workshop, at the bottom of the page. */
  eventLink: Link;
};

/** Wording around the "Who Can Help?" profiles. The profiles themselves come from the CMS (features/profiles). */
export type WhoCanHelpPage = {
  seo: Seo;
  heading: string;
  intro: string;
  /** Shown on the overview and on every profile page. */
  note: string;
  /** Shown when no profile is published yet. */
  emptyMessage: string;
  cardLinkLabel: string;
  backLinkLabel: string;
  sections: {
    howTheyHelp: string;
    whoShouldExplore: string;
    history: string;
    whereToBegin: string;
    contact: string;
  };
};

export type PageMap = {
  home: HomePage;
  about: AboutPage;
  libraryIntelligence: LibraryIntelligencePage;
  whoCanHelp: WhoCanHelpPage;
};

export type PageKey = keyof PageMap;
