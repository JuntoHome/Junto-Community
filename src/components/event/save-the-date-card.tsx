import Link from "next/link";
import { Eyebrow } from "@/components/ui/primitives";
import type { Event } from "@/lib/content/types";
import { formatEventDates } from "@/lib/format";
import { EventFact } from "./event-fact";
import { RegisterCta } from "./register-cta";

/** Compact event summary used on the homepage. */
export function SaveTheDateCard({
  event,
  eyebrow,
  ctaLabel,
}: {
  event: Event;
  eyebrow: string;
  ctaLabel: string;
}) {
  const dates = formatEventDates(event);
  const { inPerson, online } = event.attendance;

  return (
    <aside
      aria-labelledby="save-the-date-title"
      className="flex flex-col gap-5 rounded-[18px] border border-sand bg-white p-6 shadow-card md:p-8"
    >
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id="save-the-date-title" className="font-serif text-2xl leading-tight font-bold text-navy md:text-[28px]">
        {event.name}
      </h2>

      <EventFact
        icon="calendar"
        title={
          <>
            <span className="md:hidden">{dates.short}</span>
            <span className="hidden md:inline">{dates.long}</span>
          </>
        }
      >
        <p className="text-[15px] text-muted">{dates.timeRange}</p>
      </EventFact>
      {inPerson && (
        <EventFact icon="pin" title={inPerson.venue.name}>
          <p className="text-[15px] text-muted">{inPerson.note}</p>
        </EventFact>
      )}
      {online && (
        <EventFact icon="monitor" title={inPerson ? "Or join online" : "Online"}>
          <p className="text-[15px] text-muted">{online.note}</p>
        </EventFact>
      )}

      <RegisterCta event={event} label={ctaLabel} />
      <Link href={event.path} className="text-center text-[15px] font-semibold md:hidden">
        Workshop details
      </Link>
    </aside>
  );
}
