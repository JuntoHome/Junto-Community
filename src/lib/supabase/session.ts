import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicConfig } from "./config";

/**
 * Keeps the admin login fresh. Runs from proxy.ts on /admin requests: Server
 * Components can't write cookies, so an expired token is renewed here, before the
 * page renders. This is not the access check; every admin page and action checks
 * the user itself.
 */
export async function refreshSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const config = getSupabasePublicConfig();
  if (!config) return response;

  const supabase = createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        // No-cache headers, so a CDN never serves one person's session cookie to another.
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Validates the token and refreshes it if it has expired. Must finish before the response is returned.
  await supabase.auth.getClaims();
  return response;
}
