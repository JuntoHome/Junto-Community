import { Container } from "@/components/ui/primitives";
import { getAdmin } from "@/lib/auth";

// Placeholder until the admin home (CMS-07). Access checks on every admin page come in CMS-04.
export default async function AdminHomePage() {
  const admin = await getAdmin();

  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Admin</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">
        {admin ? `Logged in as ${admin.email}.` : "Not logged in."} Profiles will be managed here.
      </p>
    </Container>
  );
}
