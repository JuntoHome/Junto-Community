import type { Metadata } from "next";
import { SaveTheDateCard } from "@/components/event/save-the-date-card";
import { JoinSection } from "@/components/sections/join-section";
import { ButtonLink } from "@/components/ui/button";
import { Container, Pill } from "@/components/ui/primitives";
import { RichTextBlocks } from "@/components/ui/rich-text";
import { getPage, getSiteSettings, requireEvent } from "@/lib/content";
import { formatEventDates } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return pageMetadata(page.seo, "/");
}

export default async function HomePage() {
  const [page, site] = await Promise.all([getPage("home"), getSiteSettings()]);
  const event = await requireEvent(site.featuredEventSlug);
  const { hero } = page;

  return (
    <>
      <section aria-labelledby="hero-title">
        <Container className="grid gap-8 pt-9 pb-10 md:gap-12 md:pt-16 md:pb-20 lg:grid-cols-12 lg:gap-8 lg:pt-22 lg:pb-26">
          <div className="flex flex-col gap-5 md:gap-[26px] lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2.5">
              <Pill>{hero.badge}</Pill>
              <span className="text-sm font-semibold text-green md:text-[15px]">
                {event.name} · {formatEventDates(event).badge}
              </span>
            </div>
            <h1
              id="hero-title"
              className="font-serif text-[34px] leading-[1.1] font-bold text-navy md:text-5xl lg:text-6xl lg:leading-[1.08]"
            >
              {hero.headline}
            </h1>
            <p className="font-serif text-2xl font-bold text-gold-text md:text-[32px]">{hero.accent}</p>
            <div className="flex max-w-160 flex-col gap-5 text-[17px] leading-relaxed text-slate md:text-lg [&>p:first-child]:md:text-xl">
              <RichTextBlocks blocks={hero.body} />
            </div>
            <div className="hidden flex-wrap gap-4 pt-1.5 md:flex">
              <ButtonLink href={event.registration.url} size="lg" className="px-[30px]">
                {hero.primaryCtaLabel}
              </ButtonLink>
              <ButtonLink href={event.path} variant="outline" size="lg" className="px-[29px]">
                {hero.secondaryCtaLabel}
              </ButtonLink>
            </div>
          </div>

          <div className="lg:col-span-4 lg:col-start-9">
            <SaveTheDateCard event={event} eyebrow={page.saveTheDate.eyebrow} ctaLabel={page.saveTheDate.ctaLabel} />
          </div>
        </Container>
      </section>

      <JoinSection content={page.join} />

      <section aria-label="What's next" className="pb-11 md:pb-18">
        <Container>
          <p className="text-center text-base leading-normal text-muted md:text-lg">
            <span className="block font-serif text-xl font-bold text-green md:inline md:text-[22px]">
              {page.growth.heading}
            </span>{" "}
            {page.growth.body}
          </p>
        </Container>
      </section>
    </>
  );
}
