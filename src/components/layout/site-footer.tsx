import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { getSiteSettings } from "@/lib/content";

export async function SiteFooter() {
  const site = await getSiteSettings();

  return (
    <footer className="border-t border-sand bg-white text-[15px] text-muted">
      <Container className="flex flex-col gap-6 py-9 md:py-12 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2">
          <p className="font-serif text-[21px] font-bold text-navy md:text-[22px]">{site.name}</p>
          <p>{site.tagline}</p>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-center md:gap-7">
          <nav aria-label="Footer" className="flex gap-5 md:gap-7">
            {site.footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-navy underline underline-offset-2 hover:text-green">
                {link.label}
              </Link>
            ))}
          </nav>
          <a href={`mailto:${site.questionsEmail}`} className="text-navy underline underline-offset-2 hover:text-green">
            {site.questionsEmail}
          </a>
          <p className="text-sm md:text-[15px]">{site.copyright}</p>
        </div>
      </Container>
    </footer>
  );
}
