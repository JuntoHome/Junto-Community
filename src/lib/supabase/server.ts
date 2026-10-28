import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicConfig } from "./config";

/**
 * Supabase client that acts as the logged-in admin (read from the auth cookies),
 * so row level security applies. Use it for everything in the admin area. The
 * service-role client in ./admin.ts bypasses those rules and is only for the
 * subscribe form and the keep-alive cron. Create one per request.
 */
export async function createSupabaseServerClient() {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't write cookies. proxy.ts refreshes the session
          // before the page renders, so it is safe to skip here.
        }
      },
    },
  });
}
