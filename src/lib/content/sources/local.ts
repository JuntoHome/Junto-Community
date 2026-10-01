import { events } from "@/content/events";
import { pages } from "@/content/pages";
import { reviews } from "@/content/reviews";
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
  async getReview(slug) {
    return reviews.find((review) => review.slug === slug) ?? null;
  },
  async listReviews() {
    return reviews;
  },
};
