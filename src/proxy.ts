import { type NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/session";

/** Flyer URLs that must keep working in any casing, mapped to their canonical path. */
const CANONICAL_PATHS = ["/BI101"];

/** The Translator's AI route (admins only), so a logged-in admin's expired token is renewed before it runs. */
const TRANSLATOR_AI_PATH = "/api/translator/ai";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Admin-only paths: keep the login session fresh, and skip the redirects below.
  if (pathname.startsWith("/admin") || pathname.startsWith("/preview/") || pathname === TRANSLATOR_AI_PATH) {
    return refreshSession(request);
  }

  const canonical = pathname.startsWith("/who-can-help/")
    ? pathname.toLowerCase()
    : CANONICAL_PATHS.find((path) => path.toLowerCase() === pathname.toLowerCase());
  if (canonical && canonical !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = canonical;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Single-segment paths that look like "bi101" in any casing.
    "/:path([bB][iI]101)",
    // Profile addresses with a capital letter, sent to the lowercase address (features/profiles PROFILES_PATH).
    "/who-can-help/:slug(.*[A-Z].*)",
    // The admin area and its previews, to keep the login session fresh. Public pages never touch auth.
    "/admin/:path*",
    "/preview/:path*",
    // The Translator's AI route checks the admin itself (getAdmin), so it needs the same fresh session.
    "/api/translator/ai",
  ],
};
