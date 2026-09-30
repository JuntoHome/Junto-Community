import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import type { Event } from "@/lib/content/types";
import { formatEventDates, formatPrice } from "@/lib/format";

function Row({ label, title, detail }: { label: string; title: ReactNode; detail?: ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-sand py-5 md:grid-cols-[9rem_1fr] md:py-6">
      <dt className="pt-0.5 text-[15px] text-muted">{label}</dt>
      <dd>
        <p className="text-lg font-semibold text-navy md:text-[19px]">{title}</p>
        {detail && <p className="mt-1 text-base text-muted md:text-[17px]">{detail}</p>}
      </dd>
    </div>
  );
}

/** When / Where / Online / Cost list with the register button. */
export function EventSummary({ event, contactEmail }: { event: Event; contactEmail: string }) {
  const dates = formatEventDates(event);
  const { inPerson, online } = event.attendance;
  const free = event.price === 0;

  return (
    <div>
      <dl className="border-t-2 border-navy">
        <Row label="When" title={dates.long} detail={dates.timeRange} />
        {inPerson && <Row label="Where" title={inPerson.venue.name} detail={inPerson.note} />}
        {online && <Row label="Online" title={online.platform ?? "Join online"} detail={online.note} />}
        <Row label="Cost" title={formatPrice(event.price)} />
      </dl>

      <ButtonLink href={event.registration.url} variant="gold" size="lg" className="mt-7 w-full rounded-md md:mt-8">
        Register {free ? "free " : ""}on {event.registration.provider}
      </ButtonLink>

      <p className="mt-4 text-[15px] text-muted md:text-base">
        Questions? Write to{" "}
        <a href={`mailto:${contactEmail}`} className="underline underline-offset-2">
          {contactEmail}
        </a>
      </p>
    </div>
  );
}
