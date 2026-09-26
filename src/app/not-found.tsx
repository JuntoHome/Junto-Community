import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <Container className="flex flex-col items-start gap-5 py-20 md:py-32">
      <Eyebrow>Page not found</Eyebrow>
      <h1 className="font-serif text-4xl leading-tight font-bold text-navy md:text-6xl">
        We couldn&apos;t find that page.
      </h1>
      <p className="max-w-150 text-lg leading-relaxed text-slate">
        The link may be old or mistyped. Here are a couple of places to start.
      </p>
      <div className="flex flex-wrap gap-4 pt-2">
        <ButtonLink href="/BI101" size="lg">
          Business Insights 101
        </ButtonLink>
        <ButtonLink href="/" variant="outline" size="lg">
          Go to the homepage
        </ButtonLink>
      </div>
    </Container>
  );
}
