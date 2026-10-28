import { Container } from "@/components/ui/primitives";

// Placeholder until the admin home (CMS-07). Login (CMS-03) and access checks (CMS-04) come first.
export default function AdminHomePage() {
  return (
    <Container className="py-10 md:py-14">
      <h1 className="font-serif text-3xl leading-tight font-bold text-navy md:text-4xl">Admin</h1>
      <p className="mt-3 text-base text-slate md:text-[17px]">Profiles will be managed here.</p>
    </Container>
  );
}
