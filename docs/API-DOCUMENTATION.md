# API documentation

The app has **two HTTP endpoints** and **ten Server Actions**. There is no REST or GraphQL API of its own. Server Actions have no stable URL, but anyone who can load the page can invoke them, so each one checks access and input itself.

Supabase's own REST API is also reachable with the public publishable key; row level security decides what it returns ([DATABASE.md](DATABASE.md#access-control)).

## `GET /api/cron/keep-alive`

Keeps the free Supabase project from pausing. Called hourly by Vercel Cron ([vercel.json](../vercel.json)). File: [src/app/api/cron/keep-alive/route.ts](../src/app/api/cron/keep-alive/route.ts).

**Authentication:** header `Authorization: Bearer <CRON_SECRET>`. Vercel adds it automatically once `CRON_SECRET` is set in the project.

**Behaviour:** inserts a row into `keep_alive` and deletes rows older than 30 days. If the insert fails (for example, the table is missing), it falls back to a read of `subscribers`.

| Status | Body | When |
|---|---|---|
| 200 | `{ ok: true, mode: "write", source, checkedAt, previousPing }` | Row written |
| 200 | `{ ok: true, mode: "read", checkedAt }` | Write failed, read succeeded |
| 401 | `{ ok: false, error: "Unauthorized" }` | Wrong or missing secret |
| 500 | `{ ok: false, error: "Not configured" }` | `CRON_SECRET` not set |
| 500 | `{ ok: false, error: "Database query failed" }` | Supabase unreachable |

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/keep-alive
```

## `POST /api/translator/ai`

The Translator's one server route for AI calls (Phase 2, TR-39). The browser sends the interview chat or an intro request; the route checks it, calls OpenAI and returns the answer. It keeps nothing between calls, stores nothing and logs no content. Files: [src/app/api/translator/ai/route.ts](../src/app/api/translator/ai/route.ts) (thin) and [src/features/translator/ai/handle-request.ts](../src/features/translator/ai/handle-request.ts) (the checks). Background: [translator/README.md](translator/README.md#the-ai-route).

**Status:** the route works end to end. The interview uses the real instructions (TR-41) and answers in a fixed format that is checked before it is returned (TR-42), so `proposal` is a checked brief or `null`. The intro instructions are real, but the intro fields are not sent to OpenAI until TR-48. No UI calls it yet.

**Access:** a logged-in JCA admin (`getAdmin()`, the same check as `requireAdmin()` without the redirect). The session cookie is refreshed by `proxy.ts`, which lists this path in its `matcher`. Same origin only: a request with an `Origin` header from another site is refused, and only `Content-Type: application/json` is read, so a form on another site can't post to it with the admin's cookie. `POST` only (`GET` gives `405`).

**Request** (JSON, checked by `aiRequestSchema` in [ai/request-schema.ts](../src/features/translator/ai/request-schema.ts); unknown keys are refused):

```ts
type AiRequest =
  | { kind: "interview"; summary: FileSummary; messages: ChatMessage[]; currentBrief?: SearchBrief }
  | { kind: "intro"; intro: IntroFields; goal: string };
type ChatMessage = { role: "user" | "assistant"; content: string };   // no "system" role
type FileSummary = {                       // fileSummarySchema in ai/summary.ts (TR-40), strict
  layout: "synthetic" | "reference-solutions";
  uniqueRecords: number;                   // whole number, 0 or more
  cities: SummaryValue[];                  // each list: at most 100 items
  states: SummaryValue[];
  industries: SummaryValue[];
  titles: SummaryValue[];
  employees: { min: number | null; max: number | null; withValue: number; blank: number };
  truncated: { cities: boolean; states: boolean; industries: boolean; titles: boolean };
};
type SummaryValue = { value: string; count: number };   // value 1 to 80 characters, not contact-looking; count a whole number, 1 or more
```

- `summary` is the file summary built in the browser by `buildFileSummary()`: what it holds, how it is sorted and which values are dropped are in [translator/README.md](translator/README.md#the-file-summary). The schema is **strict at every level**: an extra key anywhere (for example `rows`), a missing list or flag, a list over 100 items, a value that is empty or over 80 characters, a value that looks like contact data (contains `@`, `http` or `www.` in any case, or 7 or more digits in all; the browser drops these, so one arriving means something went wrong), a count below 1 or not whole, `min`, `max`, `withValue` or `blank` not a whole number (`withValue` and `blank` 0 or more), or an unknown `layout` gives `400`. The largest valid summary (4 lists of 100 values of 80 characters) is about 40 KB, well under the body limit.
- `intro` is any JSON object for now. TR-48 (intro fields) defines it.
- `messages`: 1 to 30. Each `content` has text in it (it is trimmed).
- `currentBrief`, when given, must be a valid `SearchBrief` ([translator/README.md](translator/README.md#criteria-schema)).
- `goal`: the user's own words, with text in it.

**Limits:**

| Limit | Value | Constant |
|---|---|---|
| Body | 100 KB (102,400 bytes), by `Content-Length` and by the bytes actually read | `MAX_BODY_BYTES` |
| Values per `summary` list | 100 | `MAX_SUMMARY_VALUES` (`ai/summary.ts`) |
| A `summary` value | 80 characters | `MAX_SUMMARY_VALUE_CHARS` (`ai/guardrails.ts`) |
| Messages per request | 30 | `MAX_MESSAGES` |
| A user message, or the intro `goal` | 1,000 characters | `MAX_USER_MESSAGE_CHARS` |
| An assistant message | 4,000 characters | `MAX_ASSISTANT_MESSAGE_CHARS` |
| Requests per admin | 30 per 10 minutes, per server instance (best effort, [KNOWN-ISSUES.md](KNOWN-ISSUES.md#security)) | `AI_REQUESTS_PER_WINDOW` |
| Time for one AI attempt | 12 seconds (the SDK makes no retries of its own) | `AI_ATTEMPT_TIMEOUT_MS` (`ai/guardrails.ts`) |
| Time for the whole request | 25 seconds, the interview's one retry included | `AI_REQUEST_TIMEOUT_MS` (`ai/guardrails.ts`) |
| Vercel function duration | 30 seconds | `export const maxDuration = 30` in `route.ts` |

**Response** (always JSON, always `Cache-Control: no-store`):

```ts
type AiResponse =
  | { ok: true; kind: "interview"; reply: string; proposal: SearchBrief | null; note: string | null }
  | { ok: true; kind: "intro"; draft: string }
  | { ok: false; error: string };   // plain-language message for the user
