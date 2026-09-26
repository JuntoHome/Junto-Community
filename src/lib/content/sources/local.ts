import { events } from "@/content/events";
import { pages } from "@/content/pages";
import { site } from "@/content/site";
import type { ContentSource } from "../source";

export const localSource: ContentSource = {
  async getSiteSettings() {
    return site;
  },
  async getEvent(slug) {
    return events.find((event) => event.slug === slug) ?? null;
  },
  async listEvents() {
    return [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  },
  async getPage(key) {
    return pages[key];
  },
};
