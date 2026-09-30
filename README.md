# Junto Community Alliance website

Phase 1 of [juntocommunity.org](https://www.juntocommunity.org): homepage, the Business Insights 101 workshop page (`/BI101`) and About, plus the "Join the Junto" subscribe form. The build spec is [docs/BUILD_SPEC.md](docs/BUILD_SPEC.md) and the approved mockups are in [docs/design/](docs/design/).

**Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Supabase (subscribers), Vercel (hosting and analytics).

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in the Supabase values
npm run dev                  # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript only |

The subscribe form needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Without them the rest of the site works, and the form shows a friendly error. Create the table by running [supabase/migrations/](supabase/migrations/) in the Supabase SQL editor (or with `supabase db push`).

## Architecture

Content, UI and features are kept apart, so a CMS, more workshops or an app can be added without rewriting pages.

```
src/
  app/                  Routes only. Each page fetches content and composes components.
  content/              Today's content, as typed TypeScript data (site, events, people, pages).
  lib/content/          The content API that every page uses, plus the source interface.
    types.ts            The content model: the contract between content and UI.
    source.ts           `ContentSource` interface.
    sources/local.ts    Reads from src/content. Add sources/<cms>.ts next to it.
    index.ts            getSiteSettings, getEvent, listEvents, getPage (cached per request).
  components/
    ui/                 Primitives: buttons, icons, rich text, placeholders.
    layout/             Header, mobile menu, footer.
    event/              Event cards and the full EventPage template.
    sections/           Page sections (Join the Junto band).
  features/subscribe/   Subscribe: zod schema, Server Action, Supabase repository, form.
  lib/supabase/         Server-only Supabase admin client.
  lib/seo.ts            Page metadata and Event JSON-LD.
  proxy.ts              Redirects /bi101 (any casing) to /BI101.
supabase/migrations/    Database schema.
```

### How content flows

```
src/content/*.ts ──> ContentSource (local) ──> lib/content API ──> app/ pages ──> components
                     ContentSource (CMS)  ──┘   (swap here)
```

Pages never import from `src/content` directly. They call `getPage("home")`, `getEvent("bi101")` and so on, and components receive typed objects (`Event`, `HomePage`, ...).

### Adding a CMS later

1. Model the content types in the CMS to match [src/lib/content/types.ts](src/lib/content/types.ts).
2. Add `src/lib/content/sources/<cms>.ts` that implements `ContentSource` and maps CMS documents to those types. Rich text fields use a small Markdown subset (`*em*`, `**strong**`, `[label](href)`, `## Subhead`).
3. Point `source` in [src/lib/content/index.ts](src/lib/content/index.ts) at the new source.
4. For instant updates, add revalidation (a CMS webhook calling `revalidateTag` / `revalidatePath`). Pages are static today, so this is what keeps them fast.

Pages and components need no changes.

### Adding a workshop

Add an `Event` to [src/content/events.ts](src/content/events.ts) (or the CMS later) and render it with `<EventPage>`, the same template `/BI101` uses. A generic `/workshops/[slug]` route can be added when there is more than one workshop.

## Editing content now

| What | Where |
|---|---|
| Homepage and About copy | [src/content/pages.ts](src/content/pages.ts) |
| Workshop details, Eventbrite link, date/time | [src/content/events.ts](src/content/events.ts) |
| Presenter bio and photo | [src/content/people.ts](src/content/people.ts) |
| Nav, footer, contact email | [src/content/site.ts](src/content/site.ts) |

Dates are stored as ISO timestamps; every display string ("Wed, Oct 21", "12:00 to 2:00 PM MST") is derived from them.

### Pending placeholders

Search for `PENDING` in `src/content`:

- Darryl's photo: add the file to `public/` and set `photo` in `people.ts`.
- Online platform: set `attendance.online.platform` in `events.ts`.

## Important

- **`/BI101` is printed on flyers as a QR code. Never rename or remove that route.**
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (`import "server-only"` guards it). Never prefix it with `NEXT_PUBLIC_`.
- No em-dashes in site copy (client preference).

## Deploying

Vercel project `junto-community` auto-deploys from `main`. Set the two Supabase environment variables in the Vercel project settings.
