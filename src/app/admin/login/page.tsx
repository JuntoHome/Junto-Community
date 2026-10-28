import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/primitives";
import { LoginForm } from "@/features/admin-auth/login-form";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <Container className="py-12 md:py-20">
      <div className="mx-auto w-full max-w-md rounded-[18px] border border-sand bg-white px-6 py-8 md:px-10 md:py-10">
        <h1 className="font-serif text-3xl leading-tight font-bold text-navy">Log in</h1>
        <p className="mt-2 text-base text-slate">For Junto Community Alliance admins.</p>
        <LoginForm className="mt-7" />
      </div>
    </Container>
  );
}
