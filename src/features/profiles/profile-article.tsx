import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { RichTextBlocks } from "@/components/ui/rich-text";
import type { WhoCanHelpPage } from "@/lib/content/types";
import { cn } from "@/lib/cn";
import type { UsefulLink } from "./links";
import { ProfileLogo } from "./profile-logo";
import { PROFILES_PATH } from "./queries";
import { PROFILE_LABELS, type ProfileField } from "./schema";
import { toBlocks } from "./text";
import type { Profile } from "./types";

const headingClass = "font-serif text-[28px] leading-tight font-bold text-navy md:text-4xl";
const proseClass = "flex flex-col gap-5 text-base leading-[1.7] text-slate md:text-[19px]";

/**
 * Stands in for a field a published profile must have. Visitors never see it (the database
 * won't publish a profile without these); it shows a draft's preview what's still missing.
 */
function NotFilledIn({ field, className }: { field: ProfileField; className?: string }) {
  return (
    <p className={cn("rounded-xl border-2 border-dashed px-5 py-4 text-base font-semibold", className)}>
      {PROFILE_LABELS[field]}: not filled in yet
    </p>
  );
}

const notFilledInClass = "border-field text-muted";
const notFilledInOnNavyClass = "border-white/40 text-mist";

// Getting started sits in the navy box, so its text and links are light.
const onNavyClass =
  "flex flex-col gap-4 text-base leading-[1.7] text-mist md:text-[17px] [&_a]:text-white [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-gold-light [&_strong]:text-white";

function Text({ field, text }: { field: ProfileField; text: string }) {
  return text.trim() ? (
    <RichTextBlocks blocks={toBlocks(text)} />
  ) : (
    <NotFilledIn field={field} className={notFilledInClass} />
  );
}

function Section({ id, title, field, text }: { id: string; title: string; field: ProfileField; text: string }) {
  return (
    <section aria-labelledby={id} className="mt-10 border-t border-sand pt-10 md:mt-14 md:pt-14">
      <h2 id={id} className={headingClass}>
        {title}
      </h2>
      <div className={cn(proseClass, "mt-5 md:mt-6")}>
        <Text field={field} text={text} />
      </div>
    </section>
  );
}

/** "phoenix.score.org" from "https://www.phoenix.score.org/start", for the website button. */
function displayHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Contact({ contact, title }: { contact: Profile["contact"]; title: string }) {
  if (!contact.name && !contact.role && !contact.email && !contact.phone) return null;
  return (
    <div className="mt-7 border-t border-white/20 pt-6">
      <h3 className="text-sm font-bold tracking-[0.12em] text-gold-light uppercase">{title}</h3>
      <div className="mt-3 flex flex-col gap-1 text-base md:text-[17px]">
        {contact.name && <p className="font-semibold">{contact.name}</p>}
        {contact.role && <p className="text-mist">{contact.role}</p>}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="w-fit text-white underline underline-offset-2 hover:text-gold-light"
          >
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a
            href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}
            className="w-fit text-white underline underline-offset-2 hover:text-gold-light"
          >
            {contact.phone}
          </a>
        )}
      </div>
    </div>
  );
}

/** Official sources / useful links, at the end of the profile. Each opens in a new tab. */
function UsefulLinks({ links, title }: { links: UsefulLink[]; title: string }) {
  if (links.length === 0) return null;
  return (
    <section aria-labelledby="useful-links" className="mt-10 md:mt-12">
      <h2 id="useful-links" className="font-serif text-2xl leading-tight font-bold text-navy md:text-[28px]">
        {title}
      </h2>
      <ul className="mt-4 flex list-disc flex-col gap-2.5 pl-6 text-base marker:text-gold md:text-[17px]">
        {links.map((link, index) => (
          <li key={index}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-semibold wrap-anywhere">
              {link.label} <span aria-hidden="true">↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A profile as visitors see it, in Paul's order. Used by the public profile page and the admin preview. */
export function ProfileArticle({ profile, page }: { profile: Profile; page: WhoCanHelpPage }) {
  const { sections } = page;

  return (
    <Container className="py-10 md:py-16 lg:py-20">
      <article className="mx-auto flex max-w-180 flex-col">
        <Link href={PROFILES_PATH} className="w-fit text-[15px] font-semibold">
          ← {page.backLinkLabel}
        </Link>

        <header className="mt-8 md:mt-10">
          {profile.logoUrl && (
            <ProfileLogo src={profile.logoUrl} name={profile.name} className="mb-6 h-16 w-60" eager />
          )}
          <Eyebrow>{page.heading}</Eyebrow>
          <h1 className="mt-3 font-serif text-[38px] leading-[1.1] font-bold text-navy md:text-5xl">{profile.name}</h1>
          {profile.tagline.trim() ? (
            <p className="mt-4 font-serif text-xl leading-snug font-bold text-gold-text md:text-[26px]">
              {profile.tagline}
            </p>
          ) : (
            <NotFilledIn field="tagline" className={cn("mt-4", notFilledInClass)} />
          )}
        </header>

        <p className="mt-7 rounded-xl bg-parchment px-5 py-4 text-[15px] text-parchment-text md:px-6 md:text-base">
          {page.note}
        </p>

        <div className={cn(proseClass, "mt-8 md:mt-10")}>
          <Text field="intro" text={profile.intro} />
        </div>

        <Section
          id="worth-exploring"
          title={sections.worthExploring}
          field="worthExploring"
          text={profile.worthExploring}
        />
        <Section id="people-to-know" title={sections.peopleToKnow} field="peopleToKnow" text={profile.peopleToKnow} />

        <section
          aria-labelledby="getting-started"
          className="mt-12 rounded-[18px] bg-navy px-6 py-7 text-white md:mt-16 md:px-9 md:py-9"
        >
          <h2 id="getting-started" className="font-serif text-2xl text-gold-light md:text-[28px]">
            {sections.gettingStarted}
          </h2>
          <div className={cn(onNavyClass, "mt-4")}>
            {profile.gettingStarted.trim() ? (
              <RichTextBlocks
                blocks={toBlocks(profile.gettingStarted)}
                headingClassName="font-serif text-xl font-bold text-white"
                quoteClassName="border-l-4 border-gold py-1 pl-5 font-serif text-lg font-bold text-white"
              />
            ) : (
              <NotFilledIn field="gettingStarted" className={notFilledInOnNavyClass} />
            )}
          </div>
          {profile.websiteUrl ? (
            <ButtonLink
              href={profile.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="gold"
              className="mt-6 max-w-full break-all"
            >
              Visit {displayHost(profile.websiteUrl)}
              <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </ButtonLink>
          ) : (
            <NotFilledIn field="websiteUrl" className={cn("mt-6", notFilledInOnNavyClass)} />
          )}
          <Contact contact={profile.contact} title={sections.contact} />
        </section>

        <UsefulLinks links={profile.links} title={sections.links} />

        <Link href={PROFILES_PATH} className="mt-10 w-fit text-[15px] font-semibold md:mt-12">
          ← {page.backLinkLabel}
        </Link>
      </article>
    </Container>
  );
}
