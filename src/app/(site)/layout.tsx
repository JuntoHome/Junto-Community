import { SiteShell } from "@/components/layout/site-shell";

/** Public pages. The group name is not part of the URL, so /BI101 stays /BI101. */
export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SiteShell>{children}</SiteShell>;
}
