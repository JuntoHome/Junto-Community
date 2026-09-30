import type { PageMap } from "@/lib/content/types";

export const pages: PageMap = {
  home: {
    seo: {
      title: "Junto Community Alliance · Learn Something. Meet Someone. At the Library.",
      description:
        "Junto Community Alliance helps small-business owners discover and use the resources, expertise, and connections in their communities, with the public library at the center.",
    },
    hero: {
      heading: ["Learn Something.", "Meet Someone."],
      headingAccent: "At the Library.",
      body: "Junto Community Alliance helps small-business owners discover and make better use of the extraordinary resources, expertise, and connections that already exist within their communities.",
      primaryCta: { label: "Join the Junto", href: "/#join" },
      secondaryCta: { label: "Upcoming workshop", href: "/BI101" },
      photo: {
        src: "/images/home/hero.png",
        alt: "Illustration of small-business owners talking around a table in a public library",
        width: 1641,
        height: 959,
      },
    },
    approach: {
      heading: "We bring three things together.",
      link: { label: "Read our story", href: "/about" },
      // Illustrations are decorative (the titles carry the meaning), so alt text is empty.
      pillars: [
        {
          tag: "Education",
          title: "Practical business education",
          photo: { src: "/images/home/education.png", alt: "", width: 590, height: 480 },
        },
        {
          tag: "People",
          title: "Useful relationships",
          photo: { src: "/images/home/people.png", alt: "", width: 590, height: 480 },
        },
        {
          tag: "Resources",
          title: "Trusted community resources",
          photo: { src: "/images/home/resources.png", alt: "", width: 586, height: 480 },
        },
      ],
      centerLine: "...with the public library at the center.",
      centerCaption: "Peoria Public Library",
      audience: {
        heading: "Who it's for",
        rows: [
          { label: "Built for", value: "Established, revenue-generating small businesses", emphasis: true },
          { label: "Open to", value: "Anyone who finds value in the learning, people, and resources being shared" },
          { label: "Cost", value: "Every program is free" },
        ],
      },
    },
    featuredEvent: {
      eyebrow: "Upcoming workshop",
      hook: "Have you ever worked in, or inadvertently created, a toxic work environment?",
      accent: "Then this workshop is for you.",
      body: [
        "Whether you have a hundred employees or none at all, Business Insights 101 will help demystify the science behind creating a culture that translates return on experience (ROE) into return on investment (ROI).",
        "Seating at the Peoria Public Library is limited. But those who cannot attend in person can join us online for free.",
      ],
      detailsLinkLabel: "Workshop details",
    },
    join: {
      body: "Junto Community brings together people who are passionate about learning, entrepreneurship, and community. There's nothing to buy, and all you need to get started is a library card.",
      heading: "Are you ready to join the Junto?",
      storyLink: { label: "Read our story", href: "/about" },
      submitLabel: "Join the Junto",
      formNote: "We'll email you about new workshops. Nothing else.",
    },
  },
  about: {
    seo: {
      title: "About · Junto Community Alliance",
      description:
        "Junto Community Alliance is a Phoenix-based nonprofit helping small-business owners make better use of the resources, expertise, and relationships in their communities.",
    },
    eyebrow: "Our story",
    heading: "About Junto Community Alliance",
    lead: "Communities thrive when small businesses succeed.",
    // `## ` starts a subhead, `> ` a pull quote (use \n for line breaks inside a quote).
    body: [
      "Junto Community Alliance is a Phoenix-based nonprofit organization created to help small-business owners make better use of the resources, expertise, and relationships that already exist within their communities.",
      "The idea begins with a simple observation: communities do not necessarily lack resources.",
      "Public libraries provide sophisticated research tools, technology, meeting spaces, professional staff, and information resources. SCORE offers experienced mentors and business education. Cities, financial institutions, universities, nonprofits, subject-matter experts, and other organizations offer additional programs, expertise, funding opportunities, guides, and tools.",
      "The harder challenge is often helping people discover those resources, determine which ones are useful, make the right connections, and follow through.",
      "> A toolkit is not capacity.",
      "Junto Community Alliance helps provide some of that missing capacity.",

      "## Why the Library?",
      "Public libraries are among the most accessible pieces of community infrastructure we already have.",
      "They are places where people can learn, meet, research, ask questions, use technology, and participate without first belonging to an organization or purchasing a service.",
      "And small-business owners are already there.",
      "They are library patrons, residents, neighbors, employers, customers, parents, taxpayers, and community participants. JCA helps connect the resources of the public library with the real needs of the people operating businesses in the surrounding community.",
      "The library does not need to become a business-development agency, and librarians do not need to become business consultants.",
      "> The library provides the platform.\nJCA helps connect the people, programs, expertise, information, and opportunities around it.",

      "## Who We Serve",
      "JCA begins with a deliberately focused audience: established, revenue-generating small businesses that have moved beyond the earliest startup stage but remain small enough to operate without many of the specialized resources available to larger companies.",
      "Some are family businesses. Some are professional practices, contractors, retailers, manufacturers, or service businesses. Some want to grow. Others simply want to operate better.",
      "What they often share is the challenge of running an established business with limited internal capacity.",
      "Startups, employees, job seekers, community developers, librarians, and others remain welcome when JCA programming is useful to them. But our initial program design and outreach are intentionally centered on the needs of operating small businesses.",

      "## What JCA Does",
      "JCA brings together practical learning and useful connections.",
      "A workshop might introduce a business owner to a library research resource, a SCORE mentor, a banker, an attorney, a city program, another business owner, or a subject-matter expert.",
      "But the connector role does not end when the presentation ends.",
      "We want to make useful next steps easier to recognize and pursue while leaving professional advice and specialized services with the people and organizations best equipped to provide them.",
      "Our programs are designed for in-person participation while increasingly using hybrid technology to extend access beyond a single room. Over time, one program taking place at a library can also reach individual online participants and small groups gathering at other libraries and community locations.",
      "> Technology expands the reach.\nHuman relationships remain at the center.",

      "## Where the Name Comes From",
      "The name Junto was inspired by Benjamin Franklin's original Junto - a small group of tradespeople and civic-minded citizens who gathered regularly to exchange ideas, learn from one another, and consider ways to strengthen their community.",
      "Nearly three centuries later, the underlying idea still feels remarkably current.",
      "> Bring people together.\nShare what we know.\nLearn what we don't.\nConnect people with useful resources and with one another.\nThen see what becomes possible.",
      "Junto Community Alliance is being built in Phoenix with that same spirit of collaboration rather than competition.",
      "Our starting proposition is intentionally simple:",
      "> Learn Something. Meet Someone. At the Library.",
    ],
    cta: {
      heading: "Are you ready to join the Junto?",
      body: "There's nothing to buy, and all you need to get started is a library card.",
      link: { label: "Join the Junto", href: "/#join" },
    },
  },
};
