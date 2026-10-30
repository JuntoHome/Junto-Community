import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/primitives";
import { getProfileForAdmin } from "@/features/profiles/admin-queries";
import { requireAdmin } from "@/lib/auth";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await requireAdmin();
  const profile = await getProfileForAdmin((await params).id);
  return { title: profile ? `Edit ${profile.name}` : "Profile not found" };
}

// Placeholder until the edit form (CMS-18).
export default async function EditProfilePage({ params }: Props) {
  await requireAdmin();
  const profile = await getProfileForAdmin((await params).id);
  if (!profile) notFound();

  return (
    <Container className="py-10 md:py-14">
      <Link href="/admin/profiles" className="text-[15px] font-semibold">
        ← All profiles
      </Link>
      <h1 className="mt-6 font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">{profile.name}</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">Editing profiles is being built now.</p>
    </Container>
  );
}
