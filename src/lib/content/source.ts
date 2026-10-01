import type { BookReview, Event, PageKey, PageMap, SiteSettings } from "./types";

/**
 * A place content comes from. The site ships with a local source (typed
 * files in `src/content`). To add a CMS, implement this interface in
 * `sources/<cms>.ts` and register it in `./index.ts`.
 */
export interface ContentSource {
  getSiteSettings(): Promise<SiteSettings>;
  getEvent(slug: string): Promise<Event | null>;
  listEvents(): Promise<Event[]>;
  getPage<K extends PageKey>(key: K): Promise<PageMap[K]>;
  getReview(slug: string): Promise<BookReview | null>;
  listReviews(): Promise<BookReview[]>;
}
