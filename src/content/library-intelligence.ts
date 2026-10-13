import type { LibraryIntelligencePage } from "@/lib/content/types";

// Paul's wording, unedited. To publish another research note, add it to the
// top of `notes`; the page and its archive list pick it up automatically.
export const libraryIntelligence: LibraryIntelligencePage = {
  seo: {
    title: "Library Intelligence | Junto Community Alliance",
    description:
      "Library Intelligence from Junto Community Alliance - occasional research notes and observations about public libraries, community connection and small-business support.",
  },
  heading: "Library Intelligence",
  intro:
    "A few useful discoveries. Some questions worth asking. And an ongoing conversation about what public libraries make possible.",
  editorNote: {
    heading: "From the Editor",
    body: [
      "Public libraries are beacons. From a distance, they are recognizable and dependable, part of the civic landscape we simply expect to be there. But come closer and something changes. The public library becomes the local library. And the local library becomes an extension of its neighborhood.",
      "Here, we'll share occasional research, observations, and questions about libraries and the people they serve. Some things we find are immediately useful. Others leave us wondering. That seems like a good place to begin.",
      "This isn't a newsletter, and there's no fixed publishing schedule. Just a growing place to collect what catches our attention, and to invite others to tell us what we may have missed.",
      "We'll do this again. We just don't know exactly when.",
    ],
    signature: "Paul",
  },
  notes: [
    {
      slug: "when-a-link-becomes-an-obstacle",
      date: "October 2026",
      label: "October 2026 | Research note 01",
      title: "When a link becomes an obstacle",
      subtitle: "How libraries are adapting to changes in Facebook outreach",
      body: [
        "Angela Hursh, writing for Super Library Marketing on October 5, describes a new complication for some public-library Facebook pages: limits on how many posts can carry links to outside websites. The restriction is not universal, and libraries are experimenting with several responses, from pinned posts and links in a profile to page buttons and comments. There is no dependable workaround yet.",
        "Why does this matter? A library's links are often the path to an event registration, a research database, a resource guide, or a library card. Make that path harder to find and even a useful service can become less visible.",
        "We're encountering a related challenge as Junto Community Alliance prepares Business Insights 101 at the Peoria Public Library on October 21. The workshop is free. The real work is connecting it with the small-business owners who might benefit. We're experimenting with personal invitations, trusted professional contacts, and better ways to learn what reaches people.",
        "We'd love to hear from librarians: What is working for you? How are you helping people discover programs and resources? And whose work should we be following?",
      ],
      source: {
        label: 'Angela Hursh, "Facebook Is Limiting Links: Here\'s How Libraries Are Responding" (October 5, 2026)',
        href: "https://superlibrarymarketing.com/2026/10/05/facebook-is-limiting-links-heres-how-libraries-are-responding/",
      },
    },
  ],
  furtherReading: {
    heading: "Further reading",
    items: [
      {
        label: "American Library Association - Libraries Build Business and its Playbook",
        href: "https://www.ala.org/advocacy/workforce/grant",
        description:
          "Practical models and resources for libraries supporting entrepreneurs and local small businesses.",
      },
      {
        label: "Urban Libraries Council - Strengthening Libraries as Entrepreneurial Hubs",
        href: "https://www.urbanlibraries.org/initiatives/workforce-economic-development/strengthening-libraries-as-hubs-for-entrepreneurship",
        description:
          "Examples, research and tools from libraries developing stronger roles in their local entrepreneurial ecosystems.",
      },
    ],
  },
  archiveHeading: "Archive",
  eventLink: { label: "Join us at Business Insights 101 on October 21", href: "/BI101" },
};
