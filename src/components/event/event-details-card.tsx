import type { Event } from "@/lib/content/types";
import { formatAddress, formatEventDates, formatPrice } from "@/lib/format";
import { EventFact } from "./event-fact";
import { RegisterCta } from "./register-cta";

/** Full event details card used on an event page. */
export function EventDetailsCard({ event }: { event: Event }) {
  const dates = formatEventDates(event);
  const { inPerson, online } = event.attendance;

  return (
    <aside
      aria-label="Event details"
      className="flex flex-col gap-5 rounded-[18px] bg-white p-6 text-ink shadow-card-strong md:gap-[22px] md:p-9"
    >
      <EventFact icon="calendar" label="Date" title={dates.long} />
      <EventFact icon="clock" label="Time" title={dates.timeRangeWithZone} />
      {inPerson && (
        <EventFact icon="pin" label="Location" title={inPerson.venue.name}>
          <p className="text-base text-muted">{formatAddress(inPerson.venue)}</p>
          <p className="mt-1 text-sm font-semibold text-gold-text">{inPerson.note}</p>
        </EventFact>
      )}
      {online && (
        <EventFact icon="monitor" label="Online" title="Join free online">
          {online.platform ? (
            <p className="text-base text-muted">{online.platform}</p>
          ) : (
            <p data-placeholder className="text-base text-muted">
              [ONLINE PLATFORM: pending]
            </p>
          )}
        </EventFact>
      )}
      <EventFact icon="ticket" label="Cost" title={formatPrice(event.price)} />

      <RegisterCta event={event} label={event.price === 0 ? "Register Free" : "Register"} size="xl" />
    </aside>
  );
}
