import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_ROUTE, countsAsAiFailure, failingFetch, type FetchFn, postAi, SIMULATED_FAILURE_MS } from "./post-ai";

afterEach(() => {
  vi.useRealTimers();
});

const BODY = { kind: "interview", summary: {}, messages: [{ role: "user", content: "Hi" }] };

/** A fake `fetch` that answers `status` with `body` (an object as JSON, or text as it is). */
const answering = (status: number, body: unknown): FetchFn =>
  vi.fn<FetchFn>(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));

const post = (fetchFn: FetchFn, signal = new AbortController().signal) => postAi(fetchFn, BODY, signal);

describe("postAi", () => {
  it("posts the body as JSON to the route, with the signal", async () => {
    const fetchFn = answering(200, { ok: true, kind: "interview", reply: "Hi", proposal: null, note: null });
    const signal = new AbortController().signal;
    await postAi(fetchFn, BODY, signal);
    expect(fetchFn).toHaveBeenCalledWith(AI_ROUTE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(BODY),
      signal,
    });
  });

  it("gives ok for 200 with ok: true, and the JSON", async () => {
    const json = { ok: true, kind: "interview", reply: "Hi", proposal: null, note: null };
    expect(await post(answering(200, json))).toEqual({ kind: "ok", json });
  });

  it.each([
    ["200 with ok: false", 200, { ok: false, error: "The AI gave an answer I couldn't use." }, "ai-failure", "The AI gave an answer I couldn't use."],
    ["502", 502, { ok: false, error: "The AI couldn't answer right now." }, "ai-failure", "The AI couldn't answer right now."],
    ["504", 504, { ok: false, error: "The AI took too long to answer." }, "ai-failure", "The AI took too long to answer."],
    ["500", 500, { ok: false }, "ai-failure", null],
    ["401", 401, { ok: false, error: "Please log in as a JCA admin to use the AI assistant." }, "session-expired", "Please log in as a JCA admin to use the AI assistant."],
    ["503", 503, { ok: false, error: "The AI assistant is not available right now. Use the form instead." }, "unavailable", "The AI assistant is not available right now. Use the form instead."],
    ["413", 413, { ok: false, error: "This conversation is too long. Start a new chat to keep going." }, "too-long", "This conversation is too long. Start a new chat to keep going."],
    ["429", 429, { ok: false, error: "You've sent a lot of requests. Wait a few minutes and try again." }, "rate-limited", "You've sent a lot of requests. Wait a few minutes and try again."],
    ["400", 400, { ok: false, error: "The request couldn't be read. Refresh the page and try again." }, "bad-request", "The request couldn't be read. Refresh the page and try again."],
    ["403", 403, { ok: false, error: "This request isn't allowed." }, "bad-request", "This request isn't allowed."],
  ])("classifies %s", async (_, status, body, kind, error) => {
    expect(await post(answering(status, body))).toEqual({ kind, error });
  });

  it("gives network for a body that isn't JSON, whatever the status", async () => {
    expect(await post(answering(200, ""))).toEqual({ kind: "network", error: null });
    expect(await post(answering(504, "An error occurred with your deployment"))).toEqual({ kind: "network", error: null });
  });

  it("gives network when fetch rejects", async () => {
    expect(await post(async () => Promise.reject(new TypeError("Failed to fetch")))).toEqual({ kind: "network", error: null });
  });

  it("gives aborted when we aborted it, before or after the response", async () => {
    const controller = new AbortController();
    const rejecting: FetchFn = async () => {
      controller.abort();
      throw new DOMException("Aborted", "AbortError");
    };
    expect(await post(rejecting, controller.signal)).toEqual({ kind: "aborted" });

    const late = new AbortController();
    const answeringThenAborted: FetchFn = async () => {
      late.abort();
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };
    expect(await post(answeringThenAborted, late.signal)).toEqual({ kind: "aborted" });
  });

  it("counts only ai-failure and network as the AI failing", () => {
    expect(countsAsAiFailure("ai-failure")).toBe(true);
    expect(countsAsAiFailure("network")).toBe(true);
    for (const kind of ["session-expired", "unavailable", "too-long", "rate-limited", "bad-request"] as const) {
      expect(countsAsAiFailure(kind)).toBe(false);
    }
  });
});

describe("failingFetch (the failure simulation)", () => {
  it("rejects after 1.5 seconds, which postAi reports as network, and never calls fetch", async () => {
    vi.useFakeTimers();
    const realFetch = vi.spyOn(globalThis, "fetch");
    let result: unknown;
    void post(failingFetch).then((r) => (result = r));
    await vi.advanceTimersByTimeAsync(SIMULATED_FAILURE_MS - 1);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    expect(result).toEqual({ kind: "network", error: null });
    expect(realFetch).not.toHaveBeenCalled();
    realFetch.mockRestore();
  });

  it("stops at once when aborted", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    let result: unknown;
    void post(failingFetch, controller.signal).then((r) => (result = r));
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    expect(result).toEqual({ kind: "aborted" });
  });
});
