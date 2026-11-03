import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md / CLAUDE.md on `next dev`.
  agentRules: false,
  // Keep `next dev`'s badge off the admin sidebar's buttons in the bottom-left corner.
  devIndicators: { position: "bottom-right" },
  env: {
    // When this version of the site was built: the sitemap's "last modified" for pages that only change on deploy.
    BUILT_AT: new Date().toISOString(),
  },
  experimental: {
    // The profile form sends its logo with the text: up to 2 MB, plus the text and the form's own overhead.
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Profile logos are uploaded in /admin and served from Supabase Storage.
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/profile-logos/**`)] : [],
  },
};

export default nextConfig;
