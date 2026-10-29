/** A published "Who Can Help?" profile, as the public pages show it. */
export type Profile = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  /** Long text: paragraphs separated by a blank line, "- " bullets, **bold**, [links](https://...). */
  intro: string;
  howTheyHelp: string;
  whoShouldExplore: string;
  history: string | null;
  contact: {
    name: string | null;
    role: string | null;
    email: string | null;
    phone: string | null;
  };
  websiteUrl: string;
  logoUrl: string | null;
  updatedAt: string;
};
