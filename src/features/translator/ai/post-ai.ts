/**
 * Capability: send one request to `/api/translator/ai` and say what happened (TR-50), so the chat
 * and the intro panel can react the same way to every outcome. The hooks call `postAi()`; tests
 * pass a fake `fetchFn`.
 * Input: a `fetch`-like function, the request body (built by `buildChatRequest()` or
 * `buildIntroRequest()`), and the request's AbortSignal.
 * Output: a `PostAiResult`: the reply's JSON, or the kind of failure and the route's own `error`
 * text when it sent one.
 * Privacy: sends the body as it is given and nothing else. Never stores or logs anything.
 * This module is pure (no React; the network only through the `fetchFn` it is given).
 */

/** The route. The only place the browser sends anything for the AI. */
export const AI_ROUTE = "/api/translator/ai";

/**
 * Why a request didn't give a usable reply.
 * - `ai-failure`: the AI couldn't answer (`502`, `504`, or `200` with `ok: false`).
 * - `network`: no response, or one that isn't JSON.
 * - `session-expired` (`401`), `unavailable` (`503`), `too-long` (`413`), `rate-limited` (`429`),
 *   `bad-request` (`400`, `403`, or any other status).
 */
export type AiFailureKind =
  | "ai-failure"
  | "network"
  | "session-expired"
  | "unavailable"
  | "too-long"
  | "rate-limited"
  | "bad-request";

export type PostAiResult =
  | { kind: "ok"; json: unknown }
  | { kind: AiFailureKind; error: string | null }
  /** We aborted it (Start over chat, the panel closed, the page left). Ignored. */
  | { kind: "aborted" };

/** True for the failures that mean the AI itself didn't respond. Only these count toward "two in a row". */
export const countsAsAiFailure = (kind: AiFailureKind): boolean => kind === "ai-failure" || kind === "network";

/** The kind for a status that isn't 2xx. */
function kindForStatus(status: number): AiFailureKind {
  if (status === 401) return "session-expired";
  if (status === 503) return "unavailable";
  if (status === 413) return "too-long";
  if (status === 429) return "rate-limited";
  if (status === 502 || status === 504 || status >= 500) return "ai-failure";
  return "bad-request";
}

/** The route's `error` text, when the body has one. */
function errorText(json: unknown): string | null {
  if (typeof json !== "object" || json === null || !("error" in json)) return null;
  const { error } = json as { error: unknown };
  return typeof error === "string" && error.trim() !== "" ? error.trim() : null;
}

/** What `postAi()` needs from `fetch`. */
export type FetchFn = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Posts `body` as JSON to the route and classifies the outcome (README "When the AI fails"):
 * `200` with `ok: true` is `ok`; `200` with `ok: false`, `502` and `504` are `ai-failure`; a
 * rejected `fetch` or a body that isn't JSON is `network`; `401`, `503`, `413`, `429` and
 * `400`/`403` have their own kinds; anything after our own abort is `aborted`.
 */
export async function postAi(fetchFn: FetchFn, body: unknown, signal: AbortSignal): Promise<PostAiResult> {
  let status: number;
  let text: string;
  try {
    const response = await fetchFn(AI_ROUTE, {
      method: "POST",
      // The route reads JSON only and refuses anything else with a 400.
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    status = response.status;
    text = await response.text();
  } catch {
    return signal.aborted ? { kind: "aborted" } : { kind: "network", error: null };
  }
  if (signal.aborted) return { kind: "aborted" };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: "network", error: null };
  }

  if (status >= 200 && status < 300) {
    const ok = typeof json === "object" && json !== null && (json as { ok?: unknown }).ok === true;
    return ok ? { kind: "ok", json } : { kind: "ai-failure", error: errorText(json) };
  }
  return { kind: kindForStatus(status), error: errorText(json) };
}

/** How long a simulated failure takes, in milliseconds (TR-50 test mode). */
export const SIMULATED_FAILURE_MS = 1500;

/**
 * A `fetch` stand-in for the failure simulation (`?aiFail=1`): it never calls the route (so no
 * OpenAI cost) and rejects after `SIMULATED_FAILURE_MS`, which `postAi()` reports as `network`.
 * It rejects at once when aborted, so Start over chat and leaving the page still work.
 */
export const failingFetch: FetchFn = (_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = init.signal;
    const timer = setTimeout(() => reject(new TypeError("Simulated AI failure")), SIMULATED_FAILURE_MS);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
