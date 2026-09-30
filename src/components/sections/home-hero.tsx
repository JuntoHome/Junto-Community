import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { RichText } from "@/components/ui/rich-text";
import type { HomePage } from "@/lib/content/types";

/** Full-width photo with a text card overlapping its bottom-left corner. */
export function HomeHero({ content }: { content: HomePage["hero"] }) {
  return (
    <section aria-labelledby="hero-title">
      <div className="relative h-[260px] overflow-hidden bg-[#e3ddd0] md:h-[420px] lg:h-[540px]">
        {content.photo && (
          <Image
            src={content.photo.src}
            alt={content.photo.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover object-[center_12%]"
          />
        )}
      </div>

      <Container>
        <div className="relative -mt-16 mr-6 -ml-5 bg-ivory pt-7 pr-5 pb-12 pl-5 md:mr-0 md:-mt-36 md:ml-0 md:max-w-[740px] md:px-11 md:pt-11 md:pb-20 lg:-mt-44">
          <h1
            id="hero-title"
            className="font-serif text-[34px] leading-[1.05] font-normal tracking-[-0.015em] text-navy sm:text-[48px] md:text-[64px] lg:text-[72px]"
          >
            {content.heading.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
            <span className="block text-green italic">{content.headingAccent}</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-slate md:mt-8 md:text-lg">
            <RichText value={content.body} />
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4 md:mt-8">
            <ButtonLink href={content.primaryCta.href} size="lg" className="rounded-md px-6">
              {content.primaryCta.label}
            </ButtonLink>
            <Link
              href={content.secondaryCta.href}
              className="text-[17px] font-semibold underline underline-offset-4"
            >
              {content.secondaryCta.label}
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}
