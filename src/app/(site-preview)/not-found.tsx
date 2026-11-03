import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container, Eyebrow } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Profile not found" };

// A preview of a profile that doesn't exist or was deleted. Only admins get this far.
export default function PreviewNotFound() {
  return (
    <Container className="flex flex-col items-start gap-5 py-20 md:py-32">
      <Eyebrow>Preview</Eyebrow>
      <h1 className="font-serif text-4xl leading-tight font-bold text-navy md:text-6xl">
        We couldn&apos;t find that profile.
      </h1>
      <p className="max-w-150 text-lg leading-relaxed text-slate">
        It may have been deleted, or the link is old or mistyped.
      </p>
      <ButtonLink href="/admin/profiles" size="lg">
        All profiles
      </ButtonLink>
    </Container>
  );
}
