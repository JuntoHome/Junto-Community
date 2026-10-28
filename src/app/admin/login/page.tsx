import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/admin-auth/auth-card";
import { LoginForm } from "@/features/admin-auth/login-form";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Log in",
};

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <AuthCard title="Log in" intro="For Junto Community Alliance admins.">
      <LoginForm />
    </AuthCard>
  );
}
