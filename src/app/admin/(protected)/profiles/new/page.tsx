import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Add a profile" };

// Placeholder until the profile form (CMS-17).
export default async function NewProfilePage() {
  await requireAdmin();

  return (
    <Container className="py-10 md:py-14">
      <Link href="/admin/profiles" className="text-[15px] font-semibold">
        ← All profiles
      </Link>
      <h1 className="mt-6 font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Add a profile</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">
        The form for adding a profile is being built now.
      </p>
    </Container>
  );
}
