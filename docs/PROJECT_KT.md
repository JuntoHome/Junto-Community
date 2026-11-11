# Junto Community Alliance website: knowledge transfer

A handover guide for a developer taking over this project. It describes the system as it is in the code on `main` (November 2026), and says where the code and the older documents disagree.

It covers the business overview, architecture, repository structure, request flows, database, API and integrations, authentication and security, development workflow, known issues, and feature walkthroughs.

Related documents:

- [README.md](../README.md): setup, admin access, restoring a profile, deploying. The most accurate of the older documents.
- [JCA_CMS_Plan.md](JCA_CMS_Plan.md): requirements and tickets (CMS-01 to CMS-30) for the admin area.
- [BUILD_SPEC.md](BUILD_SPEC.md): the original Phase 1 spec. Historical; parts are out of date.

---

## 1. What the project is

The website for **Junto Community Alliance (JCA)** at juntocommunity.org. JCA helps small-business owners in the Phoenix area find and use community resources, with the public library at the centre. Every program is free.

It is one Next.js application with two faces:

- **A public marketing site**: homepage, About, the Business Insights 101 workshop page, Library Intelligence (research notes), a book review, and a directory of organization profiles called "Who Can Help?".
- **A private admin area (`/admin`)**: a small custom CMS where the JCA team writes and publishes those profiles.

Supabase provides the database, logins and file storage. There is no separate backend service.

### How it got here

| Stage | Goal | Result |
|---|---|---|
| Phase 1 (from Sept 26, 2026) | A credible front door and a short path from a flyer QR code to Eventbrite registration for the Oct 21, 2026 workshop | Static site plus the "Join the Junto" mailing-list form |
| CMS build (late Oct to early Nov 2026) | Let Paul (client and content author) manage content without a developer | Admin area with "Who Can Help?" profiles as the first content type |

### Roles

There are two roles, with no public sign-up and no customer accounts.

| Role | Who | Can do |
|---|---|---|
| Visitor | Anyone | Read public pages and published profiles, follow the link to Eventbrite, join the mailing list |
| Admin | Paul, Jeel, anyone invited | Log in; create, edit, preview, publish, hide, delete and reorder profiles; upload logos |

All admins have equal rights. An account in Supabase Auth that is not in the `admins` table has no access. Adding an admin is manual: a Supabase invite plus a SQL insert (see the README).

### Feature status

**Built**

| Feature | Location |
|---|---|
| Home, About, `/BI101` | `src/app/(site)/`, content in `src/content/` |
| Library Intelligence page | `src/content/library-intelligence.ts` |
| Book review page | `src/content/reviews.ts` |
| Join the Junto form (first name, email, ZIP) | `src/features/subscribe/` |
| Email to the team on each new signup | `src/features/subscribe/notify.ts` |
| Admin login, logout, forgot password, invite | `src/features/admin-auth/` |
| Profile management: draft, publish, hide, soft delete, reorder, logo, preview | `src/features/profiles/` |
| Public profiles at `/who-can-help` and `/who-can-help/[slug]` | `src/app/(site)/who-can-help/` |
| Sitemap, robots, Open Graph image, JSON-LD | `src/app/sitemap.ts`, `src/lib/seo.ts` |
| Hourly Supabase keep-alive | `src/app/api/cron/keep-alive/route.ts` |

**Partly built**

- Only profiles are managed in the admin. All other content is TypeScript in `src/content/` and needs a deploy to change.
- The online platform for BI101 is still `null`, marked `PENDING` in `src/content/events.ts`.
- The "Who Can Help?" name and wording are marked as drafts awaiting Paul's confirmation in `src/content/who-can-help.ts`.

**Planned, not built** (listed as "Coming later" in `src/components/admin/modules.ts`)

- Events management and own registration (to replace Eventbrite)
- Library Intelligence management
- Library Profiles
- Meeting Space Concierge
- Data Axle Translator: no code, but the remote branch `origin/translator` holds a spec, test spreadsheets and a `CLAUDE.md`. `translator` is the current working branch; see "Git" in section 8

### Business rules that must not be broken

1. **`/BI101` is printed on flyers as a QR code. Never rename or remove it.** `src/proxy.ts` redirects other casings to it.
2. A draft, hidden or deleted profile must never be public, even by direct URL. The database enforces this.
3. A profile can be published only when tagline, introduction, Worth exploring, People to know, Getting started and website are all filled in. Enforced by both the zod schema and a database constraint.
4. Delete is a soft delete. Restoring is manual SQL (README).
5. Published changes show on the public site within a minute.
6. Every profile shows the "Independently researched... Not a sponsored listing" note.
7. No em-dashes in site copy (client preference).
8. No new paid services. The project runs on free tiers.

### Where the documents and the code disagree

- **Profile field names.** The plan lists "How they can help / Who should explore / History". The app now shows "Worth exploring / People to know / Getting started", plus a links list. The database columns kept the old names. See section 5.
- **`BUILD_SPEC.md`** says the admin panel is out of scope and Supabase holds subscribers only. Both are no longer true.
- **The README** says the service-role client is for the subscribe form and cron only. It is also used for the password-reset lookup.

### Not verifiable from the repository

- Whether tickets CMS-08, CMS-11 and CMS-27 to CMS-30 (invite Paul, seed SCORE, testing, admin guide, walkthrough, release) are done.
- What is in the live database, who the admins are, and whether every migration has been applied.
- Supabase dashboard settings: sign-up disabled, SMTP, email templates.
- Paul's answers to the open questions in the CMS plan.
- Whether showing BI101 as an "Upcoming workshop" after Oct 21, 2026 is intended. No code handles a past event.

---

## 2. Architecture

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
                         └─────────────────────────────────────────────────────────────┘
  Visitor ──"Register"──▶ Eventbrite (a link only)