```

- **Interview `proposal`** has passed `parseInterviewReply()` (`ai/validate.ts`, TR-42): the brief schema with its cross-field rules, only the parts the form can edit, and every city, state, industry and title value in the file summary, in the summary's spelling. Otherwise it is `null`. A proposal that fails `searchBriefSchema` is never returned. The rules: [translator/README.md](translator/README.md#checking-the-ais-reply).
- **Interview `note`** (TR-42) is `null`, or says why a proposal was dropped, for the UI to show beside `reply`: "I couldn't use "Flagstaff" because it's not in this file." (or "... "Flagstaff" and "Mining" because they're not in this file."), "I couldn't use that suggestion because it includes an option this tool can't edit yet. Try the form, or ask me again." or "I couldn't use that suggestion because some parts don't fit together. Try again, or use the form."
- **Retry:** when the interview reply isn't in the format, the route asks OpenAI once more inside the same request. A second unusable reply gives the `502` below. There is no retry after a timeout or another failure.
- **`maxDuration = 30`:** Vercel's docs (checked 2026-11-25) give every plan a maximum of 300 seconds or more with Fluid Compute, on by default for new projects. This project's plan and Fluid Compute setting: **Unverified**.

The checks run in this order; the first that fails answers.

| # | Status | `error` | When | Logged |
|---|---|---|---|---|
| 1 | 401 | Please log in as a JCA admin to use the AI assistant. | Logged out, or not on the admins list | |
| 2 | 403 | This request isn't allowed. | `Origin` header present and not this site | |
| 3 | 503 | The AI assistant is not available right now. Use the form instead. | `OPENAI_API_KEY` not set, or `TRANSLATOR_AI` is `off` | |
| 4 | 400 | The request couldn't be read. Refresh the page and try again. | `Content-Type` isn't `application/json` | `translator_ai_bad_request` |
| 5 | 413 | This request is too large. Start a new chat and try again. | Body over 100 KB | |
| 6 | 400 | The request couldn't be read. Refresh the page and try again. | Not JSON, or not the shape above (unknown `kind`, a `system` message, an unknown key, an invalid `currentBrief`, a `summary` that isn't a valid `FileSummary`) | `translator_ai_bad_request` |
| 7 | 413 | This conversation is too long. Start a new chat to keep going. | More than 30 messages, or an assistant message over 4,000 characters | |
| 8 | 413 | Your message is too long. Keep it under 1,000 characters. | A user message, or the `goal`, over 1,000 characters | |
| 9 | 429 | You've sent a lot of requests. Wait a few minutes and try again. | Over 30 requests in 10 minutes | `translator_ai_rate_limited` |
| 10 | 504 | The AI took too long to answer. Try again, or use the form. | An attempt got no answer within 12 seconds, or the request ran past 25 seconds | `translator_ai_timeout` |
| 10 | 502 | The AI couldn't answer right now. Try again, or use the form. | OpenAI returned an error, an empty answer or a refusal | `translator_ai_upstream`, `translator_ai_empty` |
| 10 | 502 | The AI gave an answer I couldn't use. Your last criteria are kept. Try again or use the form. | Interview only: the reply wasn't in the format twice in a row (TR-42) | `translator_ai_unusable` |
| 11 | 200 | | The `AiResponse` above | |

**Logging:** only `console.error("translator_ai_<code>")` with one of the fixed codes in the table. Never the body, the chat, the summary, the intro fields, the AI's reply (including a reply in the wrong format), a note or an error's message. The route asks OpenAI not to store the response (`store: false`).

```js
// In the browser console on the site, logged in as an admin:
await (await fetch("/api/translator/ai", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    kind: "interview",
    summary: {
      layout: "synthetic", uniqueRecords: 1,
      cities: [{ value: "Phoenix", count: 1 }], states: [{ value: "AZ", count: 1 }],
      industries: [{ value: "Fabrication", count: 1 }], titles: [{ value: "Owner", count: 1 }],
      employees: { min: 25, max: 25, withValue: 1, blank: 0 },
      truncated: { cities: false, states: false, industries: false, titles: false },
    },
    messages: [{ role: "user", content: "Hello" }],
  }),
})).json();
```

## Server Actions

| Action | File | Access | Input | Success | Failure |
|---|---|---|---|---|---|
| `subscribe` | `features/subscribe/actions.ts` | Public; honeypot, rate limit | `firstName`, `email`, `zip` | `{ status: "success", message }` | `{ status: "error", message, fieldErrors, values }` |
| `login` | `features/admin-auth/actions.ts` | Public; rate limit | `email`, `password` | Redirect to `/admin` | `{ error, email }` |
| `logout` | same | | none | Redirect to `/admin/login` | |
| `requestPasswordReset` | same | Public; rate limit | `email` | `{ sent: true }` whether or not an email went out | `{ error }` for a malformed email or rate limit |
| `setPassword` | same | Email one-time code, or an admin session | `password` (10 to 72), `confirm`, `tokenHash`, `type` | Redirect to `/admin` | `{ error, expired }` or `{ error, codeUsed }` |
| `createProfile` | `features/profiles/actions.ts` | Admin | Profile fields, `intent`, `logo` | Redirect to `/admin/profiles/<id>?created=1` or `?published=1` | `{ values, fieldErrors, message }` |
| `updateProfile(id)` | same | Admin | Same, plus `removeLogo` | Redirect with `?saved=1`, `?published=1` or `?hidden=1` | Same |
| `deleteProfile(id)` | same | Admin | none | Redirect to `/admin/profiles?deleted=<id>` | `{ message }` |
| `moveProfile(id, direction)` | same | Admin | `"up"` or `"down"` | `{ position, total }` | `{ error }` |

"Admin" means the action calls `requireAdmin()` first, and RLS checks again in the database. Details: [AUTHENTICATION.md](AUTHENTICATION.md).

Rate limit: 5 attempts per 10 minutes per IP, per action, in memory on each serverless instance (`src/lib/rate-limit.ts`). The Translator AI route uses the same limiter with 30 per admin.

### Conventions

- Actions return state for expected failures and redirect on success. `redirect()` is always called outside `try` blocks.
- Success flags in the query string (`?saved=1`) are shown once by `components/admin/flash-notice.tsx`, then removed from the URL.
- Server logs are prefixed: `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[profiles]`, `[keep-alive]`. The Translator AI route logs only fixed codes, `translator_ai_<code>`.
- Login returns the same message for an unknown email and a wrong password. Password reset always reports success, so a broken email setup shows only in the logs under `[reset]`.

### Errors from the database

`features/profiles/repository.ts` turns database refusals into results:

| Postgres code | Result | Shown as |
|---|---|---|
| `23505` | `duplicate-slug` | Error on the Page address field |
| `23514` on `profiles_published_complete` | `incomplete` | "Needed to publish" or "Needed while the profile is published" |
| No row updated | `not-found` | "This profile no longer exists..." |
| Anything else | throws | "The profile couldn't be saved..." |

`features/subscribe/repository.ts` turns `23505` (duplicate email) into `"duplicate"`, shown as "You're already on the list".

## Profile field rules

Validated by zod in `features/profiles/schema.ts` and again by database constraints.

| Field | Rule | Needed to publish |
|---|---|---|
| `name` | 1 to 200 | Always required |
| `slug` | ≤ 100, run through `slugify()`, derived from the name if empty | Yes |
| `tagline` | ≤ 300 | Yes |
| `intro`, `worthExploring`, `peopleToKnow`, `gettingStarted` | ≤ 20,000 each | Yes |
| `websiteUrl` | http(s), real domain; `www.x.org` becomes `https://www.x.org` | Yes |
| `links` | One per line, ≤ 10; a URL or `[text](url)` | No |
| Contact fields | Email validated if present | No |
| `logo` | PNG, JPEG or WebP by file signature, ≤ 2 MB | No |

Long text supports paragraphs (blank line), bullets (`- `), `**bold**`, `*italic*` and `[links](https://...)`.

## Checking access from outside

To confirm that drafts are not exposed, call Supabase's REST API as an anonymous visitor. Only published, non-deleted profiles may come back:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=name,status" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```
