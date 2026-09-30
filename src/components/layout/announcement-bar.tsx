import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { getEvent, getSiteSettings } from "@/lib/content";
import { formatEventDates } from "@/lib/format";
import { HideOnPath } from "./hide-on-path";

/** Navy strip above the header promoting the featured event. Hidden on that event's own page. */
export async function AnnouncementBar() {
  const site = await getSiteSettings();
  const event = await getEvent(site.featuredEventSlug);
  if (!event) return null;

  const dates = formatEventDates(event);
  const venue = event.attendance.inPerson?.venue.name;

  return (
    <HideOnPath path={event.path}>
      <div className="bg-navy text-[13px] text-mist md:text-[15px]">
        <Container className="flex min-h-10 items-center justify-between gap-4 py-2">
          <p>
            {event.price === 0 ? "Free workshop" : "Workshop"}:{" "}
            <strong className="font-semibold text-white">
              <span className="hidden sm:inline">{event.name}</span>
              <span className="sm:hidden">{event.code}</span>
            </strong>
            <span className="hidden sm:inline">
              {" "}
              · {dates.monthDay}
              {venue && `, at ${venue}`}
            </span>
            <span className="sm:hidden"> · {dates.badge}</span>
          </p>
          <Link
            href={event.path}
            className="shrink-0 text-gold-light underline underline-offset-2 hover:text-white"
          >
            <span className="hidden sm:inline">{site.announcementLinkLabel}</span>
            <span className="sm:hidden">Details</span>
          </Link>
        </Container>
      </div>
    </HideOnPath>
  );
}
