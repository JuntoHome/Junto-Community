import type { PageMap } from "@/lib/content/types";

export const pages: PageMap = {
  home: {
    seo: {
      title: "Junto Community Alliance · Learn Something. Meet Someone. At the Library.",
      description:
        "Free small-business workshops at your public library. Business Insights 101, Oct 21 at Peoria Public Library or online.",
    },
    hero: {
      badge: "Free workshop",
      headline: "Have you ever worked in, or inadvertently created, a toxic work environment?",
      accent: "Then this workshop is for you.",
      body: [
        "Whether you have a hundred employees or none at all, Business Insights 101 will help demystify the science behind creating a culture that translates return on experience (ROE) into return on investment (ROI).",
        "Seating at the Peoria Public Library is limited. But those who cannot attend in person can join us online for free.",
      ],
      primaryCtaLabel: "Register now",
      secondaryCtaLabel: "Workshop details",
    },
    saveTheDate: {
      eyebrow: "Save the date",
      ctaLabel: "Register Free",
    },
    join: {
      body: "Junto Community brings together people who are passionate about learning, entrepreneurship, and community. There's nothing to buy, and all you need to get started is a library card.",
      heading: "Are you ready to join the Junto?",
      storyLink: { label: "Read our story", href: "/about" },
      submitLabel: "Join the Junto",
    },
    growth: {
      heading: "Watch us grow.",
      body: "This site is new, and more workshops and libraries are on the way.",
    },
  },
  about: {
    seo: {
      title: "About · Junto Community Alliance",
      description:
        "Junto Community Alliance helps small-business owners access resources through their public libraries.",
    },
    eyebrow: "Our story",
    heading: "About Junto Community Alliance",
    // PENDING: text from the current GoDaddy About page (from Paul).
    // Replace `null` with an array of paragraphs; `## Heading` lines become subheads.
    body: null,
    cta: {
      heading: "Are you ready to join the Junto?",
      body: "There's nothing to buy, and all you need to get started is a library card.",
      link: { label: "Join the Junto", href: "/#join" },
    },
  },
};
