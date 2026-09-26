import { type NextRequest, NextResponse } from "next/server";

/** Flyer URLs that must keep working in any casing, mapped to their canonical path. */
const CANONICAL_PATHS = ["/BI101"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const canonical = CANONICAL_PATHS.find((path) => path.toLowerCase() === pathname.toLowerCase());
  if (canonical && canonical !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = canonical;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Only run on single-segment paths that look like "bi101" in any casing.
  matcher: "/:path([bB][iI]101)",
};
