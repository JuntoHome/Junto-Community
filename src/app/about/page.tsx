import type { Metadata } from "next";
import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { RichTextBlocks } from "@/components/ui/rich-text";
import { getPage, getSiteSettings } from "@/lib/content";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const [page, site] = await Promise.all([getPage("about"), getSiteSettings()]);
  return pageMetadata(page.seo, "/about", site);
}

export default async function AboutPage() {
  const [page, site] = await Promise.all([getPage("about"), getSiteSettings()]);

  return (
    <>
      <section aria-labelledby="about-title">
        <Container className="grid gap-4 pt-10 pb-8 md:gap-8 md:pt-16 lg:grid-cols-12 lg:items-center lg:pt-22 lg:pb-18">
          <div className="flex flex-col gap-4 md:gap-[22px] lg:col-span-7">
            <Eyebrow className="text-[13px] tracking-[0.14em] md:text-sm">{page.eyebrow}</Eyebrow>
            <h1
              id="about-title"
              className="font-serif text-[38px] leading-[1.1] font-bold text-navy md:text-5xl lg:text-[64px] lg:leading-[1.06]"
            >
              {page.heading}
            </h1>
            <p className="font-serif text-xl leading-snug font-bold text-gold-text md:text-[28px]">{page.lead}</p>
          </div>
          <div className="mt-2 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:flex lg:justify-end">
            <Image
              src={site.logos.stacked.src}
              alt=""
              width={site.logos.stacked.width}
              height={site.logos.stacked.height}
              sizes="(min-width: 768px) 300px, 200px"
              priority
              className="size-50 rounded-2xl border border-sand bg-white object-contain md:size-75 md:rounded-[20px]"
            />
          </div>
        </Container>
      </section>

      {page.body && (
        <section aria-label="Our story" className="pb-10 md:pb-22">
          <Container>
            <div className="mx-auto flex max-w-180 flex-col gap-5 text-base leading-[1.7] text-slate md:text-[19px]">
              <RichTextBlocks
                blocks={page.body}
                headingClassName="mt-6 font-serif text-[26px] leading-tight font-bold text-navy md:mt-10 md:text-4xl"
              />
            </div>
          </Container>
        </section>
      )}

      <section aria-labelledby="about-cta-title" className="pb-12 md:pb-24">
        <Container>
          <div className="flex flex-col gap-3.5 rounded-[18px] bg-navy px-[22px] py-7 md:rounded-[20px] md:px-12 md:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-16 lg:py-14">
            <div className="flex max-w-180 flex-col gap-3.5 lg:gap-3">
              <h2
                id="about-cta-title"
                className="font-serif text-[30px] leading-[1.12] font-bold text-gold-light md:text-[44px]"
              >
                {page.cta.heading}
              </h2>
              <p className="text-base leading-normal text-mist md:text-lg">{page.cta.body}</p>
            </div>
            <ButtonLink href={page.cta.link.href} variant="gold" size="lg" className="shrink-0 px-8 text-[17px] md:text-lg">
              {page.cta.link.label}
            </ButtonLink>
          </div>
        </Container>
      </section>
    </>
  );
}
