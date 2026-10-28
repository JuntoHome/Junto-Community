import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Admin = { userId: string; email: string };

/**
 * The logged-in admin for this request, or null when logged out or not on the
 * admins list. Row level security only shows the admins table to admins, so
 * finding your own row there is the admin check.
 */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const supabase = await createSupabaseServerClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data } = await supabase.from("admins").select("user_id, email").eq("user_id", userId).maybeSingle();
  return data ? { userId: data.user_id, email: data.email } : null;
});

/**
 * The logged-in admin, or a redirect to the login page (logged out, or logged in
 * but not on the admins list). Call it first in every admin page and every admin
 * Server Action. Layouts don't re-run on every navigation and proxy.ts only
 * refreshes the session, so neither of those is the access check.
 */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
