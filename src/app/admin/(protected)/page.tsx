import { Container } from "@/components/ui/primitives";
import { requireAdmin } from "@/lib/auth";

// Placeholder until the admin home (CMS-07).
export default async function AdminHomePage() {
  const admin = await requireAdmin();

  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Admin</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">
        Logged in as {admin.email}. Profiles will be managed here.
      </p>
    </Container>
  );
}
