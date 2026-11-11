# Features

What exists, how each feature works, and what is planned. Symptoms and fixes are in [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Status

### Built

| Feature | Location |
|---|---|
| Home, About, `/BI101` | `src/app/(site)/`, content in `src/content/` |
| Library Intelligence page | `src/content/library-intelligence.ts` |
| Book review page (`/reviews/[slug]`) | `src/content/reviews.ts` |
| Join the Junto form (first name, email, ZIP) | `src/features/subscribe/` |
| Email to the team on each new signup | `src/features/subscribe/notify.ts` |
| Admin login, logout, forgot password, invite | `src/features/admin-auth/` |
| Admin dashboard home and sidebar | `src/app/admin/(protected)/page.tsx`, `src/components/admin/` |
| Profile management: draft, publish, hide, soft delete, reorder, logo, preview | `src/features/profiles/` |
| Public profiles at `/who-can-help` and `/who-can-help/[slug]` | `src/app/(site)/who-can-help/` |
| Sitemap, robots, Open Graph image, JSON-LD | `src/app/sitemap.ts`, `src/lib/seo.ts` |
| Hourly Supabase keep-alive | `src/app/api/cron/keep-alive/route.ts` |

### Partly built

- Only profiles are managed in the admin. All other content is TypeScript in `src/content/` and needs a deploy to change.
- The BI101 online platform is still `null`, marked `PENDING` in `src/content/events.ts`.
- The "Who Can Help?" name and wording are drafts awaiting Paul's confirmation (`src/content/who-can-help.ts`).
- Subscribers, admins and deleted profiles have no admin screens; they are managed by hand ([guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md)).
- `/BI101` is a single hard-wired page. There is no workshop archive or generic `/workshops/[slug]` route.

### Planned

| Feature | Status |
|---|---|
| Data Axle Translator Phase 1 | In progress: spec, test data and tickets TR-01 to TR-35. See [translator/README.md](translator/README.md) and [TASKS.md](TASKS.md) |
| Events management and own registration (to replace Eventbrite) | Listed under "Coming later" in `src/components/admin/modules.ts`; no spec |
| Library Intelligence management | Same |
| Library Profiles | Same |
| Meeting Space Concierge | Same |

## How the features work

### Writing and publishing a profile

**Purpose.** Let the JCA team publish a researched page about an organization without a developer.

**Files.** `features/profiles/`: `profile-form.tsx`, `schema.ts`, `actions.ts`, `repository.ts`, `logo-storage.ts`, `slug.ts`. Pages: `admin/(protected)/profiles/new/page.tsx` and `[id]/page.tsx`.

**How the form works** (`profile-form.tsx`)

- `useActionState(action, { values: initialValues })` holds the last server result. Inputs use `defaultValue={values[...]}`, so after a failed save the server's echo of what was typed refills the form.
- The three buttons share `name="intent"` with values `save`, `publish` or `hide`. `readIntent()` on the server treats anything unknown as `save`.
- The page address follows the name as you type (`slugify`) until it is edited by hand or the profile is published.
- A chosen logo is kept in React state, not in the file input, so it survives a failed save. `submit()` adds it to the form data as `logo`, or sets `removeLogo=1`.
- A live checklist counts the filled "Needed to publish" fields.
- After a failed save, focus moves to an error summary that links to each field.
- The edit page renders the form with `key={profile.updatedAt}`, so every successful save remounts it with fresh values.

**Worked example.** Name "SCORE Greater Phoenix" gives the address `score-greater-phoenix`. **Save draft** with only the name is allowed and leaves status `draft`. **Publish** with an empty tagline returns "Needed to publish." on that field plus a summary, and nothing is written. With everything filled, Publish sets status `published`, invalidates the `profiles` cache tag, and reloads with "Published. It's on the public site now."

The step-by-step server flow is in [ARCHITECTURE.md](ARCHITECTURE.md#publishing-a-profile); field rules are in [API-DOCUMENTATION.md](API-DOCUMENTATION.md#profile-field-rules).

**To change.** Field rules: `schema.ts` and the migration's checks. Labels: `PROFILE_LABELS`. Messages: the constants at the top of `actions.ts`. Layout: `profile-form.tsx`. Adding a field: [the recipe](ARCHITECTURE.md#recipe-add-a-field-to-profiles).

### Showing profiles to the public

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

**To change.** Layout: `profile-article.tsx`. Headings and notes: `content/who-can-help.ts`. Formatting rules: `text.ts` and `rich-text.tsx`. Cache time: `REVALIDATE_SECONDS` in `queries.ts` and the two pages' `revalidate` exports.

### Reordering and deleting profiles

**Files.** `move-buttons.tsx`, `delete-profile.tsx`, `admin-profile-list.tsx`, `actions.ts` (`moveProfile`, `deleteProfile`), `repository.ts` (`moveInOrder`, `softDeleteProfile`).

**Reorder.** `MoveButtons` calls `moveProfile(id, direction)` inside `useTransition`. The server swaps the profile with its neighbour by rewriting `display_order`, calls `refresh()` to re-render the list, and invalidates the public cache. Focus follows the row and a screen-reader message announces "Moved X to position 2 of 5".

**Delete.** A two-step confirmation in the page, then `softDeleteProfile()` sets `deleted_at`. The list page reads `?deleted=<id>` and shows the name. A deleted profile's address is immediately reusable. Restoring: [guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md#restore-a-deleted-profile).

### Joining the mailing list

**Purpose.** Collect first name, email and ZIP from interested visitors, and tell the team.

**Files.** `features/subscribe/`: `subscribe-form.tsx`, `schema.ts`, `actions.ts`, `repository.ts`, `notify.ts`. Shown by `components/sections/join-section.tsx`.

**Worked example.** `Maria`, `Maria@Example.com`, `85345`: the schema trims and lowercases the email, the row is inserted, the visitor sees "Welcome to the Junto!", and the team gets "New Junto subscriber: Maria (85345)" with reply-to set to her address. Submitting again gives "You're already on the list" and no second email.

**To change.** Fields: `schema.ts`, the `fields` list in `subscribe-form.tsx`, `repository.ts`, `notify.ts`, and a migration. Recipients: `SUBSCRIBE_NOTIFY_EMAIL`. Email wording: `notify.ts`.

### Admin login and passwords

Login, invite, forgot password and set password are described in [AUTHENTICATION.md](AUTHENTICATION.md). Wording lives in the constants in `admin-auth/actions.ts`; email design in `supabase/templates/`.

### The workshop page

**Purpose.** Send a visitor from a flyer to Eventbrite with as little friction as possible.

**Files.** `content/events.ts`, `content/people.ts`, `app/(site)/BI101/page.tsx`, `components/event/*`, `lib/format.ts`, `lib/seo.ts`, `components/layout/announcement-bar.tsx`.

**How it works.** One `Event` object drives the workshop page, the homepage summary, the announcement bar, the sitemap entry and the Event JSON-LD. Dates are stored once as ISO timestamps; `formatEventDates()` derives every display string ("Wed, Oct 21", "12:00 to 2:00 PM MST") in the event's own time zone.

**To change.** Details: `events.ts`. Which event the header and announcement bar promote: `featuredEventSlug` in `site.ts`. A second workshop: a new `Event`, a new route rendering `<EventPage>`, and `CANONICAL_PATHS` in `proxy.ts` if its URL is printed.

**Known gap.** Nothing compares the event's end time with today, so a past event is still shown as upcoming until the content is edited.

### Keep-alive

**Purpose.** Stop the free Supabase project from pausing after 7 days without activity.

**How it works.** A Vercel Cron Job ([vercel.json](../vercel.json)) calls `/api/cron/keep-alive` every hour, on the hour, with `CRON_SECRET`. Each run writes one row to `keep_alive` and prunes rows older than 30 days. Contract: [API-DOCUMENTATION.md](API-DOCUMENTATION.md#get-apicronkeep-alive). Checking it: [guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md#check-the-keep-alive).

## Editing code content

Content outside profiles is TypeScript. Edit, then deploy.

| What | Where |
|---|---|
| Homepage and About copy | [src/content/pages.ts](../src/content/pages.ts) |
| Library Intelligence page (add research notes to the top of `notes`) | [src/content/library-intelligence.ts](../src/content/library-intelligence.ts) |
| Workshop details, Eventbrite link, date and time | [src/content/events.ts](../src/content/events.ts) |
| Presenter bio | [src/content/people.ts](../src/content/people.ts) |
| Book reviews | [src/content/reviews.ts](../src/content/reviews.ts) |
| Nav, footer, contact email | [src/content/site.ts](../src/content/site.ts) |
| Wording around the profiles (page name, intro, "not a sponsored listing" note, section titles) | [src/content/who-can-help.ts](../src/content/who-can-help.ts) |

Search for `PENDING` in `src/content` to find placeholders. No em-dashes in site copy.
