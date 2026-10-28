import { Analytics } from "@vercel/analytics/next";
import type { ReactNode } from "react";
import { AnnouncementBar } from "./announcement-bar";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * Header, footer and analytics around every public page. Used by the (site)
 * layout and the 404 page; the admin area has its own layout without them.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <AnnouncementBar />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <Analytics />
    </>
  );
}
