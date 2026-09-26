import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { RichText } from "@/components/ui/rich-text";
import { SubscribeForm } from "@/features/subscribe/subscribe-form";
import type { HomePage } from "@/lib/content/types";

/** Navy "Join the Junto" band with the subscribe form. Anchor target for `/#join`. */
export function JoinSection({ content }: { content: HomePage["join"] }) {
  return (
    <section id="join" aria-labelledby="join-title" className="scroll-mt-4 pb-10 md:pb-24">
      <Container>
        <div className="grid gap-6 rounded-[18px] bg-navy px-5 py-8 text-white md:rounded-[20px] md:p-12 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-16">
          <div className="flex flex-col gap-5 lg:col-span-6 lg:gap-[22px]">
            <p className="text-[17px] leading-relaxed text-mist md:text-xl">
              <RichText value={content.body} />
            </p>
            <h2
              id="join-title"
              className="font-serif text-[34px] leading-[1.1] font-bold text-gold-light md:text-5xl lg:text-[52px] lg:leading-[1.08]"
            >
              {content.heading}
            </h2>
            <Link
              href={content.storyLink.href}
              className="hidden text-[17px] font-semibold text-white underline hover:text-gold-light lg:block"
            >
              {content.storyLink.label}
            </Link>
          </div>
          <SubscribeForm submitLabel={content.submitLabel} className="lg:col-span-5 lg:col-start-8" />
          <Link
            href={content.storyLink.href}
            className="text-base font-semibold text-white underline hover:text-gold-light lg:hidden"
          >
            {content.storyLink.label}
          </Link>
        </div>
      </Container>
    </section>
  );
}
