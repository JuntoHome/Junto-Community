/**
 * Supabase URL and publishable key. Both are safe to expose: the publishable key
 * only gets what row level security allows. Null when either is not set.
 */
export function getSupabasePublicConfig(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
