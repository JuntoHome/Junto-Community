import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { getSiteSettings } from "@/lib/content";
import "./globals.css";

// Variable font: one file per style covers every weight.
const fraunces = Fraunces({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-public-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    metadataBase: new URL(site.url),
    title: { default: site.name, template: `%s · ${site.name}` },
    description: site.tagline,
    applicationName: site.name,
    openGraph: { type: "website", siteName: site.name, locale: "en_US" },
    twitter: { card: "summary_large_image" },
    // Google Search Console "HTML tag" verification. Only needed if the site is not verified by DNS.
    verification: process.env.GOOGLE_SITE_VERIFICATION
      ? { google: process.env.GOOGLE_SITE_VERIFICATION }
      : undefined,
  };
}

export const viewport: Viewport = {
  themeColor: "#0E2F56",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${publicSans.variable}`}>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-navy px-4 py-3 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:text-white"
        >
          Skip to content
        </a>
        {/* Public pages get the site header and footer from (site)/layout.tsx; /admin has its own layout. */}
        {children}
      </body>
    </html>
  );
}
