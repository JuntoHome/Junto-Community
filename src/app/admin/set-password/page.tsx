import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/admin-auth/auth-card";
import { type PasswordLinkType, PASSWORD_LINK_TYPES } from "@/features/admin-auth/schema";
import { SetPasswordForm } from "@/features/admin-auth/set-password-form";
import { getAdmin } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Choose a password",
  // The URL holds the email link's one-time code; never send it to another site.
  referrer: "no-referrer",
};

type Props = { searchParams: Promise<{ token_hash?: string | string[]; type?: string | string[] }> };

/**
 * Where invite and password-reset emails lead (link: /admin/set-password?token_hash=...&type=invite|recovery).
 * Opening the page uses nothing up; the code is checked when the form is submitted.
 * Without a code, it is "change password" for a logged-in admin.
 */
export default async function SetPasswordPage({ searchParams }: Props) {
  const params = await searchParams;
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : undefined;
  const type = PASSWORD_LINK_TYPES.find((t): t is PasswordLinkType => t === params.type);
  const fromEmail = Boolean(tokenHash && type);

  if (!fromEmail && !(await getAdmin())) redirect("/admin/forgot-password");

  const [title, intro] =
    type === "invite" && fromEmail
      ? ["Welcome", "Choose a password for your Junto Community Alliance admin account."]
      : fromEmail
        ? ["Choose a new password", "Choose a new password for your admin account."]
        : ["Change your password", "Choose a new password for your admin account."];

  return (
    <AuthCard title={title} intro={intro}>
      <SetPasswordForm tokenHash={fromEmail ? tokenHash : undefined} type={fromEmail ? type : undefined} />
    </AuthCard>
  );
}
