# Deployment

## Hosting

| Piece | Where |
|---|---|
| Application | Vercel project `junto-community`, connected to GitHub `JuntoHome/Junto-Community` |
| Domain | juntocommunity.org. Per [BUILD_SPEC.md](BUILD_SPEC.md), GoDaddy DNS points to Vercel and the apex redirects to `www` (**Unverified** from the repo) |
| Database, Auth, Storage | One Supabase project (free plan) |
| Email | Resend: HTTP API for subscriber notifications, SMTP for Supabase Auth emails |
| Scheduled job | Vercel Cron, hourly, from [vercel.json](../vercel.json) |
| Analytics | Vercel Analytics (public pages only) |

## Environments

| Environment | Deploys from | Variables | Database |
|---|---|---|---|
| Production | `main` | Vercel Production | Production |
| Staging | `translator`, through a stable branch alias | Vercel Preview | **Production** |
| Preview | Any other pushed branch | Vercel Preview | **Production** |
| Local | Your machine | `.env.local` | Production unless you configure your own |

Staging URL: pending (TR-01). Because staging and previews share the production Supabase project, admin edits and subscribe tests there change live data.

Variables per environment: [guides/ENVIRONMENT-CONFIGURATION.md](guides/ENVIRONMENT-CONFIGURATION.md).

## Build process

Vercel runs `npm install` and `npm run build` (`next build`). The build type-checks, compiles and pre-renders static pages. There is no CI and no approval step: the Vercel build is the only gate. `next.config.ts` records the build time as `BUILT_AT` for the sitemap.

## Releasing to production

1. Finished work is merged into `translator` and checked on staging.
2. If the release includes a migration that **adds** something, apply it to the database first ([guides/DATABASE-MIGRATIONS.md](guides/DATABASE-MIGRATIONS.md)).
3. If it includes changed email templates, paste them into Supabase ([guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md#update-the-invite-and-reset-emails)).
4. If it includes a new variable, set it in Vercel Production and Preview.
5. Merge into `main` deliberately. The push deploys immediately.
6. Run the production checks below.
7. If the release **removes** something from the database, drop it only after the code that used it is live.

## Production verification

After a deploy, check:

- [ ] `https://www.juntocommunity.org` loads on phone and desktop.
- [ ] `/BI101` loads; `/bi101` redirects to it.
- [ ] Register buttons open Eventbrite with `?aff=jcawebsite`.
- [ ] `/who-can-help` lists published profiles; one profile page opens.
- [ ] `/admin/login` loads and an admin can log in.
- [ ] Vercel → Deployments shows no build warnings you didn't expect; Vercel → Logs shows no new errors.
- [ ] Vercel → Settings → Cron Jobs shows the keep-alive still running.

## Rollback

- **Code:** Vercel → Deployments → promote an earlier deployment. This is instant and doesn't need git.
- **Database:** not rolled back with the code. Write a new migration that reverses the change, or restore from Supabase backups. **Unverified:** what backups the plan provides and whether they have been tested (CMS-30).
- **Email templates:** paste the previous version back into the dashboard.
- After a rollback, fix forward on a branch and redeploy through `main` as usual.

## Keep-alive

Supabase pauses a free project after 7 days without activity. The hourly cron prevents that. It needs `CRON_SECRET` set in Vercel. If the cron stops, the database pauses after about a week and profiles, login and the subscribe form stop working.
