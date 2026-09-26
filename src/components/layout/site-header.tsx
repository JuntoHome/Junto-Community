import Image from "next/image";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";
import { getEvent, getSiteSettings } from "@/lib/content";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";

export async function SiteHeader() {
  const site = await getSiteSettings();
  const featured = await getEvent(site.featuredEventSlug);
  const cta = featured ? { label: site.headerCtaLabel, href: featured.registration.url } : null;

  return (
    <header className="relative z-20 border-b border-sand bg-white">
      <Container className="flex h-18 items-center justify-between md:h-24">
        <Link href="/" className="flex items-center" aria-label={`${site.name}, home`}>
          <Image
            src={site.logos.wide.src}
            alt={site.logos.wide.alt}
            width={site.logos.wide.width}
            height={site.logos.wide.height}
            priority
            sizes="128px"
            className="h-12 w-auto md:h-16"
          />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-9 text-base font-medium lg:flex">
          <NavLinks links={site.nav} />
          {cta && (
            <ButtonLink href={cta.href} size="sm">
              {cta.label}
            </ButtonLink>
          )}
        </nav>

        <MobileMenu links={site.nav} cta={cta} />
      </Container>
    </header>
  );
}
