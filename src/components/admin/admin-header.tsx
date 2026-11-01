import Link from "next/link";
import { Container } from "@/components/ui/primitives";
import { AdminBrand } from "./admin-brand";

/** For logged-out pages (login, forgot password): just the brand and a way back to the site. */
export function AdminHeader() {
  return (
    <header className="border-b border-sand bg-white">
      <Container className="flex min-h-16 items-center justify-between gap-4">
        <AdminBrand />
        <Link href="/" className="text-[15px] font-semibold">
          View site
        </Link>
      </Container>
    </header>
  );
}
