import type { Event, Venue } from "@/lib/content/types";

function dateFormat(event: Event, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", { timeZone: event.timeZone, ...options });
}

function timeParts(event: Event, iso: string) {
  const parts = dateFormat(event, { hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(
    new Date(iso),
  );
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { clock: `${get("hour")}:${get("minute")}`, period: get("dayPeriod") };
}

/** Display strings for an event's date and time, derived from its ISO timestamps. */
export function formatEventDates(event: Event) {
  const start = new Date(event.startsAt);
  const from = timeParts(event, event.startsAt);
  const to = timeParts(event, event.endsAt);

  // "12:00 to 2:00 PM", or "11:00 AM to 1:00 PM" when the period changes.
  const timeRange =
    from.period === to.period
      ? `${from.clock} to ${to.clock} ${to.period}`
      : `${from.clock} ${from.period} to ${to.clock} ${to.period}`;

  const long = dateFormat(event, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const monthDay = dateFormat(event, { weekday: "long", month: "long", day: "numeric" });
  const short = dateFormat(event, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  const badge = dateFormat(event, { weekday: "short", month: "short", day: "numeric" });

  return {
    /** "Wednesday, October 21, 2026" */
    long: long.format(start),
    /** "Wednesday, October 21" */
    monthDay: monthDay.format(start),
    /** "Wed, Oct 21, 2026" */
    short: short.format(start),
    /** "Wed, Oct 21" */
    badge: badge.format(start),
    /** "12:00 to 2:00 PM" */
    timeRange,
    /** "12:00 to 2:00 PM MST" */
    timeRangeWithZone: `${timeRange} ${event.timeZoneLabel}`,
  };
}

export function formatAddress(venue: Venue) {
  return `${venue.streetAddress}, ${venue.locality}, ${venue.region} ${venue.postalCode}`;
}

export function formatPrice(price: number) {
  return price === 0 ? "Free" : `$${price.toFixed(2)}`;
}

// Admin dates are shown in Arizona time (no daylight saving), where JCA's admins work.
const adminDateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Phoenix",
});
const adminDate = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "America/Phoenix" });
const relative = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

/** "Oct 30, 2026, 8:26 AM" in Arizona time. */
export function formatDateTime(iso: string) {
  return adminDateTime.format(new Date(iso));
}

/** "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago", then the date ("Oct 30, 2026"). */
export function timeAgo(iso: string, now: Date) {
  const seconds = Math.round((Date.parse(iso) - now.getTime()) / 1000);
  const elapsed = Math.abs(seconds);
  if (elapsed < 60) return "just now";
  if (elapsed < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (elapsed < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (elapsed < 7 * 86400) return relative.format(Math.round(seconds / 86400), "day");
  return adminDate.format(new Date(iso));
}
