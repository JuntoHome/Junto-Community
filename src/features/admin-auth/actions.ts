"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  type ForgotPasswordState,
  forgotPasswordSchema,
  type LoginState,
  loginSchema,
  type SetPasswordState,
  setPasswordSchema,
} from "./schema";

const WRONG_CREDENTIALS = "That email and password don't match. Please try again.";
const UNAVAILABLE = "Login isn't working right now. Please try again in a few minutes.";
const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const NO_ACCESS = "This account doesn't have admin access.";

async function tooManyAttempts(action: string) {
  return isRateLimited(`${action}:${getClientIp(await headers())}`);
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "Please enter your email and password.", email };

  if (await tooManyAttempts("login")) return { error: TOO_MANY, email };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "invalid_credentials") return { error: WRONG_CREDENTIALS, email };
    console.error("[login] sign-in failed", error);
    return { error: UNAVAILABLE, email };
  }

  // The password was right, but only people on the admins list get in.
  const { data: admin, error: adminError } = await supabase
    .from("admins")
    .select("user_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!admin) {
    await supabase.auth.signOut({ scope: "local" });
    if (adminError) {
      console.error("[login] admin check failed", adminError);
      return { error: UNAVAILABLE, email };
    }
    return { error: NO_ACCESS, email };
  }

  redirect("/admin");
}

/**
 * Ends the session on this device and returns to login. Deleting the auth cookies
 * in a Server Action also clears Next's client-side page cache, so Back can't show
 * an admin page again.
 */
export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/admin/login");
}

/**
 * Emails a link to choose a new password, but only to admins. The reply is the
 * same either way, so the form can't be used to find out who is an admin.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "");
  const parsed = forgotPasswordSchema.safeParse({ email });
  if (!parsed.success) return { error: "Please enter a valid email address.", email };

  if (await tooManyAttempts("reset")) return { error: TOO_MANY, email };

  try {
    // Service-role client: visitors can't read the admins table, and its reset
    // emails carry a plain one-time code that works on any device.
    const db = getSupabaseAdmin();
    const { data: admin } = await db.from("admins").select("user_id").eq("email", parsed.data.email).maybeSingle();
    if (admin) {
      const { error } = await db.auth.resetPasswordForEmail(parsed.data.email);
      if (error) console.error("[reset] email failed", error);
    }
  } catch (error) {
    console.error("[reset]", error);
  }
  return { sent: true };
}

/**
 * Saves a new password. From an invite or reset email, the link's one-time code
 * logs the person in first; it is only used here, on submit, never when the page
 * opens, so email scanners that open links can't use it up. A logged-in admin
 * can also change their password without a code.
 */
export async function setPassword(_prev: SetPasswordState, formData: FormData): Promise<SetPasswordState> {
  const parsed = setPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
    tokenHash: formData.get("tokenHash") ? String(formData.get("tokenHash")) : undefined,
    type: formData.get("type") ? String(formData.get("type")) : undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your password." };

  if (await tooManyAttempts("set-password")) return { error: TOO_MANY };

  const { password, tokenHash, type } = parsed.data;
  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error || !data.user) {
      return { error: "This link has expired or was already used.", expired: true };
    }
    const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
    if (!admin) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: NO_ACCESS, expired: true };
    }
  } else if (!(await getAdmin())) {
    redirect("/admin/login");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // The code (if any) is used up and the person is now logged in, so a retry
    // goes through the session instead.
    if (error.code === "same_password") return { error: "Choose a password different from your old one.", codeUsed: true };
    if (error.code === "weak_password") return { error: error.message, codeUsed: true };
    console.error("[set-password] update failed", error);
    return { error: "The password couldn't be saved. Please try again.", codeUsed: true };
  }

  redirect("/admin");
}
