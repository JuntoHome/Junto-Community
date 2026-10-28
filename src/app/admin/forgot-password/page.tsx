import type { Metadata } from "next";
import { AuthCard } from "@/features/admin-auth/auth-card";
import { ForgotPasswordForm } from "@/features/admin-auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      intro="Enter your admin email and we'll send you a link to choose a new password."
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
