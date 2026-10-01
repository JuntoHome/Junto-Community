import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Container, Eyebrow, Pill } from "@/components/ui/primitives";
import { RichText, RichTextBlocks } from "@/components/ui/rich-text";
import type { Event, SiteSettings } from "@/lib/content/types";
import { formatEventDates, formatPrice } from "@/lib/format";
import { eventJsonLd, jsonLdScript } from "@/lib/seo";
import { EventDetailsCard } from "./event-details-card";

const bulletColors = ["bg-gold", "bg-green", "bg-navy"];

/**
 * Full page template for a single event. Every workshop page renders this
 * with its own `Event` content, so a new workshop needs only new content.
 */
export function EventPage({ event, site }: { event: Event; site: SiteSettings }) {
  const dates = formatEventDates(event);
  const { presenter, about } = event;
  const where = [event.attendance.inPerson?.venue.name, event.attendance.online && "online"]
    .filter(Boolean)
    .join(" or ");
  const registerLabel = event.price === 0 ? "Register Free" : "Register";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(eventJsonLd(event, site)) }} />

      {/* Hero */}
      <section aria-labelledby="event-title" className="bg-navy text-white">
        <Container className="grid gap-8 pt-10 pb-11 md:pt-16 md:pb-20 lg:grid-cols-12 lg:gap-8 lg:pt-22 lg:pb-24">
          <div className="flex flex-col gap-[18px] md:gap-6 lg:col-span-7 lg:pt-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {event.price === 0 && <Pill>Free workshop</Pill>}
              <span className="text-sm text-fog md:text-[15px]">Presented by {site.name}</span>
            </div>
            <h1 id="event-title" className="font-serif text-[46px] leading-[1.04] font-bold md:text-7xl lg:text-[80px] lg:leading-[1.02]">
              {event.name}
            </h1>
            <p className="max-w-160 font-serif text-[21px] leading-snug font-medium text-gold-light md:text-[28px] md:leading-[1.4]">
              <RichText value={event.hero.lead} />
            </p>
            <p className="max-w-155 text-base leading-normal text-white md:text-lg">
              <RichText value={event.hero.seatingNote} />
            </p>
            <p className="text-base text-fog md:text-[17px] [&_strong]:text-white">
              <RichText value={event.hero.presenterLine} />
            </p>
            <ButtonLink href={event.registration.url} variant="gold" size="lg" className="mt-1 md:hidden">
              {registerLabel}
            </ButtonLink>
          </div>
          <div className="lg:col-span-5">
            <EventDetailsCard event={event} />
          </div>
        </Container>
      </section>

      {/* About */}
      <section aria-labelledby="about-title">
        <Container className="grid gap-8 pt-11 md:pt-20 lg:grid-cols-12 lg:gap-8 lg:pt-26 lg:pb-22">
          <div className="flex flex-col gap-[18px] md:gap-[22px] lg:col-span-7">
            <h2 id="about-title" className="font-serif text-[30px] font-bold text-navy md:text-[44px]">
              {about.heading}
            </h2>
            <p className="text-lg leading-relaxed font-medium text-ink md:text-[21px]">
              <RichText value={about.intro} />
            </p>
            <div className="flex flex-col gap-[18px] text-base leading-[1.7] text-slate md:gap-[22px] md:text-[19px]">
              <RichTextBlocks blocks={about.body} />
            </div>
          </div>
          <div className="flex flex-col gap-[18px] self-start rounded-2xl border border-sand bg-white p-6 md:p-8 lg:col-span-4 lg:col-start-9">
            <h3 className="text-xl font-bold">{about.highlightsHeading}</h3>
            <ul className="flex flex-col gap-[18px]">
              {about.highlights.map((item, i) => (
                <li key={item} className="flex gap-3 text-base leading-normal text-slate md:text-[17px]">
                  <span
                    aria-hidden="true"
                    className={`mt-2 size-2 shrink-0 rounded-full ${bulletColors[i % bulletColors.length]}`}
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {/* Presenter */}
      <section aria-labelledby="presenter-title" className="pt-11 md:pt-20 lg:pt-0">
        <Container>
          <div className="grid gap-4 rounded-[18px] border border-sand bg-white px-[22px] py-7 md:grid-cols-12 md:gap-10 md:rounded-[20px] md:px-12 md:py-12 lg:px-16 lg:py-14">
            <div className="md:col-span-4 lg:col-span-3 md:flex md:justify-center">
              {presenter.photo ? (
                <Image
                  src={presenter.photo.src}
                  alt={presenter.photo.alt}
                  width={presenter.photo.width}
                  height={presenter.photo.height}
                  sizes="(min-width: 768px) 220px, 140px"
                  className="size-35 rounded-full object-cover md:size-55"
                />
              ) : (
                <div
                  data-placeholder
                  className="flex size-35 items-center justify-center rounded-full border-2 border-dashed border-sage-border bg-sage p-4 text-center text-[13px] text-sage-text md:size-55 md:p-6 md:text-sm"
                >
                  [PHOTO: {presenter.name}]
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 md:col-span-8 lg:col-span-9 md:gap-[18px]">
              <Eyebrow className="text-[13px] tracking-[0.14em] md:text-sm">Your presenter</Eyebrow>
              <h2 id="presenter-title" className="font-serif text-[30px] font-bold text-navy md:text-[40px]">
                {presenter.name}
              </h2>
              <p className="text-[15px] leading-normal font-semibold text-muted md:text-[17px]">
                <RichText value={presenter.role} />
              </p>
              <div className="flex flex-col gap-4 text-base leading-[1.65] text-slate md:text-lg md:leading-[1.7]">
                <RichTextBlocks blocks={presenter.bio} />
              </div>
              {event.readingPrompt && (
                <p className="mt-2 flex gap-3 rounded-xl bg-parchment px-5 py-4 text-base leading-relaxed text-ink md:text-[17px]">
                  <Icon name="book" size={22} className="mt-0.5 shrink-0 text-gold-text" />
                  <span>
                    <RichText value={event.readingPrompt.lead} />{" "}
                    {/* Opens in a new tab so the registration page stays open. */}
                    <a
                      href={event.readingPrompt.href}
                      target="_blank"
                      rel="noopener"
                      className="font-semibold underline underline-offset-2"
                    >
                      <RichText value={event.readingPrompt.linkLabel} />
                      <span aria-hidden="true"> ↗</span>
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </span>
                </p>
              )}
            </div>
          </div>
        </Container>
      </section>

      {/* Save your seat */}
      <section aria-labelledby="seat-title" className="pt-11 pb-12 md:pt-20 md:pb-24 lg:pt-26">
        <Container>
          <div className="flex flex-col gap-5 rounded-[18px] bg-gold px-[22px] py-7 md:rounded-[20px] md:px-12 md:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-16 lg:py-14">
            <div className="flex flex-col gap-2.5">
              <h2 id="seat-title" className="font-serif text-[32px] font-bold text-navy-deep md:text-[44px]">
                {event.saveYourSeat.heading}
              </h2>
              <p className="text-base text-on-gold md:text-[19px]">
                {dates.monthDay} · {dates.timeRange} · {where} · {formatPrice(event.price)}
              </p>
              <p className="text-base font-semibold text-on-gold">{event.saveYourSeat.note}</p>
            </div>
            <ButtonLink href={event.registration.url} variant="navyDeep" size="xl" className="shrink-0 text-lg md:text-xl">
              {registerLabel}
            </ButtonLink>
          </div>
          <p className="mt-6 text-center text-base text-muted md:mt-7 md:text-[17px]">
            Not ready yet?{" "}
            <Link href="/#join" className="font-semibold">
              Join the Junto
            </Link>{" "}
            to hear about future workshops.
          </p>
        </Container>
      </section>
    </>
  );
}
