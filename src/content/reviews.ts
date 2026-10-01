import type { BookReview } from "@/lib/content/types";

// Source: docs/reviews/the-culture-architect-review.docx (Paul's text, unedited).
export const cultureArchitectReview: BookReview = {
  slug: "the-culture-architect",
  path: "/reviews/the-culture-architect",
  book: {
    title: "The Culture Architect",
    author: "Darryl T. Anderson",
  },
  subtitle: "A Reader's Take",
  intro:
    "Ahead of Business Insights 101, JCA founder Paul Huleatt read Darryl Anderson's *The Culture Architect*. Here's what stayed with him.",
  reviewer: {
    name: "Paul Huleatt",
    role: "Founder, Junto Community Alliance",
  },
  rating: null,
  // `> ` starts a pull quote and `- ` a bullet.
  body: [
    "I read Darryl Anderson's *The Culture Architect* over the course of a weekend, pen in hand, occasionally stopping to think about situations I had encountered over a 30-year career as an employee, manager and business owner.",
    "Some of the ideas clicked immediately. Others took some work. But perhaps that's not the test of a useful business book.",
    "The better test may be what remains after you close it. And quite a bit remained.",
    "At the center of *The Culture Architect* is an argument that seems deceptively simple: leaders don't merely inherit organizational culture. They help design it. If you're the architect, you own the architecture.",
    "That responsibility becomes particularly important when organizations confront change - which, as Anderson repeatedly reminds us, isn't an occasional interruption of normal business anymore. Change is the environment in which organizations operate.",
    "One idea that stayed with me was the difference between management and leadership. Both matter. But they solve different problems, and competence at one doesn't automatically produce competence at the other. Organizations routinely place people into leadership positions because they were successful managers, without necessarily preparing them for the very different work of leading people through uncertainty and change.",
    "A second idea was even simpler: people don't change merely because we've explained why they should. Leaders can present the data, explain the business case and demonstrate the logic. Everyone in the room may understand it. That doesn't mean anyone will behave differently Monday morning.",
    "Anderson's discussion of the difference between intellectual compliance and genuine commitment caused me to revisit more than one experience from my own career. Resistance isn't necessarily something to overcome. Sometimes resistance is information.",
    "That leads naturally to another of the book's central themes: don't design the change first and figure out what to do with the people afterward. Build the people into the equation from the beginning.",
    "Similarly, don't confuse project completion with successful change. The software went live, the training occurred, the boxes were checked, and the project team went home. But the bigger question is: Are the people who actually have to live with the change successfully using it six months later?",
    "Anderson also spends considerable time on three constants: People, Time and Change.",
    "People have finite capacity. Time is in finite supply. But change doesn't stop.",
    "That combination struck me as particularly relevant to entrepreneurs and small-business owners. Time may be the scarcest resource we have. Leadership therefore isn't simply responding faster to whatever demands attention today. At some point, it has to include building an organization capable of responding to what comes next without everything depending upon the owner.",
    "One of the more human observations in the book concerns the people themselves. The people around us have their own trajectories. An employee's career doesn't begin when that person comes to work for us, and it doesn't end when they leave. Leaders have stewardship over only a portion of another person's working life - and only for a finite period of time. Respect that. Better yet, embrace it.",
    "I happened to read *The Culture Architect* while building a new nonprofit organization whose culture is only beginning to form. That gave me the opportunity to read Anderson's argument somewhat backward.",
    'Instead of asking, "How do we fix the culture we\'ve created?" I found myself asking, "What can we do now to be intentional about the culture we\'re creating?"',
    "It also left me with a question I hope to explore further with the author:",
    "> What happens when the Culture Architect doesn't have employees?",
    "Many of the people who will ultimately shape the organization I'm building won't report to me. Board members, partners, presenters, librarians, sponsors, business owners and participants will largely be there because they choose to be.",
    "Compliance isn't particularly available. Commitment will need to be earned. Perhaps culture matters even more when you don't control the people.",
    "So no, I didn't close *The Culture Architect* having memorized every acronym or ready to deploy every tool in the book.",
    "Instead, I closed it with eight ideas I expect to carry forward:",
    "- Managing people and leading people are different things.",
    "- If you're the architect of your company's culture, then you own the architecture.",
    "- People don't change simply because you've explained why they should.",
    "- Don't call something successful merely because the project is finished.",
    "- People have finite capacity. Time is in finite supply. Change does not stop.",
    "- Build the people into the change equation from the beginning.",
    "- The people around you have their own trajectories. Respect that. Embrace that.",
    "- Culture may matter even more when you don't control the people.",
    "The eighth is admittedly my own extension of Anderson's argument. But maybe that's also a measure of a worthwhile business book.",
    "You don't necessarily close it with all the author's answers. Sometimes you close it with better questions of your own.",
    "Paul",
  ],
  // Optional: link to the review on Amazon.
  sourceUrl: null,
  eventSlug: "bi101",
  seo: {
    title: "The Culture Architect: A Reader's Take · Junto Community Alliance",
    description:
      "JCA founder Paul Huleatt on The Culture Architect by Darryl T. Anderson, presenter of the free Business Insights 101 workshop, and the eight ideas that stayed with him.",
  },
};

export const reviews: BookReview[] = [cultureArchitectReview];
