# Architecture

How the system is built: its parts, how they connect, where code lives, and how requests flow. For tables and access rules see [DATABASE.md](DATABASE.md); for login see [AUTHENTICATION.md](AUTHENTICATION.md).

## System overview

```
                         ┌────────────────────────── Vercel ──────────────────────────┐
  Visitor ──page req───▶ │  proxy.ts ─▶ (site) pages ─▶ lib/content ─▶ src/content/*.ts│
                         │                    │                         (code, static) │
                         │                    └─▶ profiles/queries.ts ──┐              │
                         │                         (cached 30s)         │ anon key     │
                         │                                              ▼              │
  Visitor ──form post──▶ │  subscribe action ────── service role ─▶ ┌──────────────┐   │
                         │        └──after()──▶ Resend API          │   Supabase   │   │
                         │                                          │   Postgres   │   │
  Admin ───page/form───▶ │  /admin pages + Server Actions           │   + RLS      │   │
                         │   requireAdmin() ─── cookie session ───▶ │   Auth ──────┼───┼─▶ Resend SMTP
                         │                                          │   Storage    │   │
  Vercel Cron (hourly) ─▶│  /api/cron/keep-alive ── service role ─▶ └──────────────┘   │
                         │                                                             │
  Admin ──fetch (JSON)──▶│  proxy.ts ─▶ /api/translator/ai ─ getAdmin() ─▶ OpenAI API ─┼─▶ OpenAI
                         └─────────────────────────────────────────────────────────────┘
  Visitor ──"Register"──▶ Eventbrite (a link only)
```

