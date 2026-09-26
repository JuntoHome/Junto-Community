import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";
import type { ContentSource } from "./source";
import { localSource } from "./sources/local";
import type { PageKey } from "./types";

export type * from "./types";

/** The active content source. Swap or branch here when a CMS is added. */
const source: ContentSource = localSource;

export const getSiteSettings = cache(() => source.getSiteSettings());

export const getEvent = cache((slug: string) => source.getEvent(slug));

export const listEvents = cache(() => source.listEvents());

export const getPage = cache(<K extends PageKey>(key: K) => source.getPage(key));

/** Like `getEvent`, but renders the 404 page when the event does not exist. */
export async function requireEvent(slug: string) {
  const event = await getEvent(slug);
  if (!event) notFound();
  return event;
}
