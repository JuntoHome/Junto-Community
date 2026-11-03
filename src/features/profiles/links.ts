/** A profile's "Official sources / useful links" entry as typed: a web address, or [text](address). */
export const LINK_WITH_TEXT = /^\[([^\]]+)\]\(([^)\s]+)\)$/;

export type UsefulLink = { label: string; url: string };

/**
 * A web address as people read it: "score.org/az/greater-phoenix" from
 * "https://www.score.org/az/greater-phoenix/". Spaces and other escaped characters show as typed.
 */
export function displayAddress(url: string): string {
  try {
    const { hostname, pathname, search } = new URL(url);
    let path = pathname.replace(/\/$/, "");
    try {
      path = decodeURIComponent(path);
    } catch {
      // Keep it escaped.
    }
    return `${hostname.replace(/^www\./, "")}${path}${search}`;
  } catch {
    return url;
  }
}

/** A stored link, ready to show: its text, or its address when it has none. */
export function toUsefulLink(entry: string): UsefulLink {
  const withText = LINK_WITH_TEXT.exec(entry);
  return withText ? { label: withText[1], url: withText[2] } : { label: displayAddress(entry), url: entry };
}
