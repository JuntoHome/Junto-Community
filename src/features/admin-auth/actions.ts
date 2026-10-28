"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { type LoginState, loginSchema } from "./schema";

const WRONG_CREDENTIALS = "That email and password don't match. Please try again.";
const UNAVAILABLE = "Login isn't working right now. Please try again in a few minutes.";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse({ email, password: String(formData.get("password") ?? "") });
  if (!parsed.success) return { error: "Please enter your email and password.", email };

  if (isRateLimited(`login:${getClientIp(await headers())}`)) {
    return { error: "Too many attempts. Please wait a few minutes and try again.", email };
  }

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
    return { error: "This account doesn't have admin access.", email };
  }

  redirect("/admin");
}
