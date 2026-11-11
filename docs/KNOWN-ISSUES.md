# Known issues and technical debt

A review as of November 2026. Nothing here has been fixed unless it says so. Items marked "by design" are trade-offs the code comments acknowledge. When you fix one, remove it and add a line to [CHANGELOG.md](CHANGELOG.md).

## Fix or decide soon

| Issue | Evidence | Impact |
|---|---|---|
| Dependencies with published advisories | `npm audit` (Nov 2026): `next` 16.3.6 critical; `zod`, `sharp`, `source-map-js` high. `next` is pinned, so the fix (16.4.6) needs a deliberate upgrade. Several Next.js advisories concern self-hosting or `use cache`, which this project doesn't use | Exposure varies by advisory; needs assessing |
| The workshop is over but the site still promotes it | BI101 was Oct 21, 2026. The announcement bar, "Upcoming workshop" labels, Register buttons and Event JSON-LD have no date logic | Visitors are invited to register for a past event |
| One database for everything | No local or staging Supabase project | Local, preview and staging testing changes production data |
| No automated tests, no CI | No test files or workflow config | Every change is verified by hand; `main` deploys directly |
| `npm run test` is documented but missing | `CLAUDE.md` lists it; `package.json` has no `test` script until TR-29 | The required pre-commit checks can't all run yet |

## Incomplete features

- Only profiles are editable in the admin; all other content needs a deploy.
- Four planned admin modules are not started; the Translator is in progress.
- BI101's online platform is still `PENDING`.
- "Who Can Help?" wording is still marked as a draft.
- No admin screens for subscribers, for managing admins, or for restoring deleted profiles; all three are manual SQL.
- No unsubscribe or deletion path for subscribers.
- The admin guide for Paul (CMS-28) is not in the repo.
- No workshop archive or generic `/workshops/[slug]` route.

## Correctness risks

| Risk | Where | Note |
|---|---|---|
| Reordering is not atomic | `repository.ts` `moveInOrder()` | Several updates, no transaction. By design: ties are repaired on the next move. Two admins reordering at once can still interleave |
| Last write wins | `updateProfileFields()` | Two admins editing the same profile overwrite each other silently |
| Changing a published profile's address breaks its old URL | `profile-form.tsx` | The address stops following the name once published, but can still be edited by hand, and no redirect is kept |
| Orphaned logo files | `actions.ts` | A failure between upload and save leaves a file behind. By design |
| `subscribers` migration has no grants | `20260926000000_create_subscribers.sql` | May fail on a fresh Supabase project ([DATABASE.md](DATABASE.md#things-to-be-aware-of)) |
| No error page for the public site | `src/app/(site)/` has no `error.tsx` | A failed profile query on a cache miss shows the framework's default error |

## Security

| # | Concern | Detail |
|---|---|---|
| 1 | Outdated dependencies with advisories | See the first table |
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

## Performance

Nothing is slow at the current scale. Things to watch:

- **Large source images.** `public/images/home/hero.png` is 1.7 MB and each logo PNG is about 1 MB. `next/image` resizes them for visitors, but the logo is also used for the Open Graph image.
- **`getAdmin()` makes two network calls** (Auth, then `admins`) on every admin request.
- **Reordering loads every profile** and writes rows one by one. Fine for tens of profiles.
- **No pagination** on the public overview or the admin list.
- **`unstable_cache`** is not a stable Next.js API and may change on upgrade.

## Duplication and structure

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

## Configuration and operations

- Migrations and email templates are applied by hand; nothing records what the live project has.
- Important settings exist only in the Supabase and Vercel dashboards.
- No error tracking or uptime monitoring; failures are found by reading logs.
- The site depends on an hourly cron to stop the free Supabase project pausing.
- Backups are whatever the Supabase plan provides; the release ticket that checks them (CMS-30) is unconfirmed.
- The `dev` branch is unused and identical to `main`.
- Soft-deleted profiles and their logos are never purged.
- `npm run build` fails without the two public Supabase variables, because `/admin` is pre-rendered ([TROUBLESHOOTING.md](TROUBLESHOOTING.md#local-development)).

## Documentation

- [BUILD_SPEC.md](BUILD_SPEC.md) predates the admin area and the homepage redesign; kept as a historical record.
- [JCA_CMS_Plan.md](JCA_CMS_Plan.md) lists the original profile fields, not the current ones ([REQUIREMENTS.md](REQUIREMENTS.md#changes-since-the-cms-plan)).
- `site.copyright` is a fixed "© 2026".
- One lint warning: an `<img>` in `src/app/opengraph-image.tsx` (expected there; `next/image` can't be used in image generation).