```

### Stack

| Library | Why it is here | Where |
|---|---|---|
| `next` 16 (App Router) | Routing, rendering, Server Actions, images | Everywhere |
| `react` 19 | UI; `useActionState` and `cache()` | Components, `lib/auth.ts`, `lib/content` |
| `@supabase/supabase-js` | Database, auth and storage client | `src/lib/supabase/` |
| `@supabase/ssr` | Cookie-based sessions on the server | `server.ts`, `session.ts` |
| `zod` 4 | Validation and error messages | Each feature's `schema.ts` |
| `server-only` | Fails the build if server code reaches the browser | Top of every server module |
| `@vercel/analytics` | Page views on public pages | `site-shell.tsx` |
| `tailwindcss` 4 | Styling; tokens in the `@theme` block of `globals.css` | Class names |

There is no UI kit, form library, ORM, state library or test framework.

### Frontend

- Server Components by default. Only 15 files are client components: the forms, the two mobile menus, and the reorder and delete controls.
- Three layout trees under `src/app/layout.tsx`:

| Route group | Shell | For |
|---|---|---|
| `(site)` | Header, footer, announcement bar, analytics | Public pages |
| `(site-preview)` | Public look, admin-gated, no analytics | `/preview/profiles/[id]` |
| `admin` | Sidebar when logged in, plain header otherwise | The CMS |

- State: the server, `useActionState` in forms, and local `useState` for UI. Success messages travel as query strings (`?saved=1`).

### Backend

Server Actions are the API. Each feature folder has the same shape:

```
src/features/<feature>/
  schema.ts       zod rules, shared by form and server
  actions.ts      "use server" entry points
  repository.ts   database writes
  queries.ts      database reads
  *.tsx           UI
