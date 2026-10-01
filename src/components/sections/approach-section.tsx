import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/icon";
import { Container } from "@/components/ui/primitives";
import type { HomePage } from "@/lib/content/types";

// Per-position accents, matching the logo's gold / green / navy.
const accents: Array<{ dot: string; panel: string; icon: IconName }> = [
  { dot: "bg-gold", panel: "bg-gold/15 text-gold-text", icon: "book" },
  { dot: "bg-green", panel: "bg-green/12 text-green", icon: "users" },
  { dot: "bg-navy", panel: "bg-navy/10 text-navy", icon: "library" },
];

/** "We bring three things together": pillars, library band and who it's for. */
export function ApproachSection({ content }: { content: HomePage["approach"] }) {
  return (
    <section aria-labelledby="approach-title" className="border-t border-sand">
      <Container className="py-14 md:py-20 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <h2
            id="approach-title"
            className="font-serif text-[34px] leading-[1.1] font-normal tracking-[-0.01em] text-navy md:text-5xl lg:text-[56px]"
          >
            {content.heading}
          </h2>
          <Link href={content.link.href} className="text-[17px] font-semibold underline underline-offset-4">
            {content.link.label} <span aria-hidden="true">→</span>
          </Link>
        </div>

        {/* Pillars and the library band */}
        <div className="mt-10 border border-navy md:mt-14">
          <ul className="grid divide-y divide-navy bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
            {content.pillars.map((pillar, i) => {
              const accent = accents[i % accents.length];
              return (
                <li key={pillar.title} className="flex flex-col p-6 md:p-8">
                  {pillar.photo ? (
                    <Image
                      src={pillar.photo.src}
                      alt={pillar.photo.alt}
                      width={pillar.photo.width}
                      height={pillar.photo.height}
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="aspect-[59/48] w-full object-cover"
                    />
                  ) : (
                    <div aria-hidden="true" className={`flex aspect-[16/9] w-full items-center md:aspect-[4/3] justify-center ${accent.panel}`}>
                      <Icon name={accent.icon} size={56} strokeWidth={1.5} />
                    </div>
                  )}
                  <p className="mt-5 flex items-center gap-2.5 font-mono text-sm text-muted">
                    <span aria-hidden="true" className={`size-2.5 rounded-full ${accent.dot}`} />
                    {pillar.tag}
                  </p>
                  <h3 className="mt-auto pt-8 font-serif text-[26px] leading-[1.15] font-normal text-navy md:pt-12 md:text-[28px]">
                    {pillar.title}
                  </h3>
                </li>
              );
            })}
          </ul>
          <div className="bg-navy px-6 py-6 md:px-8 md:py-7">
            <p className="font-serif text-2xl text-gold-light italic md:text-[30px]">{content.centerLine}</p>
          </div>
        </div>

        {/* Who it's for */}
        <div className="mt-16 grid gap-6 md:mt-24 lg:grid-cols-12 lg:gap-8">
          <h3 className="font-serif text-3xl font-normal text-navy md:text-[38px] lg:col-span-4">
            {content.audience.heading}
          </h3>
          <dl className="border-t border-sand lg:col-span-7 lg:col-start-6">
            {content.audience.rows.map((row) => (
              <div key={row.label} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-sand py-4 md:grid-cols-[9rem_1fr]">
                <dt className="text-base text-muted">{row.label}</dt>
                <dd className={row.emphasis ? "text-base font-semibold text-navy md:text-[17px]" : "text-base text-slate md:text-[17px]"}>
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Container>
    </section>
  );
}
