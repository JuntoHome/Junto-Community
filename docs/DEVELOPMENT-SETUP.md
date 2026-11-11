# Development setup

## Required software

- Node.js 20.9 or newer (required by Next.js 16) and npm. No version file is pinned in the repo.
- Git.
- Optional: the Supabase CLI, only if you prefer `supabase db push` to pasting SQL.

## Access you need

- The GitHub repository `JuntoHome/Junto-Community`.
- The Supabase project (for keys and the SQL editor).
- The Vercel project `junto-community` (for environment variables and logs).

## Install

```bash
git clone https://github.com/JuntoHome/Junto-Community.git
cd Junto-Community
git switch translator
npm install
cp .env.example .env.local
```

## Environment variables

Fill in `.env.local` for what you are working on:

| To work on | You need in `.env.local` |
|---|---|
| Static pages only (`npm run dev`) | Nothing |
| `npm run build` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Public profiles, admin login | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| Subscribe form, password reset, keep-alive | Also `SUPABASE_SERVICE_ROLE_KEY` |
| Subscriber notification email | Also `RESEND_API_KEY` |
| Keep-alive endpoint | Also `CRON_SECRET` (any string locally) |
| The Translator | Admin login only; it uses no extra variables |

Values come from Supabase (Project Settings → API Keys) and from the Vercel project's environment variables. Every variable is described in [guides/ENVIRONMENT-CONFIGURATION.md](guides/ENVIRONMENT-CONFIGURATION.md).

## Database connection

> **There is one Supabase project.** Nothing in the repo sets up a local or staging database. With the shared keys, your local site reads and writes **production** data. Signing up through a local subscribe form creates a real subscriber and emails the team; editing a profile changes the live site.

To work against your own database instead:

1. Create a free Supabase project.
2. Apply every file in `supabase/migrations/` in filename order ([guides/DATABASE-MIGRATIONS.md](guides/DATABASE-MIGRATIONS.md)).
3. Put that project's URL and keys in `.env.local`.
4. Add yourself as an admin ([guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md#add-an-admin)).

Invite and reset emails always link to the project's Site URL, so set it to `http://localhost:3000` in your own project if you want to test them locally.

## Running the app

There is no separate backend: Server Actions and the API route run inside the Next.js server.

```bash
npm run dev     # http://localhost:3000, admin at /admin
```

## Commands

From [package.json](../package.json):

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Next.js rules) |
| `npm run build` | Production build; also type-checks and pre-renders pages |
| `npm run start` | Serve the production build locally |
| `npm run test` | Not yet defined; added with Vitest in TR-29 |

Run `typecheck`, `lint` and `build` before pushing ([WAY-OF-WORKING.md](WAY-OF-WORKING.md#testing)).

## Testing and debugging

- There are no automated tests yet. Check changes by hand locally and on the branch's preview.
- Server logs are prefixed by feature (`[profiles]`, `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[keep-alive]`). Locally they appear in the `npm run dev` terminal.
- Calling the cron endpoint and checking database access from outside: [API-DOCUMENTATION.md](API-DOCUMENTATION.md).
- Symptoms and fixes: [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Editor

No editor configuration is committed. ESLint is configured in [eslint.config.mjs](../eslint.config.mjs) and TypeScript in [tsconfig.json](../tsconfig.json) (path alias `@/` → `src/`).
