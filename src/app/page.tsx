import type { Metadata } from "next";
import Link from "next/link";
import { EventSummary } from "@/components/event/event-summary";
import { ApproachSection } from "@/components/sections/approach-section";
import { HomeHero } from "@/components/sections/home-hero";
import { JoinSection } from "@/components/sections/join-section";
import { Container } from "@/components/ui/primitives";
import { RichTextBlocks } from "@/components/ui/rich-text";
import { getEvent, getPage, getSiteSettings } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

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
      <HomeHero content={hero} />

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
