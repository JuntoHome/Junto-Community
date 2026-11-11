# Coding standards

Conventions the existing code follows. Match them. The best reference is [src/features/profiles/](../../src/features/profiles/). Workflow rules (branches, commits, checks) are in [WAY-OF-WORKING.md](../WAY-OF-WORKING.md).

## Language and tooling

- TypeScript everywhere, strict mode, path alias `@/` for `src/` ([tsconfig.json](../../tsconfig.json)).
- ESLint with the Next.js rules ([eslint.config.mjs](../../eslint.config.mjs)). `npm run lint` must pass; the one existing warning in `opengraph-image.tsx` is expected.
- No new dependencies without asking. There is deliberately no UI kit, form library, ORM or state library.

## Layers

Imports flow downward only:

```
src/app/         routes          thin: fetch, check access, compose
src/features/    business logic
src/components/  presentation
src/lib/         infrastructure
src/content/     data            imported only by lib/content/sources/local.ts
```

- Route files stay thin: read params, call `requireAdmin()` where needed, fetch, render.
- Pages never import from `src/content` directly; they use `src/lib/content`.
- Shared UI goes in `src/components/`; anything tied to one feature stays in its feature folder.

## Feature folders

```
src/features/<feature>/
  schema.ts         zod rules and labels, shared by form and server
  actions.ts        "use server" entry points
  repository.ts     database writes; turns Postgres errors into result types
  queries.ts        public reads (cached, with a tag)
  admin-queries.ts  admin reads (uncached)
  *.tsx             UI
```

## Server and client code

- Server Components by default. Add `"use client"` only for interaction (forms, menus, buttons with state).
- Any module that uses secrets or the database starts with `import "server-only"`.
- Choose the Supabase client deliberately:
  - `lib/supabase/server.ts` for everything in `/admin` (RLS applies as the admin).
  - `lib/supabase/public.ts` for cached public reads.
  - `lib/supabase/admin.ts` (service role) only for the existing narrow uses. Never for admin features.

## Server Actions

- Every admin action starts with `await requireAdmin()`.
- Validate input with the feature's zod schema on the server, even if the form also validates.
- Expected failures return state (`{ values, fieldErrors, message }`) so the form can refill and show errors. Don't throw for user mistakes.
- Success redirects, with a flag the page can show (`?saved=1`). Call `redirect()` outside `try` blocks.
- Unexpected failures are caught, logged with the feature prefix, and turned into a plain message.
- After a change that affects public pages, call `updateTag(<tag>)`.

## Logging

- Prefix server logs with the feature: `[profiles]`, `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[keep-alive]`.
- Log errors, not personal data. Never log Translator rows (no `console.log` of workbook data at all).

## Database access

- Hand-written row types and explicit column lists (`COLUMNS`); map rows to camelCase types in one function.
- Admin queries filter `deleted_at is null`.
- Schema changes follow [DATABASE-MIGRATIONS.md](DATABASE-MIGRATIONS.md).

## User-facing text

- **No em-dashes** in site copy (client preference). Use a colon, comma or full stop.
- Plain language. Error messages say what went wrong and how to fix it, for example "Needed to publish." next to the field, plus a summary.
- Message strings live as constants at the top of `actions.ts`; labels in `schema.ts` (`PROFILE_LABELS`); public wording in `src/content/`.

## Styling and accessibility

- Tailwind classes with the design tokens in the `@theme` block of [src/app/globals.css](../../src/app/globals.css) (navy, green, gold, ivory and so on). Don't hard-code new colours.
- Real `<label>` elements, correct input types and `autocomplete` attributes.
- Touch targets at least 44 px; text contrast at least 4.5:1.
- Keyboard focus is managed after actions (error summary, reordered rows).
- No emoji; icons are the inline SVGs in `components/ui/icon.tsx`.

## Security habits

- Rendered user text goes through `components/ui/rich-text.tsx`, which builds React elements and allows only http(s), mailto and tel links. Never use `dangerouslySetInnerHTML` for user content.
- Check uploads by file signature, not by extension or MIME type.
- Admin and preview pages are `noindex` and have no analytics.

## Translator modules

Additional rules for `src/features/translator/` (from [CLAUDE.md](../../CLAUDE.md)):

- `import/`, `normalize/`, `criteria/`, `ranking/`, `export/` contain no React and no I/O beyond what the browser gives them. UI lives in `ui/`.
- One criteria shape: `SearchBrief` in `criteria/schema.ts`. Don't create a second one.
- Ranking is plain, deterministic code: same input, same order and reasons.
- Data stays in memory in the browser: no Server Actions, Supabase, localStorage, cookies or logging for rows.
- Use only synthetic test data.
