# Database

PostgreSQL on Supabase, plus Supabase Auth and Storage. There is no ORM and there are no generated types; row shapes are hand-written TypeScript. The schema is defined by the SQL files in [supabase/migrations/](../supabase/migrations/). How to change it: [guides/DATABASE-MIGRATIONS.md](guides/DATABASE-MIGRATIONS.md).

> There is **one** Supabase project. Local development and Vercel previews use the production database unless you point `.env.local` at a project of your own.

## Relationships

```
 auth.users ──1:1 (cascade)──▶ public.admins ◀──N:1 (set null)── public.profiles.updated_by
 auth.sessions  (read by private.is_admin())      public.profiles.logo_path ─ ─▶ storage: profile-logos

 public.subscribers   public.keep_alive           (standalone)
```

The dashed line is not a foreign key: `logo_path` holds a filename, and the app keeps row and file in step.

## Tables

### `subscribers`

The mailing list.

| Column | Rule |
|---|---|
| `id` | uuid PK |
| `first_name` | 1 to 100 characters |
| `email` | ≤ 254; unique index `subscribers_email_key` on `lower(email)` |
| `zip` | 5 digits |
| `source` | default `website` |
| `created_at` | default `now()` |

RLS is on with no policies, so only the service role can touch it. The app only inserts; the list is read in the Supabase dashboard.

### `keep_alive`

`id`, `source` (`vercel-cron` or `manual`), `pinged_at`. Written hourly by the cron route, which prunes rows older than 30 days.

### `admins`

`user_id` (PK, FK to `auth.users`, on delete cascade), `email`, `created_at`. Readable by admins only. Not writable through the API; managed in the SQL editor. `email` is a copy and does not follow a changed auth email.

### `profiles`

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

**Column names that don't match their labels.** Three columns kept the names from the original plan. The mapping is written in three places that must change together:

| Code name | Column | Mapped in |
|---|---|---|
| `worthExploring` | `how_they_help` | `repository.ts` `toRow()` |
| `peopleToKnow` | `who_should_explore` | `queries.ts` `toProfile()` |
| `gettingStarted` | `history` | `admin-queries.ts` `toAdminProfile()` |

### Constraints, indexes and triggers

| Name | Table | Rule |
|---|---|---|
| `profiles_published_complete` | `profiles` | A published row needs tagline, intro, how_they_help, who_should_explore, history and website_url |
| `profiles_slug_key` | `profiles` | Unique `slug` where `deleted_at is null`. A deleted profile frees its address, so a restore can collide |
| `profiles_links_limits` | `profiles` | At most 10 links, at most 20,000 characters in total |
| `profiles_stamp_edit` (trigger) | `profiles` | Sets `updated_at` and `updated_by` from the session and protects `created_at` |
| `subscribers_email_key` | `subscribers` | Unique `lower(email)` |

## Access control

Two gates; both must pass.

### Grants

| Table | `anon` | `authenticated` | `service_role` |
|---|---|---|---|
| `profiles` | select | select, insert, update | all |
| `admins` | none | select | all |
| `keep_alive` | none | none | select, insert, delete |
| `subscribers` | no explicit grants (see [Things to be aware of](#things-to-be-aware-of)) | | |

Nobody but the service role has `delete` on `profiles`, and the app never uses it.

### Row level security

| Table | Rule |
|---|---|
| `profiles` | Anyone reads rows that are published and not deleted; admins read, insert and update all |
| `admins` | Admins read |
| `subscribers` | RLS on, no policies: service role only |
| `storage.objects` (bucket `profile-logos`) | Admins list, upload, replace and remove |

### `private.is_admin()`

True when the caller is in `admins` **and** the session named in their token still exists in `auth.sessions`. It is `security definer` (so it can read `admins` without recursing through its own policy) and lives in the `private` schema, which the API doesn't expose. The session check means a copied token stops working at logout.

## Storage

Bucket `profile-logos`: public read; PNG, JPEG or WebP; 2 MB. Files get a random UUID name. A failure between upload and save can occasionally leave an orphaned file.

## Data flow

| Data | Written by | Client used | Read by |
|---|---|---|---|
| `subscribers` | `subscribe` action | Service role | People with dashboard access |
| `keep_alive` | Cron route | Service role | Cron route (previous ping), dashboard |
| `admins` | SQL editor, by hand | | `getAdmin()`, `is_admin()`, reset lookup (service role) |
| `profiles` | Admin Server Actions | Server (as the admin) | Public pages (anonymous, cached), admin pages (server) |
| `profile-logos` | Admin Server Actions | Server (as the admin) | Anyone, through the public URL |
| Translator workbooks | Nothing: never leave the browser | | |

## Migrations

Applied by hand, in filename order. Nothing records which ones the live project has (**Unverified** that all are applied).

| File | What it does | Ticket |
|---|---|---|
| `20260926000000_create_subscribers.sql` | `subscribers` table, email index, RLS | Phase 1 |
| `20261023000000_create_keep_alive.sql` | `keep_alive` table and grants | Keep-alive |
| `20261028000000_create_admins.sql` | `admins`, `private` schema, `is_admin()`, policy | CMS-02 |
| `20261029000000_create_profiles.sql` | `profiles`, constraints, slug index, stamp trigger, grants, policies | CMS-09 |
| `20261029010000_create_profile_logos_bucket.sql` | `profile-logos` bucket and storage policies | CMS-10 |
| `20261103000000_end_admin_access_on_logout.sql` | `is_admin()` also requires a live session | CMS-26 |
| `20261103010000_profiles_follow_paul_structure.sql` | Column comments, `links` column, Getting started required to publish | Paul's structure |

## Things to be aware of

- **`subscribers` has no explicit grants.** Later migrations note that Supabase stopped granting new tables automatically from Oct 30, 2026. On a fresh project this migration may need a `grant` to `service_role`. Test before rebuilding the database.
- Reordering is several updates, not one transaction.
- Soft-deleted rows and their logos are never purged.
- Subscriber data is personal data with no deletion or export path in the app.
- There is no seed data; a fresh database has no profiles.
- Length limits are duplicated between `schema.ts` and the migrations.

Manual database tasks (adding admins, restoring profiles, reading subscribers) are in [guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md).
