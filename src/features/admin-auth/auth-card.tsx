import type { ReactNode } from "react";
import { Container } from "@/components/ui/primitives";

/** The centered white card around the login, forgot-password and set-password forms. */
export function AuthCard({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <Container className="py-12 md:py-20">
      <div className="mx-auto w-full max-w-md rounded-[18px] border border-sand bg-white px-6 py-8 md:px-10 md:py-10">
        <h1 className="font-serif text-3xl leading-tight font-bold text-navy">{title}</h1>
        <p className="mt-2 text-base text-slate">{intro}</p>
        <div className="mt-7">{children}</div>
      </div>
    </Container>
  );
}
