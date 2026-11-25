/**
 * Capability: limits that keep an AI call safe.
 * Input: a promise and a time limit.
 * Output: the promise's value, or the fallback when it takes too long.
 * Privacy: handles no content.
 * This module is pure (no React, no I/O).
 */

/** How long one AI call may take, in milliseconds. The OpenAI client uses the same limit. */
export const AI_TIMEOUT_MS = 20_000;

/**
 * `promise`'s value, or `onTimeout()` after `ms` milliseconds, whichever comes first. Holds
 * even if the SDK ignores its own timeout. A rejection is passed on; the timer is always cleared.
 */
export function withTimeout<T, F>(promise: Promise<T>, ms: number, onTimeout: () => F): Promise<T | F> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<F>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout()), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
