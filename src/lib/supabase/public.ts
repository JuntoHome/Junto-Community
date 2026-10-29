import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "./config";

let client: SupabaseClient | null = null;

/**
 * Supabase client that reads as an anonymous visitor: no login, no cookies. Row level
 * security only returns what the public may see (e.g. published profiles), so it is
 * safe for public pages, which are cached and shared by everyone. Null when not configured.
 */
export function getSupabasePublic(): SupabaseClient | null {
  if (client) return client;

  const config = getSupabasePublicConfig();
  if (!config) return null;

  client = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
