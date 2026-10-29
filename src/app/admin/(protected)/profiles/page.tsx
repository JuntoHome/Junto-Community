import type { Metadata } from "next";
import { Container } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Profiles" };

// Placeholder until the profiles list (CMS-16).
export default async function ProfilesPage() {
  await requireAdmin();

  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Profiles</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">
        This is where you&apos;ll add, edit, publish and hide profiles. It&apos;s being built now.
      </p>
    </Container>
  );
}
