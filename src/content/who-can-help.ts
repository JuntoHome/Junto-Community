import type { WhoCanHelpPage } from "@/lib/content/types";

// Draft wording for the profile pages: confirm with Paul, including the page name.
// The profiles themselves are written in /admin.
export const whoCanHelp: WhoCanHelpPage = {
  seo: {
    title: "Who Can Help? | Junto Community Alliance",
    description:
      "Independently researched profiles of Valley organizations that help small-business owners, from Junto Community Alliance.",
  },
  heading: "Who Can Help?",
  intro: "Valley organizations that help small-business owners, and how to make the most of them.",
  note: "Independently researched by Junto Community Alliance. Not a sponsored listing.",
  emptyMessage: "Our first profiles are on their way. Check back soon.",
  cardLinkLabel: "Read the profile",
  backLinkLabel: "All organizations",
  sections: {
    worthExploring: "Worth exploring",
    peopleToKnow: "People to know",
    gettingStarted: "Getting started",
    links: "Official sources / useful links",
    contact: "Point of contact",
  },
};
