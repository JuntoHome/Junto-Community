"use client";

import { useEffect } from "react";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { Container } from "@/components/ui/primitives";

// Shown inside the admin layout when an admin page fails to load, e.g. Supabase can't be reached.
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Something went wrong.</h1>
      <p className="mt-3 max-w-180 text-base text-slate md:text-[17px]">
        This page couldn&apos;t load. Please try again in a moment. Nothing you saved earlier is lost.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={buttonClasses("navy", "sm", "cursor-pointer")}>
          Try again
        </button>
        <ButtonLink href="/admin" variant="outline" size="sm">
          Admin home
        </ButtonLink>
      </div>
    </Container>
  );
}
