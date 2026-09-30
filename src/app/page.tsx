import type { Metadata } from "next";
import Link from "next/link";
import { EventSummary } from "@/components/event/event-summary";
import { ApproachSection } from "@/components/sections/approach-section";
import { JoinSection } from "@/components/sections/join-section";
import { ButtonLink } from "@/components/ui/button";
import { Container, Pill } from "@/components/ui/primitives";
import { RichText, RichTextBlocks } from "@/components/ui/rich-text";
import { getEvent, getPage, getSiteSettings } from "@/lib/content";
import { formatEventDates } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

const pillarColors = ["bg-gold text-navy-deep", "bg-green text-white", "bg-navy text-white"];

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return pageMetadata(page.seo, "/");
}

export default async function HomePage() {
  const [page, site] = await Promise.all([getPage("home"), getSiteSettings()]);
  const event = await getEvent(site.featuredEventSlug);
  const { hero, approach, featuredEvent } = page;

  return (
    <>
      {/* Hero: the organization first */}
      <section aria-labelledby="hero-title">
        <Container className="grid gap-10 pt-9 pb-12 md:pt-16 md:pb-20 lg:grid-cols-12 lg:items-center lg:gap-8 lg:pt-22 lg:pb-26">
          <div className="flex flex-col gap-5 md:gap-7 lg:col-span-7">
            {event && (
              <Link
                href={event.path}
                className="group flex w-fit flex-wrap items-center gap-2.5 rounded-2xl border sm:rounded-full border-sand bg-white py-1.5 pr-4 pl-1.5 no-underline shadow-sm hover:border-green"
              >
                <Pill>{event.price === 0 ? "Free workshop" : "Workshop"}</Pill>
                <span className="text-sm font-semibold text-green md:text-[15px]">
                  {event.name} · {formatEventDates(event).badge}
                  <span aria-hidden="true" className="ml-1.5 inline-block transition-transform group-hover:translate-x-0.5">
                    →
                  </span>
                </span>
              </Link>
            )}
            <h1
              id="hero-title"
              className="font-serif text-[40px] leading-[1.08] font-bold text-navy md:text-6xl lg:text-[68px] lg:leading-[1.04]"
            >
              {hero.heading}
            </h1>
            <p className="max-w-160 text-lg leading-relaxed text-slate md:text-[21px]">
              <RichText value={hero.body} />
            </p>
            <div className="flex flex-wrap gap-3 pt-1 md:gap-4">
              <ButtonLink href={hero.primaryCta.href} size="lg" className="px-[30px]">
                {hero.primaryCta.label}
              </ButtonLink>
              <ButtonLink href={hero.secondaryCta.href} variant="outline" size="lg" className="px-[29px]">
                {hero.secondaryCta.label}
              </ButtonLink>
            </div>
          </div>

          <ul className="flex flex-col gap-4 rounded-[18px] border border-sand bg-white p-6 shadow-card md:p-8 lg:col-span-4 lg:col-start-9 lg:gap-5">
            {hero.pillars.map((pillar, i) => (
              <li key={pillar} className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className={`flex size-11 shrink-0 items-center justify-center rounded-full font-serif text-lg font-bold ${pillarColors[i % pillarColors.length]}`}
                >
                  {i + 1}
                </span>
                <span className="font-serif text-xl leading-snug font-bold text-navy md:text-[22px]">{pillar}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <ApproachSection content={approach} />

      {/* Featured workshop */}
      {event && (
        <section aria-labelledby="featured-title" className="border-t border-sand">
          <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
            <div className="flex flex-col lg:col-span-6">
              <p className="text-base font-semibold text-green md:text-[17px]">{featuredEvent.eyebrow}</p>
              <h2
                id="featured-title"
                className="mt-2 font-serif text-[42px] leading-[1.05] font-normal tracking-[-0.01em] text-navy md:text-[56px] lg:text-[64px]"
              >
                {event.name}
              </h2>
              <p className="mt-7 font-serif text-2xl leading-snug font-normal text-navy italic md:mt-9 md:text-[30px]">
                &ldquo;{featuredEvent.hook}&rdquo;
              </p>
              <p className="mt-4 font-serif text-xl font-normal text-gold-text md:text-2xl">{featuredEvent.accent}</p>
              <div className="mt-7 flex max-w-150 flex-col gap-5 text-[17px] leading-[1.7] text-slate md:mt-9 md:text-lg">
                <RichTextBlocks blocks={featuredEvent.body} />
              </div>
              <Link href={event.path} className="mt-7 w-fit text-[17px] font-semibold">
                {featuredEvent.detailsLinkLabel} <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="lg:col-span-5 lg:col-start-8 lg:pt-8">
              <EventSummary event={event} contactEmail={site.contactEmail} />
            </div>
          </Container>
        </section>
      )}

      <JoinSection content={page.join} />
    </>
  );
}
