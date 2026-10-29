import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md / CLAUDE.md on `next dev`.
  agentRules: false,
  env: {
    // When this version of the site was built: the sitemap's "last modified" for pages that only change on deploy.
    BUILT_AT: new Date().toISOString(),
  },
  images: {
    // Profile logos are uploaded in /admin and served from Supabase Storage.
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/profile-logos/**`)] : [],
  },
};

export default nextConfig;
