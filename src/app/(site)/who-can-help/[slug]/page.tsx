import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";
import { RichTextBlocks } from "@/components/ui/rich-text";
import { ProfileLogo } from "@/features/profiles/profile-logo";
import { getPublishedProfile, listPublishedProfiles, PROFILES_PATH } from "@/features/profiles/queries";
import { toBlocks } from "@/features/profiles/text";
import type { Profile } from "@/features/profiles/types";
import { getPage, getSiteSettings } from "@/lib/content";
import { cn } from "@/lib/cn";
import { pageMetadata } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }> };

// Published profiles are built ahead of time and refreshed every 30 seconds, so changes show
// within a minute (see features/profiles/queries.ts). A profile published later is built on its first visit.
export const revalidate = 30;

export async function generateStaticParams() {
  try {
    const profiles = await listPublishedProfiles();
    return profiles.map((profile) => ({ slug: profile.slug }));
  } catch (error) {
    // Don't fail the deploy if Supabase is unreachable; the pages are then built on first visit.
    console.error(error);
    return [];
  }
}

/** Addresses are lowercase words joined by hyphens; anything else can't be a profile. */
async function findProfile(params: Props["params"]) {
  const { slug } = await params;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ? getPublishedProfile(slug) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [profile, page, site] = await Promise.all([findProfile(params), getPage("whoCanHelp"), getSiteSettings()]);
  if (!profile) return {};
  const seo = { title: `${profile.name} | ${page.heading} | ${site.name}`, description: profile.tagline };
  return pageMetadata(seo, `${PROFILES_PATH}/${profile.slug}`, site);
}

const headingClass = "font-serif text-[28px] leading-tight font-bold text-navy md:text-4xl";
const proseClass = "flex flex-col gap-5 text-base leading-[1.7] text-slate md:text-[19px]";

function Section({ id, title, text }: { id: string; title: string; text: string }) {
  return (
    <section aria-labelledby={id} className="mt-10 border-t border-sand pt-10 md:mt-14 md:pt-14">
      <h2 id={id} className={headingClass}>
        {title}
      </h2>
      <div className={cn(proseClass, "mt-5 md:mt-6")}>
        <RichTextBlocks blocks={toBlocks(text)} />
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
          <a href={`mailto:${contact.email}`} className="w-fit text-white underline underline-offset-2 hover:text-gold-light">
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

export default async function ProfilePage({ params }: Props) {
  const [profile, page] = await Promise.all([findProfile(params), getPage("whoCanHelp")]);
  if (!profile) notFound();
  const { sections } = page;

  return (
    <Container className="py-10 md:py-16 lg:py-20">
      <article className="mx-auto flex max-w-180 flex-col">
        <Link href={PROFILES_PATH} className="w-fit text-[15px] font-semibold">
          ← {page.backLinkLabel}
        </Link>

        <header className="mt-8 md:mt-10">
          {profile.logoUrl && <ProfileLogo src={profile.logoUrl} name={profile.name} className="mb-6 h-16 w-60" eager />}
          <Eyebrow>{page.heading}</Eyebrow>
          <h1 className="mt-3 font-serif text-[38px] leading-[1.1] font-bold text-navy md:text-5xl">{profile.name}</h1>
          <p className="mt-4 font-serif text-xl leading-snug font-bold text-gold-text md:text-[26px]">{profile.tagline}</p>
        </header>

        <p className="mt-7 rounded-xl bg-parchment px-5 py-4 text-[15px] text-parchment-text md:px-6 md:text-base">
          {page.note}
        </p>

        <div className={cn(proseClass, "mt-8 md:mt-10")}>
          <RichTextBlocks blocks={toBlocks(profile.intro)} />
        </div>

        <Section id="how-they-help" title={sections.howTheyHelp} text={profile.howTheyHelp} />
        <Section id="who-should-explore" title={sections.whoShouldExplore} text={profile.whoShouldExplore} />
        {profile.history && <Section id="history" title={sections.history} text={profile.history} />}

        <section
          aria-labelledby="where-to-begin"
          className="mt-12 rounded-[18px] bg-navy px-6 py-7 text-white md:mt-16 md:px-9 md:py-9"
        >
          <h2 id="where-to-begin" className="font-serif text-2xl text-gold-light md:text-[28px]">
            {sections.whereToBegin}
          </h2>
          <ButtonLink
            href={profile.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant="gold"
            className="mt-5 max-w-full break-all"
          >
            Visit {displayHost(profile.websiteUrl)}
            <span aria-hidden="true">↗</span>
            <span className="sr-only">(opens in a new tab)</span>
          </ButtonLink>
          <Contact contact={profile.contact} title={sections.contact} />
        </section>

        <Link href={PROFILES_PATH} className="mt-10 w-fit text-[15px] font-semibold md:mt-12">
          ← {page.backLinkLabel}
        </Link>
      </article>
    </Container>
  );
}
