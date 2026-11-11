# API documentation

The app has **one HTTP endpoint** and **ten Server Actions**. There is no REST or GraphQL API of its own. Server Actions have no stable URL, but anyone who can load the page can invoke them, so each one checks access and input itself.

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

Rate limit: 5 attempts per 10 minutes per IP, per action, in memory on each serverless instance (`src/lib/rate-limit.ts`).

### Conventions

- Actions return state for expected failures and redirect on success. `redirect()` is always called outside `try` blocks.
- Success flags in the query string (`?saved=1`) are shown once by `components/admin/flash-notice.tsx`, then removed from the URL.
- Server logs are prefixed: `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[profiles]`, `[keep-alive]`.
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