```

`src/proxy.ts` (Next.js 16's middleware) redirects `/bi101` casings to `/BI101`, lowercases profile slugs, and refreshes the admin session cookie on `/admin` and `/preview`. It is not the access check.

### Two content pipelines

| | Code content | Database content |
|---|---|---|
| What | Home, About, BI101, Library Intelligence, reviews, nav, labels | Profiles |
| Stored in | `src/content/*.ts` | Supabase `profiles` |
| Read through | `src/lib/content/index.ts` | `src/features/profiles/queries.ts` |
| Changed by | Developer and deploy | Admin in `/admin` |
| Rendering | Static at build | Cached 30 seconds, invalidated on save |

The `ContentSource` interface was designed for a CMS to replace the local files. The CMS was built beside it instead: profiles do not go through `ContentSource`.

### The three Supabase clients

| Client | File | Acts as | Used for |
|---|---|---|---|
| Public | `lib/supabase/public.ts` | Anonymous visitor | Cached public profile reads |
| Server | `lib/supabase/server.ts` | The logged-in admin (from cookies) | Everything in `/admin`, logo uploads |
| Admin | `lib/supabase/admin.ts` | Service role, bypasses RLS | Subscribe insert, keep-alive, password-reset lookup |

Choosing the wrong one is a security bug.

### Caching

- Public profile reads use `unstable_cache` with tag `profiles`, 30-second lifetime.
- Admin actions call `updateTag("profiles")` after any change that affects the public site.
- Code-content pages are static until the next deploy. Admin reads are never cached.

### Environment variables

| Variable | In the browser | Needed for |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | All Supabase access |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Profiles, admin login |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | Subscribe, cron, password reset |
| `RESEND_API_KEY` | No | Subscriber notification |
| `CRON_SECRET` | No | Keep-alive endpoint |
| `SUBSCRIBE_NOTIFY_EMAIL`, `RESEND_FROM_EMAIL`, `GOOGLE_SITE_VERIFICATION` | No | Optional |

Without the Supabase variables the static pages still work, profiles show the empty message, and the subscribe form shows a friendly error.

---

## 3. Repository structure

Imports flow downward only:

```
src/app/         routes          thin: fetch, check access, compose
src/features/    business logic
src/components/  presentation
src/lib/         infrastructure
src/content/     data            imported only by lib/content/sources/local.ts
```

### Top level

| Path | What it is | Note |
|---|---|---|
| `supabase/migrations/` | The schema, 7 SQL files | Applied by hand, in filename order |
| `supabase/templates/` | Invite and reset email HTML | Must be pasted into the Supabase dashboard |
| `docs/` | Specs, mockups, the BI101 QR code | |
| `public/email/` | Images linked from sent emails | Don't rename |
| `next.config.ts` | 3 MB Server Action limit, image host, `BUILT_AT` | |
| `vercel.json` | The hourly cron | |

There are no tests and no CI configuration.

### Key files

| File | Responsibility | Careful |
|---|---|---|
| `src/proxy.ts` | Redirects and session refresh | Has a `matcher`; new gated or redirected URLs must be added to it |
| `src/lib/auth.ts` | `getAdmin()`, `requireAdmin()` | Call `requireAdmin()` first in every admin page and action |
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

### Where to change things

| Task | Files |
|---|---|
| Homepage or About wording | `src/content/pages.ts` |
| Navigation | `src/content/site.ts` |
| Add a workshop | `src/content/events.ts`, a route using `<EventPage>`, `site.featuredEventSlug`, and `CANONICAL_PATHS` in `proxy.ts` if the URL is printed |
| Add a profile field | New migration, then `schema.ts`, `repository.ts`, `queries.ts`, `admin-queries.ts`, `types.ts`, `profile-form.tsx`, `profile-article.tsx` |
| Change publish requirements | New migration for the constraint, plus `PUBLISH_FIELDS` |
| Add an admin module | `modules.ts`, a new `features/<name>/`, pages under `admin/(protected)/`, a migration with RLS and explicit grants |
| Change the logo size limit | Bucket migration, `LOGO_MAX_BYTES`, `bodySizeLimit` in `next.config.ts` |
| Rename `/who-can-help` | `PROFILES_PATH` in `queries.ts`, the `proxy.ts` matcher, `site.ts` nav, and the route folder |
| Change invite or reset email | `supabase/templates/`, then paste into the dashboard |

---

## 4. Request flows

### Static page (homepage)

Built at deploy time. `page.tsx` calls `getPage("home")` → `lib/content` → `src/content/pages.ts`. No database access. Changing it means editing a content file and deploying.

### Public profile page

`GET /who-can-help/<slug>`

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
4. `addSubscriber()` inserts with the service role. A duplicate email (Postgres `23505`) becomes the result `"duplicate"`, shown as "You're already on the list".
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

In the database, the single `UPDATE` passes through RLS (`is_admin()`), the audit trigger, the unique slug index and the completeness constraint.

`repository.ts` turns database refusals into results:

| Postgres code | Result | Shown as |
|---|---|---|
| `23505` | `duplicate-slug` | Error on the Page address field |
| `23514` on `profiles_published_complete` | `incomplete` | "Needed to publish" or "Needed while the profile is published" |
| No row updated | `not-found` | "This profile no longer exists..." |
| Anything else | throws | "The profile couldn't be saved..." |

### Error handling

| Tier | Mechanism | User sees |
|---|---|---|
| User-caused | Action returns state | Inline field errors, values preserved |
| System-caused during a write | Action catches and logs with a prefix | A plain message |
| Unexpected while rendering an admin page | `src/app/admin/error.tsx` | "Something went wrong" with Try again |
| Not found | `notFound()` | The nearest `not-found.tsx` |

Conventions:

- Actions return state for expected failures and redirect on success. `redirect()` is always called outside `try` blocks.
- Server logs are prefixed: `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[profiles]`, `[keep-alive]`.
- There is no `error.tsx` for the public site.

---

## 5. Database

PostgreSQL on Supabase. No ORM and no generated types; row shapes are hand-written TypeScript.

```
 auth.users ──1:1 (cascade)──▶ public.admins ◀──N:1 (set null)── public.profiles.updated_by
 auth.sessions  (read by private.is_admin())      public.profiles.logo_path ─ ─▶ storage: profile-logos

 public.subscribers   public.keep_alive           (standalone)
```

### Tables

**`subscribers`**: `id`, `first_name` (1 to 100), `email` (≤ 254), `zip` (5 digits), `source`, `created_at`. Unique index on `lower(email)`. RLS on with no policies, so only the service role can touch it. The app only inserts; the list is read in the Supabase dashboard.

**`keep_alive`**: `id`, `source`, `pinged_at`. Written hourly by the cron route, which prunes rows older than 30 days.

**`admins`**: `user_id` (PK, FK to `auth.users`, cascade), `email`, `created_at`. Readable by admins only. Not writable through the API; managed in the SQL editor. `email` is a copy and does not follow a changed auth email.

**`profiles`**

| Column | Shown as | Rules |
|---|---|---|
| `id` | | uuid PK |
| `name` | Organization name | 1 to 200 |
| `slug` | Page address | lowercase words joined by hyphens, ≤ 100 |
| `tagline` | Tagline | ≤ 300 |
| `intro` | Introduction | ≤ 20,000 |
| `how_they_help` | **Worth exploring** | ≤ 20,000 |
| `who_should_explore` | **People to know** | ≤ 20,000 |
| `history` | **Getting started** | ≤ 20,000 |
| `links` | Official sources / useful links | `text[]`, ≤ 10 |
| `contact_name`, `contact_role`, `contact_email`, `contact_phone` | Point of contact | optional |
| `website_url` | Website | http(s) |
| `logo_path` | Logo | filename in the bucket |
| `status` | | `draft` or `published` |
| `display_order` | List position | identity; new rows go last |
| `created_at`, `updated_at`, `updated_by` | | set by trigger |
| `deleted_at` | | non-null means soft-deleted |

**The column-name mapping** is in three places that must change together:

| Code name | Column | Mapped in |
|---|---|---|
| `worthExploring` | `how_they_help` | `repository.ts` `toRow()` |
| `peopleToKnow` | `who_should_explore` | `queries.ts` `toProfile()` |
| `gettingStarted` | `history` | `admin-queries.ts` `toAdminProfile()` |

**Constraints, index and trigger**

- `profiles_published_complete`: a published row needs tagline, intro, how_they_help, who_should_explore, history and website_url.
- `profiles_slug_key`: unique on `slug` where `deleted_at is null`. A deleted profile frees its address, which is why a restore can collide.
- `profiles_links_limits`: at most 10 links.
- Trigger `profiles_stamp_edit`: sets `updated_at` and `updated_by` from the session and protects `created_at`.

### Access control

Two gates, both must pass.

**Grants**

| Table | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `profiles` | select | select, insert, update | all |
| `admins` | none | select | all |
| `keep_alive` | none | none | select, insert, delete |

Nobody but the service role has `delete` on `profiles`, and the app never uses it.

**RLS policies**

| Table | Rule |
|---|---|
| `profiles` | Anyone reads rows that are published and not deleted; admins read, insert and update all |
| `admins` | Admins read |
| `storage.objects` (bucket `profile-logos`) | Admins list, upload, replace and remove |

**`private.is_admin()`** is true when the caller is in `admins` and the session named in their token still exists. It is `security definer` (so it can read `admins` without recursing through its own policy) and lives in a schema the API doesn't expose. The session check means a copied token stops working at logout.

### Storage

Bucket `profile-logos`: public read; PNG, JPEG or WebP; 2 MB. Files get a random UUID name. There is no foreign key between a row and its file; `actions.ts` keeps them in step and can occasionally leave an orphan.

### Operations done by hand

- Applying migrations and email templates.
- Adding and removing admins.
- Restoring a deleted profile.
- Reading or exporting subscribers.

### Things to be aware of

- **`subscribers` has no explicit grants.** Later migrations say Supabase stopped granting new tables automatically from Oct 30, 2026. If so, that migration would need a `grant` to `service_role` on a fresh project. Test before rebuilding the database.
- Reordering is several updates, not one transaction.
- Soft-deleted rows and their logos are never purged.
- Subscriber data is personal data with no deletion or export path in the app.
- There is no seed data; a fresh database has no profiles.
- Length limits are duplicated between `schema.ts` and the migrations.

---

## 6. API and integrations

There is one HTTP endpoint and ten Server Actions. Server Actions have no stable URL, but anyone who can load the page can invoke them, so each one checks access and input itself.

### `GET /api/cron/keep-alive`

Called hourly by Vercel Cron with `Authorization: Bearer <CRON_SECRET>`. Inserts a row into `keep_alive` and prunes old rows; falls back to a read of `subscribers` if the insert fails.

| Status | When |
|---|---|
| 200 `{ ok: true, mode: "write" \| "read", ... }` | Success |
| 401 | Wrong or missing secret |
| 500 "Not configured" | `CRON_SECRET` not set |
| 500 "Database query failed" | Supabase unreachable |

### Server Actions

| Action | File | Access | Input | Success | Failure |
|---|---|---|---|---|---|
| `subscribe` | `features/subscribe/actions.ts` | Public; honeypot, rate limit | `firstName`, `email`, `zip` | `{ status: "success", message }` | `{ status: "error", message, fieldErrors, values }` |
| `login` | `features/admin-auth/actions.ts` | Public; rate limit | `email`, `password` | Redirect to `/admin` | `{ error, email }` |
| `logout` | same | | none | Redirect to `/admin/login` | |
| `requestPasswordReset` | same | Public; rate limit | `email` | `{ sent: true }` whether or not an email went out | `{ error }` for a malformed email or rate limit |
| `setPassword` | same | Email token, or an admin session | `password` (10 to 72), `confirm`, `tokenHash`, `type` | Redirect to `/admin` | `{ error, expired }` or `{ error, codeUsed }` |
| `createProfile` | `features/profiles/actions.ts` | Admin | Profile fields, `intent`, `logo` | Redirect to the profile | `{ values, fieldErrors, message }` |
| `updateProfile(id)` | same | Admin | Same, plus `removeLogo` | Redirect with `?saved`, `?published` or `?hidden` | Same |
| `deleteProfile(id)` | same | Admin | none | Redirect to the list | `{ message }` |
| `moveProfile(id, direction)` | same | Admin | `"up"` or `"down"` | `{ position, total }` | `{ error }` |

Login returns the same message for an unknown email and a wrong password. Password reset always reports success, so a broken email setup shows only in the logs under `[reset]`.

### Profile field rules

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

### Integrations

| Service | Responsibility | Configured in |
|---|---|---|
| Supabase | Database, admin identity, password emails, logo files | Env vars, migrations; and in the dashboard: sign-up off, Site URL, SMTP, email templates, the `admins` rows |
| Resend (HTTP API) | New-subscriber email to the team | `RESEND_API_KEY`, `SUBSCRIBE_NOTIFY_EMAIL`, `RESEND_FROM_EMAIL` |
| Resend (SMTP) | Invite and reset emails, sent by Supabase Auth | Supabase dashboard only |
| Vercel | Hosting, deploys from `main`, cron, analytics | Project settings, `vercel.json` |
| Eventbrite | Workshop registration | A link in `src/content/events.ts`; no data integration |
| Google | Fonts (downloaded at build), Search Console verification, structured data | `GOOGLE_SITE_VERIFICATION` |

Invite and reset links are built from Supabase's Site URL, so they always open the production site, even when triggered from a preview or local environment.

Not present: payments, error tracking, an email marketing tool, captcha.

---

## 7. Authentication and security

Only admins authenticate. Visitors never log in, and there is no registration: accounts are created by invitation from the Supabase dashboard.

### Who does what

| Concern | Handled by |
|---|---|
| Password storage and hashing (bcrypt) | Supabase Auth; the app never sees a hash |
| Sessions and tokens | Supabase Auth, held in cookies by `@supabase/ssr` |
| One-time codes for invite and reset | Supabase Auth generates and emails them (through Resend SMTP) |
| "Is this user an admin?" | The `admins` table, checked by `getAdmin()` in the app and `private.is_admin()` in the database |

### Flows

**Login** (`login()` in `src/features/admin-auth/actions.ts`): validate → rate limit → `signInWithPassword` → look up own row in `admins` → if absent, sign out and refuse → redirect to `/admin`.

**Session:** a short-lived access token (JWT) plus a refresh token, in cookies. `proxy.ts` calls `refreshSession()` on `/admin` and `/preview` requests to renew an expired token before the page renders, because Server Components can't write cookies.

**Access check on every request:** `requireAdmin()` → `getAdmin()`:

1. `supabase.auth.getUser()` asks Supabase Auth over the network, so a logged-out session is rejected at once. (`getClaims()` would only check the token's signature.)
2. Select the user's own row from `admins`. RLS shows that table to admins only, so finding the row is the check.

`getAdmin` is wrapped in React `cache()`, so the layout, page and metadata share one check per request.

**Invite:** created in the Supabase dashboard, then the user is added to `admins` by SQL. The email links to `/admin/set-password?token_hash=...&type=invite`.

**Forgot password** (`requestPasswordReset()`): service-role lookup of the email in `admins`; only if found, `resetPasswordForEmail`. The response is the same either way.

**Set password** (`setPassword()`): the one-time code is verified only when the form is submitted, never when the page opens, so email link scanners can't use it up. After `verifyOtp` the admin check runs again. If the code was consumed but the password was rejected, the form retries using the new session (`codeUsed`). The page sets `referrer: no-referrer` because its URL holds the code.

**Logout:** `signOut({ scope: "local" })` ends the session on this device only. Because `is_admin()` requires the session to exist, a copied token stops working against the Supabase API at the same moment.

**Removing an admin:** deleting their `admins` row takes effect on their next request, even if they are still logged in.

### Layers of protection for admin data

| Layer | Where | Stops |
|---|---|---|
| Route layout | `admin/(protected)/layout.tsx` | Direct links while logged out |
| Page and action | `requireAdmin()` at the top of each | Client-side navigation and direct action calls |
| Database | RLS with `private.is_admin()` | Anyone calling the Supabase API directly |
| Build | `import "server-only"` | Server code or the service key reaching the browser |

### What is done well

- Access is enforced in the database, not only in the app.
- Uniform responses on login and reset don't reveal who is an admin.
- The service-role key is used in three narrow places and guarded by `server-only`.
- Uploads are checked by file signature; SVG is refused; filenames are random.
- Admin-typed text is rendered as React elements with a link-scheme allow-list; JSON-LD is escaped.
- Website and link fields reject non-http schemes and embedded credentials.
- `/admin` and `/preview` are excluded from search engines and analytics.

### Concerns

| # | Concern | Detail |
|---|---|---|
| 1 | Outdated dependencies with published advisories | `npm audit` (Nov 2026) reports `next` 16.3.6 as critical and `zod`, `sharp`, `source-map-js` as high. Several of the Next.js advisories concern self-hosting or `use cache`, which this project doesn't use, so real exposure needs assessing per advisory. The fix for `next` (16.4.6) is outside the pinned version |
| 2 | Rate limiting is best effort | In-memory per serverless instance; keyed on `x-forwarded-for`. Real brute-force protection depends on Supabase Auth's own limits |
| 3 | No multi-factor authentication | A single password protects the ability to publish to the public site |
| 4 | No security headers | `next.config.ts` sets no Content-Security-Policy or frame-ancestors rule, so the admin could be framed by another site |
| 5 | Session cookies may be readable by scripts | `server.ts` passes no cookie options, and `@supabase/ssr` does not default to `HttpOnly`. Check in browser dev tools. No script-injection path was found, which limits the risk |
| 6 | Logout is per device | There is no "log out everywhere"; a lost device stays logged in until its session is revoked in Supabase |
| 7 | Silent reset failures | By design, a broken email setup looks like success to the user |
| 8 | `admins.email` is a copy | If an auth email changes, the reset lookup no longer matches |
| 9 | No audit trail | Only the last editor of a profile is recorded; logins and deletions are not logged |
| 10 | Subscriber form has no captcha | Honeypot and the best-effort rate limit only |
| 11 | Security-relevant settings live only in dashboards | Sign-up disabled, password rules, SMTP, Site URL. Even with sign-up enabled, a new account would not be an admin |

---

## 8. Development workflow

### Requirements

- Node.js 20.9 or newer (required by Next.js 16) and npm. No version file is pinned in the repo.
- Access to the Supabase project, the Vercel project `junto-community`, and the GitHub repo `JuntoHome/Junto-Community`.
- Optional: the Supabase CLI, only if you prefer `supabase db push` to pasting SQL.

### Local setup

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run dev                    # http://localhost:3000
```

| To work on | You need in `.env.local` |
|---|---|
| Static pages only | Nothing |
| Public profiles, admin login | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Subscribe form, password reset, keep-alive | Also `SUPABASE_SERVICE_ROLE_KEY` |
| Subscriber notification email | Also `RESEND_API_KEY` |
| Keep-alive endpoint | Also `CRON_SECRET` (any string locally) |

Values come from Supabase (Project Settings → API Keys) and from the Vercel project's environment variables.

**There is one Supabase project.** Nothing in the repo sets up a local or staging database, so local development and Vercel previews read and write production data unless you point `.env.local` at a separate project of your own. Signing up through a local subscribe form creates a real subscriber and emails the team.

### Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js rules) |
| `npm run build` | Production build; also type-checks and pre-renders pages |
| `npm run start` | Serve the production build locally |

There are no automated tests. Before pushing, run `typecheck`, `lint` and `build`, then check the change by hand.

### Debugging

| Symptom | Look at |
|---|---|
| A write fails with a generic message | Server logs for the prefix: `[profiles]`, `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[keep-alive]`. Locally that is the `npm run dev` terminal; in production, Vercel → Project → Logs |
| Admin page shows "Something went wrong" | The thrown error in the same logs; usually Supabase unreachable or a missing variable |
| Redirected to login repeatedly | Is the user in `admins`? Are the two public Supabase variables set? |
| A profile is not on the public site | Its status; then wait 30 seconds (cache); then the published-and-not-deleted filter |
| A database refusal | Supabase → Logs, and compare the live schema with `supabase/migrations/` |
| Reset or invite email missing | `[reset]` log, Supabase Auth logs, then Resend's dashboard |
| Subscriber email missing | `RESEND_API_KEY` set? `[subscribe]` log, then Resend |

### Testing the endpoints

The cron endpoint is the only one you can call directly:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/keep-alive
```

Server Actions are tested through the UI. To check the database rules, call Supabase's REST API as an anonymous visitor; drafts must not come back:

```bash
curl "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/profiles?select=name,status" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```

### Database changes

1. Add a new file in `supabase/migrations/` named `YYYYMMDDHHMMSS_what_it_does.sql`. Never edit one that has been applied.
2. Write it to be safe to re-run (`if not exists`, `drop ... if exists`), wrap multi-step changes in `begin; ... commit;`, and include RLS and explicit grants for any new table.
3. If it tightens a rule, check existing rows first and stop with a clear message (see `20261103010000_profiles_follow_paul_structure.sql`).
4. Apply it in the Supabase SQL editor, or with `supabase db push`.
5. Order matters: apply a migration that adds something before deploying the code that uses it; remove code that uses something before dropping it.

### Deploying

- A push to `main` deploys to production on Vercel. There is no CI and no approval step; the Vercel build is the only gate.
- A push to any other branch gets a preview URL, using the Preview environment variables.
- Roll back from Vercel → Deployments by promoting an earlier deployment. A database change is not rolled back with it.
- Email template changes are pasted into Supabase → Authentication → Emails → Templates.

### Git

The history so far is linear: every commit is directly on `main`, with no merge commits or pull requests, by one author. `dev` points at the same commit as `main`. Commit subjects are short imperative sentences describing the visible change, with the ticket in brackets, for example `Publish and hide profiles, with publish-time checks (CMS-19, CMS-20)`.

**Current working branch: `translator`.** For the current work, `translator` is the base branch, not `main` or `dev`:

- Create every new branch from `translator`.
- Do not create branches from `main` or `dev`, and do not commit to them directly.
- Open pull requests against `translator`.
- `main` still deploys to production, so nothing reaches it except a deliberate merge of finished work.

```bash
git fetch origin
git switch translator
git pull
git switch -c <your-branch-name>
```

The routine for a change:

1. Branch from `translator`.
2. Make the change; run `typecheck`, `lint` and `build`.
3. Push the branch and test on its Vercel preview URL (remembering it uses the live database).
4. Open a pull request against `translator` and review it.
5. Apply any migration, then merge and check the result on the preview.

### Checklist for a change

- New admin page or action: `requireAdmin()` first.
- New table: RLS on, policies, explicit grants.
- New profile field: all the files listed in section 3.
- New public page: add it to `src/app/sitemap.ts`.
- New variable: `.env.example`, Vercel Production and Preview.
- Site copy: no em-dashes.
- Never touch the `/BI101` route.

---

## 9. Known issues and technical debt

A review as of November 2026. Nothing here has been fixed; this section records the state of the system. Items marked "by design" are trade-offs the code comments acknowledge.

### Fix or decide soon

| Issue | Evidence | Impact |
|---|---|---|
| Dependencies with published advisories | `npm audit`: `next` 16.3.6 critical; `zod`, `sharp`, `source-map-js` high. `next` is pinned, so the fix (16.4.6) needs a deliberate upgrade | Exposure varies by advisory; needs assessing |
| The workshop is over but the site still promotes it | BI101 was Oct 21, 2026. The announcement bar, "Upcoming workshop" labels, Register buttons and Event JSON-LD have no date logic | Visitors are invited to register for a past event |
| One database for everything | No local or staging Supabase project | Local and preview testing changes production data |
| No automated tests, no CI | No test files or workflow config | Every change is verified by hand; `main` deploys directly |

### Incomplete features

- Only profiles are editable in the admin; all other content needs a deploy.
- Four planned admin modules and the Data Axle Translator are not started.
- BI101's online platform is still `PENDING`.
- "Who Can Help?" wording is still marked as a draft.
- No admin screens for subscribers, for managing admins, or for restoring deleted profiles; all three are manual SQL.
- No unsubscribe or deletion path for subscribers.
- The admin guide for Paul (CMS-28) is not in the repo.
- No workshop archive or generic `/workshops/[slug]` route; `/BI101` is a single hard-wired page.

### Correctness risks

| Risk | Where | Note |
|---|---|---|
| Reordering is not atomic | `repository.ts` `moveInOrder()` | Several updates, no transaction. By design: ties are repaired on the next move. Two admins reordering at once can still interleave |
| Last write wins | `updateProfileFields()` | Two admins editing the same profile overwrite each other silently |
| Changing a published profile's address breaks its old URL | `profile-form.tsx` | The address stops following the name once published, but can still be edited by hand, and no redirect is kept |
| Orphaned logo files | `actions.ts` | A failure between upload and save leaves a file behind. By design |
| `subscribers` migration has no grants | `20260926000000_create_subscribers.sql` | May fail on a fresh Supabase project (see section 5) |
| No error page for the public site | `src/app/(site)/` has no `error.tsx` | A failed profile query on a cache miss shows the framework's default error |

### Security

See section 7. In short: best-effort rate limiting, no multi-factor authentication, no security headers, per-device logout, silent password-reset failures, no audit trail, no captcha.

### Performance

Nothing is slow at the current scale. Things to watch:

- **Large source images.** `public/images/home/hero.png` is 1.7 MB and each logo PNG is about 1 MB. `next/image` resizes them for visitors, but the logo is also used for the Open Graph image.
- **`getAdmin()` makes two network calls** (Auth, then `admins`) on every admin request. Correct, but it adds latency to each page.
- **Reordering loads every profile** and writes rows one by one. Fine for tens of profiles.
- **No pagination** on the public overview or the admin list.
- **`unstable_cache`** is not a stable Next.js API and may change on upgrade.

### Duplication and structure

| What | Where |
|---|---|
| Column-to-field mapping, written three times | `repository.ts`, `queries.ts`, `admin-queries.ts` |
| Database column names that no longer match their meaning | `how_they_help`, `who_should_explore`, `history` |
| Limits and publish rules in both TypeScript and SQL | `schema.ts` and the migrations |
| The slug pattern, in four places | `slug.ts`, the profile page, the `proxy.ts` matcher, the migration |
| The link pattern, twice | `links.ts` and `rich-text.tsx` |
| Two near-identical queries | `getProfileForAdmin` and `getProfilePreview` |
| Two similar mobile menus | `layout/mobile-menu.tsx` and `admin/admin-menu.tsx` |
| A 650-line form component | `profile-form.tsx` |
| A content abstraction the CMS bypasses | `lib/content` `ContentSource` has one implementation; profiles don't use it |
| Hand-written row types cast with `as` | No generated Supabase types, so a schema change is not caught by the compiler |

### Configuration and operations

- Migrations and email templates are applied by hand; nothing records what the live project has.
- Important settings exist only in the Supabase and Vercel dashboards.
- No error tracking or uptime monitoring; failures are found by reading logs.
- The site depends on an hourly cron to stop the free Supabase project pausing. If the cron stops, the database pauses after about a week.
- Backups are whatever the Supabase plan provides; the release ticket that checks them (CMS-30) is unconfirmed.
- The `dev` branch is unused and identical to `main`. New work branches from `translator` (section 8).
- Soft-deleted profiles and their logos are never purged.

### Documentation drift

- The README's first paragraph describes Phase 1 only, and says the service-role client is for the subscribe form and cron only.
- `BUILD_SPEC.md` predates the admin area and the homepage redesign.
- `JCA_CMS_Plan.md` lists the original profile fields, not the current ones.
- `site.copyright` is a fixed "© 2026".
- One lint warning: an `<img>` in `src/app/opengraph-image.tsx` (expected there; `next/image` can't be used in image generation).

---

## 10. Feature walkthroughs

For each feature: what it is for, the files, how it runs, a worked example, what tends to go wrong, and what to change. Sections 4 to 7 hold the detailed flows; this section is the practical view.

### 10.1 Writing and publishing a profile

**Purpose.** Let the JCA team publish a researched page about an organization without a developer.

**Files.** `features/profiles/`: `profile-form.tsx`, `schema.ts`, `actions.ts`, `repository.ts`, `logo-storage.ts`, `slug.ts`. Pages: `admin/(protected)/profiles/new/page.tsx` and `[id]/page.tsx`.

**How the form works** (`profile-form.tsx`)

- `useActionState(action, { values: initialValues })` holds the last server result. Inputs use `defaultValue={values[...]}`, so after a failed save the server's echo of what was typed refills the form.
- The three buttons share `name="intent"` with values `save`, `publish` or `hide`. The clicked one's value travels in the form data; `readIntent()` on the server treats anything unknown as `save`.
- The page address follows the name as you type (`slugify`) until it is edited by hand or the profile is published.
- A chosen logo is kept in React state, not in the file input, so it survives a failed save. `submit()` adds it to the form data as `logo`, or sets `removeLogo=1`.
- A live checklist counts the filled "Needed to publish" fields.
- After a failed save, focus moves to an error summary that links to each field.
- The edit page renders the form with `key={profile.updatedAt}`, so every successful save remounts it with fresh values.

**Worked example.** Name "SCORE Greater Phoenix" gives the address `score-greater-phoenix`. Click **Save draft** with only the name: allowed, status `draft`. Click **Publish** with an empty tagline: `check()` returns `fieldErrors.tagline = "Needed to publish."` plus a summary, and nothing is written. Fill everything and publish: the row is updated to status `published`, the `profiles` cache tag is invalidated, and the page reloads with "Published. It's on the public site now."

**Common problems**

| Symptom | Likely cause | Check |
|---|---|---|
| "Another profile already uses this address" | `profiles_slug_key` | A live profile with that slug; deleted ones don't count |
| "Needed while the profile is published" on Save | A required field was emptied on a published profile | Fill it, or Hide first |
| "The profile couldn't be saved" | Unexpected database error | `[profiles] update failed` in the logs |
| "The logo couldn't be uploaded" | Storage policy or bucket limits | `[profiles] logo upload failed`; is the session still valid? |
| A large logo fails before reaching the server | Body over the 3 MB Server Action limit | `next.config.ts` `bodySizeLimit` |
| Form shows old values after save | The `key` on `ProfileForm` was removed or changed | `[id]/page.tsx` |

**To change.** Field rules: `schema.ts` (and the migration's checks). Labels: `PROFILE_LABELS`. Messages: the constants at the top of `actions.ts`. Layout of the form: `profile-form.tsx`.

### 10.2 Showing profiles to the public

**Purpose.** A fast, indexable directory: an overview and one page per organization.

**Files.** `app/(site)/who-can-help/page.tsx` and `[slug]/page.tsx`, `features/profiles/queries.ts`, `profile-article.tsx`, `profile-card.tsx`, `text.ts`, `links.ts`, `components/ui/rich-text.tsx`, `content/who-can-help.ts`.

**How text becomes a page.** An admin types plain text. `toBlocks()` splits it: a blank line starts a paragraph, a line starting `- ` is a bullet. `RichTextBlocks` renders the blocks, and `renderInline()` handles `**bold**`, `*italic*` and `[label](url)`.

```
Free mentoring from experienced owners.

- One-to-one sessions
- **Workshops** every month
```

becomes one paragraph and a two-item list with "Workshops" in bold.

**Page order** (`ProfileArticle`): logo, name, tagline, the not-sponsored note, introduction, Worth exploring, People to know, then a navy panel with Getting started, the website button and the point of contact, then the links list. Empty optional parts are left out. In a draft preview, empty required parts show a "not filled in" marker.

**Common problems**

| Symptom | Likely cause |
|---|---|
| A published profile returns 404 | Slug mismatch, or `deleted_at` is set |
| Change not visible | Up to 30 seconds of cache if it was changed outside the admin |
| Section heading is wrong | Headings come from `content/who-can-help.ts`, not the database |
| Logo doesn't show | `NEXT_PUBLIC_SUPABASE_URL` missing at build, so `next.config.ts` has no allowed image host |
| A link shows as plain text | Its scheme isn't http(s), mailto or tel |
| Bullets run together as a paragraph | No space after the dash |

**To change.** Layout: `profile-article.tsx`. Headings and notes: `content/who-can-help.ts`. Formatting rules: `text.ts` and `rich-text.tsx`. Cache time: `REVALIDATE_SECONDS` in `queries.ts` and the two pages' `revalidate` exports.

### 10.3 Reordering and deleting

**Files.** `move-buttons.tsx`, `delete-profile.tsx`, `admin-profile-list.tsx`, `actions.ts` (`moveProfile`, `deleteProfile`), `repository.ts` (`moveInOrder`, `softDeleteProfile`).

**Reorder.** `MoveButtons` calls `moveProfile(id, direction)` inside `useTransition`. The server swaps the profile with its neighbour by rewriting `display_order`, calls `refresh()` to re-render the list, and invalidates the public cache. The component then moves keyboard focus to follow the row and announces "Moved X to position 2 of 5".

**Delete.** A two-step confirmation in the page, then `softDeleteProfile()` sets `deleted_at`. The list page reads `?deleted=<id>` and shows the name. Restoring is manual SQL (README).

**Common problems.** Order looks wrong after an interrupted move: move any profile once and the numbers are repaired. A deleted profile's address is immediately reusable, which is what makes a later restore collide.

### 10.4 Joining the mailing list

**Purpose.** Collect first name, email and ZIP from interested visitors, and tell the team.

**Files.** `features/subscribe/`: `subscribe-form.tsx`, `schema.ts`, `actions.ts`, `repository.ts`, `notify.ts`. Shown by `components/sections/join-section.tsx`.

**Worked example.** `Maria`, `Maria@Example.com`, `85345`: the schema trims and lowercases the email, the row is inserted, the visitor sees "Welcome to the Junto!", and the team gets "New Junto subscriber: Maria (85345)" with reply-to set to her address. Submitting again gives "You're already on the list" and no second email.

**Common problems**

| Symptom | Likely cause |
|---|---|
| "Something went wrong on our end" | `SUPABASE_SERVICE_ROLE_KEY` missing or wrong; `[subscribe]` in the logs |
| Signups saved but no email | `RESEND_API_KEY` missing, or the sender domain isn't verified in Resend |
| "Too many attempts" for a real visitor | Several people behind one IP; 5 per 10 minutes |
| Success shown but no row | The honeypot field was filled (a browser extension or autofill can do this) |

**To change.** Fields: `schema.ts`, the `fields` list in `subscribe-form.tsx`, `repository.ts`, `notify.ts`, and a migration. Recipients: `SUBSCRIBE_NOTIFY_EMAIL`. Email wording: `notify.ts`.

### 10.5 Admin login and passwords

See section 7 for the flows.

**Common problems**

| Symptom | Likely cause |
|---|---|
| "This account doesn't have admin access" | The user exists in Auth but not in `admins` |
| Login works, then bounces back to login | Cookies not being set: check both public Supabase variables and that the request passes through `proxy.ts` |
| "This link has expired or was already used" | Links are single-use and time-limited (the form says to use a new one within the hour) |
| Invite link opens the live site from a test | Links use Supabase's Site URL |
| Email looks like Supabase's default | The template wasn't pasted into the dashboard |

**To change.** Wording: the constants in `admin-auth/actions.ts`. Password rules: `setPasswordSchema`, and Supabase's own settings. Email design: `supabase/templates/`.

### 10.6 The workshop page

**Purpose.** Send a visitor from a flyer to Eventbrite with as little friction as possible.

**Files.** `content/events.ts`, `content/people.ts`, `app/(site)/BI101/page.tsx`, `components/event/*`, `lib/format.ts`, `lib/seo.ts`, `components/layout/announcement-bar.tsx`.

**How it works.** One `Event` object drives the workshop page, the homepage summary, the announcement bar, the sitemap entry and the Event JSON-LD. Dates are stored once as ISO timestamps; `formatEventDates()` derives every display string in the event's own time zone.

**To change.** Details: `events.ts`. Which event the header and announcement bar promote: `featuredEventSlug` in `site.ts`. A second workshop: a new `Event`, a new route rendering `<EventPage>`, and `CANONICAL_PATHS` in `proxy.ts` if its URL is printed.

**Known gap.** Nothing compares the event's end time with today, so a past event is still shown as upcoming until the content is edited.

### 10.7 Keep-alive

**Purpose.** Stop the free Supabase project from pausing.

**Files.** `app/api/cron/keep-alive/route.ts`, `vercel.json`, the `keep_alive` table.

**Check it.** Vercel → Settings → Cron Jobs for run history; `select * from keep_alive order by pinged_at desc limit 5;` for the database's view; or call it by hand with the secret (section 8).

**Common problems.** 500 "Not configured": `CRON_SECRET` missing in Vercel. 401: the secret differs between Vercel and the caller. `mode: "read"` in the response: the `keep_alive` table is missing.

### 10.8 Recipe: add a field to profiles

Example: an optional "Hours" line.

1. **Migration:** `alter table public.profiles add column if not exists hours text check (char_length(hours) <= 200);` Apply it first.
2. **`schema.ts`:** add `hours: text(200)` to `profileDraftSchema` and a label in `PROFILE_LABELS`. `PROFILE_FIELDS` and the form-value types update themselves.
3. **`repository.ts`:** add `hours: orNull(input.hours)` to `toRow()`.
4. **`queries.ts`:** add `hours` to `COLUMNS`, `ProfileRow` and `toProfile()`.
5. **`admin-queries.ts`:** add it to `DETAIL_COLUMNS`, `DetailRow` and `toAdminProfile()`.
6. **`types.ts`:** add it to `Profile`.
7. **`profile-form.tsx`:** add the input.
8. **`profile-article.tsx`:** show it, and leave it out when empty.
9. Run `typecheck`, `lint`, `build`; try a draft, a preview and a published profile.

If the field is required to publish, also add it to `PUBLISH_FIELDS` and to the `profiles_published_complete` constraint, with a check that no published row lacks it.

### 10.9 Recipe: add an admin module

Follow the profiles feature as the template:

1. Migration: table, RLS, policies using `private.is_admin()`, explicit grants, audit trigger if wanted.
2. `features/<name>/`: `schema.ts`, `repository.ts`, `admin-queries.ts`, `queries.ts` (cached, with its own tag), `actions.ts` (each action starts with `requireAdmin()`).
3. Pages under `app/admin/(protected)/<name>/`, each calling `requireAdmin()`.
4. Move the module from `plannedModules` to `adminModules` in `components/admin/modules.ts`.
5. Public pages under `app/(site)/`, plus `sitemap.ts`.
