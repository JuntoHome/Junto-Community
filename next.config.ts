import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  // Don't generate AGENTS.md / CLAUDE.md on `next dev`.
  agentRules: false,
  images: {
    // Profile logos are uploaded in /admin and served from Supabase Storage.
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/profile-logos/**`)] : [],
  },
};

export default nextConfig;