One Next.js application does everything. Server Actions are the backend; Supabase is the database, identity provider and file store. The Data Axle Translator adds a browser-only path that never reaches the server; its Phase 2 adds one server route for AI calls, `/api/translator/ai` (see [The Translator](#the-translator)).

## Technology stack

Versions from [package.json](../package.json).

| Library | Version | Why it is here | Where |
|---|---|---|---|
| `next` (App Router) | 16.3.6 | Routing, rendering, Server Actions, images | Everywhere |
| `react`, `react-dom` | 19.2.8 | UI; `useActionState` and `cache()` | Components, `lib/auth.ts`, `lib/content` |
| `@supabase/supabase-js` | ^2.109 | Database, auth and storage client | `src/lib/supabase/` |
| `@supabase/ssr` | ^0.12 | Cookie-based sessions on the server | `server.ts`, `session.ts` |
| `zod` | ^4.6 | Validation and error messages | Each feature's `schema.ts` |
| `server-only` | ^0.0.1 | Fails the build if server code reaches the browser | Top of every server module |
| `@vercel/analytics` | ^2.0 | Page views on public pages | `site-shell.tsx` |
| `exceljs` | ^4.4 | Reads Translator workbooks and writes the Excel export, in the browser; loaded only when a workbook is parsed or exported | `features/translator/import/parse.ts`, `features/translator/export/workbook.ts`; also `scripts/translator/make-rs-fixture.ts` (TR-35), which writes the Reference Solutions sample |
| `jszip` | ^3.10 | Opens the .xlsx ZIP to fix files ExcelJS can't read as written (already an ExcelJS dependency) | `features/translator/import/xlsx-compat.ts`; also `import/file-gate.test.ts` and `scripts/translator/make-rs-fixture.ts` (fixed ZIP dates, so the sample rebuilds byte-identical) |
| `openai` | 7.63.0 (exact) | The OpenAI SDK for the Translator's Phase 2 AI calls (interview and intro draft), on the server only. Added in TR-38; no code imports it yet | `features/translator/ai/client.ts` only (to be built) |
| `tailwindcss` | 4 | Styling; design tokens in the `@theme` block of `globals.css` | Class names |
| `typescript`, `eslint` | 5, 9 | Type checking and linting | `tsconfig.json`, `eslint.config.mjs` |
| `vitest` | 4.1.12 (exact, dev only) | Unit tests, run in Node by `npm run test` (TR-29). Never bundled: app code imports no test or fixture. 4.x because Vitest 5 requires `@types/node` 22 or later and this project uses 20 | `vitest.config.ts`; `*.test.ts` beside the code; fixtures in `features/translator/__fixtures__/` |

There is no UI kit, form library, ORM or state library.

## Third-party integrations

| Service | Responsibility | Configured in |
|---|---|---|
| Supabase | Database, admin identity, password emails, logo files | Env vars and migrations; in the dashboard: sign-up off, Site URL, SMTP, email templates, the `admins` rows |
| Resend (HTTP API) | New-subscriber email to the team | `RESEND_API_KEY`, `SUBSCRIBE_NOTIFY_EMAIL`, `RESEND_FROM_EMAIL` |
| Resend (SMTP) | Invite and reset emails, sent by Supabase Auth | Supabase dashboard only |
| Vercel | Hosting, deploys, cron, analytics | Project settings, [vercel.json](../vercel.json) |
| Eventbrite | Workshop registration | A link in `src/content/events.ts`; no data integration |
| Google | Fonts (downloaded at build), Search Console verification, structured data | `GOOGLE_SITE_VERIFICATION` |

Not present: payments, error tracking, an email marketing tool, captcha. Variables are listed in [guides/ENVIRONMENT-CONFIGURATION.md](guides/ENVIRONMENT-CONFIGURATION.md).

## Frontend

- Server Components by default. 15 files are client components: the forms, the two mobile menus, and the reorder and delete controls.
- Three layout trees under `src/app/layout.tsx`:

| Route group | Shell | For |
|---|---|---|
| `(site)` | Header, footer, announcement bar, analytics | Public pages |
| `(site-preview)` | Public look, admin-gated, no analytics | `/preview/profiles/[id]` |
| `admin` | Sidebar when logged in, plain header otherwise | The CMS |

- State lives on the server, in `useActionState` for forms, and in local `useState` for UI. Success messages travel as query strings (`?saved=1`) and are shown by `components/admin/flash-notice.tsx`.
- Styling is Tailwind with tokens in [src/app/globals.css](../src/app/globals.css). Fonts are Fraunces (headings) and Public Sans (body) through `next/font/google`.

## Backend

Server Actions are the API ([API-DOCUMENTATION.md](API-DOCUMENTATION.md)). Each feature folder has the same shape:

```
src/features/<feature>/
  schema.ts       zod rules, shared by form and server
  actions.ts      "use server" entry points
  repository.ts   database writes
  queries.ts      database reads
  *.tsx           UI
```

[src/proxy.ts](../src/proxy.ts) is Next.js 16's middleware. It redirects `/bi101` casings to `/BI101`, lowercases profile slugs, and refreshes the admin session cookie on `/admin`, `/preview` and the Translator's AI route `/api/translator/ai` (the redirects never apply to those). It is **not** the access check; that is `requireAdmin()` in pages and actions, and `getAdmin()` in the AI route (see [AUTHENTICATION.md](AUTHENTICATION.md)).

### Two content pipelines

| | Code content | Database content |
|---|---|---|
| What | Home, About, BI101, Library Intelligence, reviews, nav, labels | Profiles |
| Stored in | `src/content/*.ts` | Supabase `profiles` |
| Read through | `src/lib/content/index.ts` | `src/features/profiles/queries.ts` |
| Changed by | A developer, then a deploy | An admin in `/admin` |
| Rendering | Static at build | Cached 30 seconds, invalidated on save |

```
src/content/*.ts ──> ContentSource (local) ──> lib/content API ──> app/ pages ──> components
```

Pages never import from `src/content` directly. They call `getPage("home")`, `getEvent("bi101")` and so on, and components receive typed objects (`Event`, `HomePage`). The `ContentSource` interface was designed so a CMS could replace the local files. The CMS was built beside it instead: profiles do not go through `ContentSource`.

### The three Supabase clients

| Client | File | Acts as | Used for |
|---|---|---|---|
| Public | `lib/supabase/public.ts` | Anonymous visitor | Cached public profile reads |
| Server | `lib/supabase/server.ts` | The logged-in admin (from cookies) | Everything in `/admin`, logo uploads |
| Admin | `lib/supabase/admin.ts` | Service role, bypasses RLS | Subscribe insert, keep-alive, password-reset lookup |

Choosing the wrong one is a security bug. New admin features use `server.ts`, never `admin.ts`.

### Caching

- Public profile reads use `unstable_cache` with tag `profiles` and a 30-second lifetime (`REVALIDATE_SECONDS` in `queries.ts`).
- Admin actions call `updateTag("profiles")` after any change that affects the public site.
- Code-content pages are static until the next deploy. Admin reads are never cached.

## Repository structure

Imports flow downward only:

```
src/app/         routes          thin: fetch, check access, compose
src/features/    business logic
src/components/  presentation
src/lib/         infrastructure
src/content/     data            imported only by lib/content/sources/local.ts
```

```
src/
  app/
    (site)/             Public pages inside the site header and footer. The group name is not in the URL.
    (site-preview)/     /preview/profiles/[id]: a draft shown with the public look, admins only.
    admin/              The CMS: its own layout, not indexed.
      login/, forgot-password/, set-password/   Open to logged-out visitors.
      (protected)/      Everything else. The layout checks for an admin; each page and action also calls requireAdmin().
    api/cron/keep-alive/  The hourly Supabase keep-alive (Vercel Cron).
    api/translator/ai/  The Translator's AI route (Phase 2, admins only). Thin: the work is in features/translator/ai/.
  content/              Code content as typed TypeScript data (site, events, people, pages, reviews).
  lib/content/          The content API (index.ts), ContentSource interface, local source, content types.
  components/
    ui/                 Primitives: buttons, icons, rich text, form field styles.
    layout/             Header, mobile menu, footer, announcement bar.
    admin/              Admin shell, sidebar, phone menu, page header, flash notice. Sidebar entries in modules.ts.
    event/              Event cards and the EventPage template.
    sections/           Page sections (hero, approach, Join the Junto band).
  features/
    subscribe/          Mailing list: schema, action, repository, notification email, form.
    admin-auth/         Login, logout, forgot and set password.
    profiles/           "Who Can Help?": public and admin queries, form, actions, repository, logo storage.
    translator/         Data Axle Translator: import/, normalize/, criteria/, ranking/, export/, ai/, ui/ (see The Translator below).
  lib/
    auth.ts             getAdmin(), requireAdmin().
    rate-limit.ts       In-memory attempt limit (per IP for login and subscribe, per admin for the AI route).
    supabase/           The three clients, config, and the session refresh used by proxy.ts.
    seo.ts              Page metadata and Event JSON-LD.
  proxy.ts              Redirects and session refresh.
supabase/migrations/    The schema, applied by hand in filename order.
supabase/templates/     Invite and reset email HTML, pasted into the Supabase dashboard.
scripts/translator/     make-rs-fixture.ts: builds the Reference Solutions sample workbook (TR-35). Not part of the app.
docs/                   This documentation, specs, mockups, QR code.
public/email/           Images linked from sent emails. Don't rename.
public/translator/      The two Translator sample workbooks, byte-identical copies of the ones in docs/translator/.
```

### Key files

| File | Responsibility | Careful |
|---|---|---|
| `src/proxy.ts` | Redirects and session refresh | Has a `matcher`; new gated or redirected URLs must be added to it |
| `src/lib/auth.ts` | `getAdmin()`, `requireAdmin()` | Call `requireAdmin()` first in every admin page and action. The AI route calls `getAdmin()` so it can return `401` JSON |
| `src/lib/content/types.ts` | The code-content model | The contract between content and components |
| `src/lib/rate-limit.ts` | In-memory per-IP limiter | Per serverless instance, so best effort only |
| `src/components/ui/rich-text.tsx` | Mini-Markdown renderer for both pipelines | Builds React elements and allows only http(s), mailto and tel links; keep that if replacing it |
| `src/components/admin/modules.ts` | Admin sidebar entries | Add a new admin section here |
| `src/content/site.ts` | Nav, emails, featured event | |
| `src/features/profiles/schema.ts` | The profile field registry and publish rules | `PUBLISH_FIELDS` must match the database constraint |
| `src/features/profiles/actions.ts` | Create, update, delete, move | The model for any new write |
| `src/features/profiles/repository.ts` | Writes; maps Postgres errors to result types | `toRow()` maps to the old column names |
| `src/features/profiles/queries.ts` | Cached public reads, path and tag constants | Uses the anonymous client |
| `src/features/profiles/admin-queries.ts` | Uncached admin reads | Every query filters `deleted_at is null` |
| `src/features/profiles/profile-form.tsx` | The create and edit form | The largest file (about 650 lines) |
| `next.config.ts` | 3 MB Server Action body limit, Supabase image host, `BUILT_AT` | |
| `vercel.json` | The hourly cron | |

## Request flows

### Static page (homepage)

Built at deploy time. `page.tsx` calls `getPage("home")` → `lib/content` → `src/content/pages.ts`. No database access.

### Public profile page: `GET /who-can-help/<slug>`

1. `proxy.ts` redirects to lowercase if the slug has a capital letter.
2. The page rejects slugs that don't match `^[a-z0-9]+(-[a-z0-9]+)*$` without querying.
3. `getPublishedProfile(slug)` returns from cache, or queries as an anonymous visitor with `status = published` and `deleted_at is null`. RLS applies the same rule independently.
4. `toProfile()` maps column names; `ProfileArticle` renders it with labels from `src/content/who-can-help.ts`.
5. A null result calls `notFound()` and returns a real 404.

### Joining the mailing list

`SubscribeForm` → `subscribe()` in `features/subscribe/actions.ts`:

1. Honeypot field filled: return a fake success.
2. Validate with `subscribeSchema`.
3. Rate limit: 5 attempts per 10 minutes per IP.
4. `addSubscriber()` inserts with the service role. A duplicate email becomes "You're already on the list".
5. For a new row, `after()` sends the Resend notification once the response has gone. A failure there is only logged.

### Publishing a profile

`ProfileForm` → `updateProfile(id, ...)` in `features/profiles/actions.ts`:

| Step | Code | On failure |
|---|---|---|
| Access | `requireAdmin()` | Redirect to login |
| Read | `readValues`, `readIntent`, `readLogo` | |
| Validate | `check()`: zod, plus `missingPublishFields()` when publishing | All errors returned together with the typed values |
| Upload logo | `uploadLogo()` | "The logo couldn't be uploaded, so nothing was saved" |
| Save | `updateProfileFields()` | Uploaded logo discarded |
| Clean up | Remove the replaced logo file | Logged only |
| Refresh public site | `updateTag("profiles")` | |
| Finish | `redirect("/admin/profiles/<id>?published=1")` | |

In the database, the single `UPDATE` passes through RLS (`is_admin()`), the audit trigger, the unique slug index and the completeness constraint. How refusals are reported: [API-DOCUMENTATION.md](API-DOCUMENTATION.md#errors-from-the-database).

### Translator AI call: `POST /api/translator/ai`

`proxy.ts` refreshes the admin session first. `route.ts` builds the real dependencies and calls `handleAiRequest()` in `features/translator/ai/handle-request.ts`:

1. `getAdmin()`: none gives `401` JSON (not a redirect, so the browser's `fetch` can read it).
2. A foreign `Origin` gives `403`. AI switched off (`aiEnabled()`) gives `503`.
3. Body: JSON only, 100 KB at most, checked with `aiRequestSchema`; then the message limits (`413`).
4. Rate limit: 30 requests per 10 minutes per admin (`429`).
5. The capability (`interview.ts` or `intro.ts`) calls OpenAI through `client.ts`, with 12 seconds per attempt and 25 seconds for the whole request (`504` on timeout, `502` on any other failure). The interview asks for structured output, checks the reply with `parseInterviewReply()` (`validate.ts`: the brief schema and every value in the file) and retries once if the reply isn't in the format (TR-42).

Nothing is stored and nothing is logged except `translator_ai_<code>`. Statuses and messages: [API-DOCUMENTATION.md](API-DOCUMENTATION.md#post-apitranslatorai).

### Error handling

| Tier | Mechanism | User sees |
|---|---|---|
| User-caused | Action returns state | Inline field errors, values preserved |
| System-caused during a write | Action catches and logs with a prefix | A plain message |
| Unexpected while rendering an admin page | `src/app/admin/error.tsx` | "Something went wrong" with Try again |
| Not found | `notFound()` | The nearest `not-found.tsx` |

There is no `error.tsx` for the public site.

## The Translator

The Data Axle Translator (Phase 1) is an admin tool at `/admin/translator` that turns a business contacts workbook into a ranked, explained shortlist and an Excel download. Its architecture differs from the rest of the app:

- **Browser only.** Parsing, cleaning, ranking and export run in the browser. No rows go to a Server Action, Supabase, browser storage or the logs, and all state lives in one React component for one session.
- **Phase 2 route (built in TR-39) and chat (TR-43 to TR-45).** The admin page reads `aiEnabled()` on the server and passes a boolean to the UI, which shows Chat with AI or the form. Chat with AI calls one admin-only route, `/api/translator/ai`, which receives only the file summary and the intro fields of one chosen business, never full rows, and stores and logs nothing. The interview uses the real instructions (TR-41) and every proposal is checked against the brief schema and the file before it is returned (TR-42); the intro fields are sent from TR-48. The AI's proposal enters the wizard the way the form's brief does: Confirm and rank on the proposal card sets the form (`briefToFormState()`), the pending brief and the confirmed brief, so the same `rank()` runs on it (TR-45). Flow: [Translator AI call](#translator-ai-call-post-apitranslatorai). Details: [translator/README.md](translator/README.md#the-ai-route).
- **Folders** in `src/features/translator/`: `import/` (file checks, hash gate, parse, layout mappings), `normalize/` (clean, check, group duplicates), `criteria/` (the one `SearchBrief` schema), `ranking/` (filter, score, sort, reasons, pin and omit), `export/` (the `.xlsx`) are plain TypeScript with no React; `ai/` (Phase 2) holds the AI route's logic, and its `client.ts` is the only server-only file; `ui/` holds the components.

```text
workbook ─▶ import/ ─▶ normalize/ ─▶ ranking/ (with the criteria/ SearchBrief) ─▶ ui/ results ─▶ export/ Excel
                                all in the browser (Phase 1)
```

Everything else (the step-by-step data flow, field mapping, schema, ranking rules, tests, how to add an input format or change scoring) is in the developer guide, [translator/README.md](translator/README.md). Ticket status: [TASKS.md](TASKS.md).

## Extending the system

### Where to change things

| Task | Files |
|---|---|
| Homepage or About wording | `src/content/pages.ts` (more in [FEATURES.md](FEATURES.md#editing-code-content)) |
| Navigation | `src/content/site.ts` |
| Add a workshop | `src/content/events.ts`, a route using `<EventPage>`, `site.featuredEventSlug`, and `CANONICAL_PATHS` in `proxy.ts` if the URL is printed |
| Add a profile field | See the recipe below |
| Change publish requirements | New migration for the constraint, plus `PUBLISH_FIELDS` |
| Add an admin module | See the recipe below |
| Change the logo size limit | Bucket migration, `LOGO_MAX_BYTES`, `bodySizeLimit` in `next.config.ts` |
| Rename `/who-can-help` | `PROFILES_PATH` in `queries.ts`, the `proxy.ts` matcher, `site.ts` nav, and the route folder |
| Change invite or reset email | `supabase/templates/`, then paste into the dashboard |
| Add a Translator input layout | [translator/README.md](translator/README.md#how-to-add-a-new-input-format) |
| Change Translator scoring | [translator/README.md](translator/README.md#how-to-change-scoring) |

### Recipe: add a field to profiles

Example: an optional "Hours" line.

1. **Migration:** `alter table public.profiles add column if not exists hours text check (char_length(hours) <= 200);` Apply it first ([guides/DATABASE-MIGRATIONS.md](guides/DATABASE-MIGRATIONS.md)).
2. **`schema.ts`:** add `hours: text(200)` to `profileDraftSchema` and a label in `PROFILE_LABELS`. `PROFILE_FIELDS` and the form-value types update themselves.
3. **`repository.ts`:** add `hours: orNull(input.hours)` to `toRow()`.
4. **`queries.ts`:** add `hours` to `COLUMNS`, `ProfileRow` and `toProfile()`.
5. **`admin-queries.ts`:** add it to `DETAIL_COLUMNS`, `DetailRow` and `toAdminProfile()`.
6. **`types.ts`:** add it to `Profile`.
7. **`profile-form.tsx`:** add the input.
8. **`profile-article.tsx`:** show it, and leave it out when empty.
9. Run `typecheck`, `lint`, `build`; try a draft, a preview and a published profile.

If the field is required to publish, also add it to `PUBLISH_FIELDS` and to the `profiles_published_complete` constraint, with a check that no published row lacks it.

### Recipe: add an admin module

Follow the profiles feature as the template:

1. Migration: table, RLS, policies using `private.is_admin()`, explicit grants, audit trigger if wanted.
2. `features/<name>/`: `schema.ts`, `repository.ts`, `admin-queries.ts`, `queries.ts` (cached, with its own tag), `actions.ts` (each action starts with `requireAdmin()`).
3. Pages under `app/admin/(protected)/<name>/`, each calling `requireAdmin()`.
4. Move the module from `plannedModules` to `adminModules` in `components/admin/modules.ts`.
5. Public pages under `app/(site)/`, plus `sitemap.ts`.

### Moving code content into a CMS source

The original plan for code content, still possible:

1. Model the content types to match [src/lib/content/types.ts](../src/lib/content/types.ts).
2. Add `src/lib/content/sources/<cms>.ts` implementing `ContentSource`. Rich text uses the Markdown subset `*em*`, `**strong**`, `[label](href)`, `## Subhead`.
3. Point `source` in [src/lib/content/index.ts](../src/lib/content/index.ts) at it.
4. Add revalidation (`revalidateTag` / `revalidatePath`) so edits appear without a deploy.
