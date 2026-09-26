import type { Event } from "@/lib/content/types";
import { darrylAnderson } from "./people";

export const bi101: Event = {
  slug: "bi101",
  // Printed on flyers as a QR code. Never change.
  path: "/BI101",
  name: "Business Insights 101",
  code: "BI101",
  startsAt: "2026-10-21T12:00:00-07:00",
  endsAt: "2026-10-21T14:00:00-07:00",
  timeZone: "America/Phoenix",
  timeZoneLabel: "MST",
  attendance: {
    inPerson: {
      venue: {
        name: "Peoria Public Library",
        streetAddress: "8463 W Monroe St",
        locality: "Peoria",
        region: "AZ",
        postalCode: "85345",
        country: "US",
      },
      note: "In person · limited seating",
    },
    online: {
      // PENDING: online platform (Zoom, Teams or YouTube) from Paul.
      platform: null,
      note: "Free for everyone",
    },
  },
  price: 0,
  registration: {
    url: "https://www.eventbrite.com/e/business-insights-101-tickets-2002318498530?aff=jcawebsite",
    provider: "Eventbrite",
  },
  presenter: darrylAnderson,
  hero: {
    lead: "Every business owner has blind spots. The challenge is recognizing them before they limit growth, consume time, or create unnecessary stress.",
    seatingNote:
      "Seating at the Peoria Public Library is limited. Can't attend in person? Join us online for free.",
    presenterLine: "With **Darryl T. Anderson**, Tr33 LLC, author of *The Culture Architect*",
  },
  about: {
    heading: "About the workshop",
    intro:
      "Whether you have a hundred employees or none at all, Business Insights 101 will help demystify the science behind creating a culture that translates return on experience (ROE) into return on investment (ROI).",
    body: [
      "Business Insights 101 is an interactive workshop for established small-business owners and leaders who want to step outside the day-to-day demands of running a business and take a closer look at what may be holding it back.",
      "Participants will leave with practical ideas they can apply to their own businesses, and an opportunity to learn alongside other local business owners and problem solvers.",
    ],
    highlightsHeading: "What we'll explore",
    highlights: [
      "The stages of business growth",
      "How people, time and change relate",
      "How stronger leadership and organizational awareness improve both the experience and the results",
    ],
  },
  saveYourSeat: {
    heading: "Save your seat",
    note: "In-person seating is limited.",
  },
  seo: {
    title: "Business Insights 101 · Free Workshop, Oct 21 · Junto Community Alliance",
    description:
      "Free interactive workshop with Darryl T. Anderson. Wed, Oct 21, 12 to 2 PM at Peoria Public Library or online.",
  },
};

export const events: Event[] = [bi101];
