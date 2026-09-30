import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { RichText } from "@/components/ui/rich-text";
import { SubscribeForm } from "@/features/subscribe/subscribe-form";
import type { HomePage } from "@/lib/content/types";

/** Full-width navy "Join the Junto" band with the subscribe form. Anchor target for `/#join`. */
export function JoinSection({ content }: { content: HomePage["join"] }) {
  return (
    <section id="join" aria-labelledby="join-title" className="scroll-mt-4 bg-navy text-white">
      <Container className="grid gap-10 py-14 md:py-20 lg:grid-cols-12 lg:gap-8 lg:py-24">
        <div className="flex flex-col gap-6 lg:col-span-5 lg:gap-8">
          <h2
            id="join-title"
            className="max-w-[12ch] font-serif text-[40px] leading-[1.08] font-normal tracking-[-0.01em] text-gold-light md:text-[52px] lg:text-[64px] lg:leading-[1.04]"
          >
            {content.heading}
          </h2>
          <p className="max-w-[46ch] text-[17px] leading-relaxed text-mist md:text-xl md:leading-relaxed">
            <RichText value={content.body} />
          </p>
          <Link
            href={content.storyLink.href}
            className="w-fit text-[17px] font-semibold text-white underline underline-offset-4 hover:text-gold-light md:text-lg"
          >
            {content.storyLink.label}
          </Link>
        </div>

        <SubscribeForm
          submitLabel={content.submitLabel}
          note={content.formNote}
          className="lg:col-span-6 lg:col-start-7 lg:self-center"
        />
      </Container>
    </section>
  );
}
