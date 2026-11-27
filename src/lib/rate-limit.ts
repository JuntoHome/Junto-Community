import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hits = new Map<string, number[]>();

/**
 * Best-effort, per-instance rate limit. Serverless instances do not share
 * memory, so this only slows down simple abuse. Swap for a shared store
 * (e.g. Upstash, Vercel KV) if the form starts getting spammed.
 * `maxAttempts` per 10 minutes per key: 5 by default (login, reset, subscribe); the
 * Translator AI route allows 30 per admin.
 *
 * By default a refused attempt counts too, so someone who keeps trying stays locked out (login,
 * reset, subscribe). With `countRefused: false` only attempts that went through count, so the
 * limit lifts as the window moves on, as "wait a few minutes" promises (the Translator AI route,
 * where a refused request costs nothing).
 */
export function isRateLimited(
  key: string,
  maxAttempts = MAX_ATTEMPTS,
  now = Date.now(),
  { countRefused = true }: { countRefused?: boolean } = {},
) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (!countRefused && recent.length >= maxAttempts) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return recent.length > maxAttempts;
}

/** The visitor's IP from Vercel's forwarding headers, used as the rate-limit key. */
export function getClientIp(h: { get(name: string): string | null }) {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
