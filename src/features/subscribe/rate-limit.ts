import "server-only";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

const hits = new Map<string, number[]>();

/**
 * Best-effort, per-instance rate limit. Serverless instances do not share
 * memory, so this only slows down simple abuse. Swap for a shared store
 * (e.g. Upstash, Vercel KV) if the form starts getting spammed.
 */
export function isRateLimited(key: string, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);

  if (hits.size > 5000) {
    for (const [k, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }

  return recent.length > MAX_ATTEMPTS;
}
