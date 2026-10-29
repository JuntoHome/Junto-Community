import { type NextRequest, NextResponse } from "next/server";
import { refreshSession } from "@/lib/supabase/session";

/** Flyer URLs that must keep working in any casing, mapped to their canonical path. */
const CANONICAL_PATHS = ["/BI101"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) return refreshSession(request);

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
    // The admin area, to keep the login session fresh. Public pages never touch auth.
    "/admin/:path*",
  ],
};
