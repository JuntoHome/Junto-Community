import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { RichTextBlocks } from "@/components/ui/rich-text";
import { getPage, getSiteSettings } from "@/lib/content";
import { cn } from "@/lib/cn";
import { pageMetadata } from "@/lib/seo";

const PATH = "/library-intelligence";

const headingClass = "font-serif text-[28px] leading-tight font-bold text-navy md:text-4xl";
const proseClass = "flex flex-col gap-5 text-base leading-[1.7] text-slate md:text-[19px]";

export async function generateMetadata(): Promise<Metadata> {
  const [page, site] = await Promise.all([getPage("libraryIntelligence"), getSiteSettings()]);
  return pageMetadata(page.seo, PATH, site);
}

/** Link to another site. Opens in a new tab and says so to screen readers. */
function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("underline underline-offset-2", className)}
    >
      {children}
      <span aria-hidden="true"> ↗</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default async function LibraryIntelligencePage() {
  const page = await getPage("libraryIntelligence");
  const { editorNote, notes, furtherReading } = page;

  return (
    <Container className="py-10 md:py-16 lg:py-20">
      <div className="mx-auto flex max-w-180 flex-col">
        <header>
          <h1 className="font-serif text-[38px] leading-[1.1] font-bold text-navy md:text-5xl lg:text-[64px] lg:leading-[1.06]">
            {page.heading}
          </h1>
          <p className="mt-4 font-serif text-xl leading-snug font-bold text-gold-text md:mt-5 md:text-[26px]">
            {page.intro}
          </p>
        </header>

        <section aria-labelledby="editor-title" className="mt-10 border-t border-sand pt-10 md:mt-14 md:pt-14">
          <h2 id="editor-title" className={headingClass}>
            {editorNote.heading}
          </h2>
          <div className={cn(proseClass, "mt-5 md:mt-6")}>
            <RichTextBlocks blocks={editorNote.body} />
            <p className="font-serif text-xl text-navy italic md:text-2xl">{editorNote.signature}</p>
          </div>
        </section>

        {notes.map((note) => (
          <article
            key={note.slug}
            id={note.slug}
            aria-labelledby={`${note.slug}-title`}
            className="mt-10 scroll-mt-6 rounded-[18px] border border-sand bg-white px-[22px] py-7 md:mt-14 md:rounded-[20px] md:px-10 md:py-10"
          >
            <Eyebrow className="text-[13px] md:text-sm">{note.label}</Eyebrow>
            <h2 id={`${note.slug}-title`} className={cn(headingClass, "mt-3")}>
              {note.title}
            </h2>
            <p className="mt-2 font-serif text-xl leading-snug text-gold-text md:text-2xl">{note.subtitle}</p>
            <div className={cn(proseClass, "mt-6")}>
              <RichTextBlocks blocks={note.body} />
            </div>
            {note.source && (
              <p className="mt-7 border-t border-sand pt-5 text-[15px] leading-relaxed text-muted md:text-base">
                Source: <ExternalLink href={note.source.href}>{note.source.label}</ExternalLink>
              </p>
            )}
          </article>
        ))}

        <section aria-labelledby="reading-title" className="mt-10 md:mt-14">
          <h2 id="reading-title" className={headingClass}>
            {furtherReading.heading}
          </h2>
          <ul className="mt-5 flex flex-col gap-6 md:mt-6">
            {furtherReading.items.map((item) => (
              <li key={item.href}>
                <ExternalLink href={item.href} className="text-[17px] font-semibold md:text-[19px]">
                  {item.label}
                </ExternalLink>
                <p className="mt-1.5 text-base leading-relaxed text-slate md:text-[17px]">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="archive-title" className="mt-10 border-t border-sand pt-10 md:mt-14 md:pt-14">
          <h2 id="archive-title" className={headingClass}>
            {page.archiveHeading}
          </h2>
          <ul className="mt-5 flex flex-col gap-3 text-base text-slate md:mt-6 md:text-[19px]">
            {notes.map((note) => (
              <li key={note.slug}>
                {note.date}:{" "}
                <a href={`#${note.slug}`} className="font-semibold underline underline-offset-2">
                  {note.title}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-12 md:mt-16">
          <ButtonLink href={page.eventLink.href} className="w-full py-3 sm:w-auto">
            {page.eventLink.label}
            <span aria-hidden="true">→</span>
          </ButtonLink>
        </div>
      </div>
    </Container>
  );
}
