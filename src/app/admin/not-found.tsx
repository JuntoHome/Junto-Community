import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Not found" };

// Shown inside the admin layout when an admin page calls notFound(), e.g. a deleted profile.
export default function AdminNotFound() {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">
        We couldn&apos;t find that.
      </h1>
      <p className="mt-3 max-w-180 text-base text-slate md:text-[17px]">
        It may have been deleted, or the link is old or mistyped.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink href="/admin/profiles" size="sm">
          All profiles
        </ButtonLink>
        <ButtonLink href="/admin" variant="outline" size="sm">
          Admin home
        </ButtonLink>
      </div>
    </Container>
  );
}
