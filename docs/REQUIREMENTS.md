# Requirements

What the system must do, the rules it must keep, and what is still undecided. Requirement IDs come from the source documents; where a source has no IDs, requirements are listed by area.

## Sources

| Source | Covers | Status |
|---|---|---|
| [BUILD_SPEC.md](BUILD_SPEC.md) | Phase 1 public site (Sept 2026) | Historical: the routes and subscribe rules still hold; design details have moved on |
| [JCA_CMS_Plan.md](JCA_CMS_Plan.md) | Admin area and profiles, IDs AUTH, HOME, PROF, PUB (approved Oct 26, 2026) | Current, except the profile fields (see [Changes since the plan](#changes-since-the-cms-plan)) |
| [translator/](translator/) spec and GitHub issues TR-01 to TR-35 | Data Axle Translator Phase 1 | Current |
| [../CLAUDE.md](../CLAUDE.md) | Translator hard rules and expected results | Current |

"Status" below means the code implements it. Whether it has been accepted by the client is recorded in [TASKS.md](TASKS.md).

## Functional requirements

### Public site (from BUILD_SPEC)

| Requirement | Status | Where |
|---|---|---|
| Homepage, `/BI101` workshop page and `/about` | Built (homepage since redesigned) | `src/app/(site)/` |
| `/bi101` in any casing redirects permanently to `/BI101` | Built (308) | `src/proxy.ts` |
| Every Register button opens the Eventbrite event with `?aff=jcawebsite` | Built | `src/content/events.ts` |
| Join the Junto: first name, email, 5-digit ZIP only | Built | `src/features/subscribe/` |
| Server-side validation, honeypot, per-IP rate limit, duplicate email treated as success | Built | `features/subscribe/actions.ts` |
| Friendly 404 linking to `/` and `/BI101` | Built | `src/app/not-found.tsx` |
| Titles, descriptions, Open Graph tags, sitemap, robots, Event JSON-LD | Built | `src/lib/seo.ts`, `src/app/sitemap.ts`, `robots.ts` |
| Vercel Analytics on public pages | Built | `site-shell.tsx` |

### Authentication and access (CMS plan)

| ID | Requirement | Status |
|---|---|---|
| AUTH-1 | Admins log in with email and password | Built |
| AUTH-2 | No public sign-up; new admins are invited only | Built (sign-up disabled in the Supabase dashboard: **Unverified**) |
| AUTH-3 | Every admin page and admin action requires a valid session | Built |
| AUTH-4 | Only admins can access admin pages or change data, checked on the server and in the database | Built |
| AUTH-5 | Forgot password and reset password work by email | Built |
| AUTH-6 | Logout ends the session | Built; also ends API access for copied tokens (CMS-26) |
| AUTH-7 | Failed logins show a clear, non-revealing error | Built |

### Admin home

| ID | Requirement | Status |
|---|---|---|
| HOME-1 | After login, admin lands on an admin home | Built |
| HOME-2 | Home shows published and draft counts and the most recently updated profile | Built |
| HOME-3 | Navigation lists Profiles and has room for future modules | Built ("Coming later" list) |

### Profile management

| ID | Requirement | Status |
|---|---|---|
| PROF-1 | List of all profiles with name, status and last updated date | Built |
| PROF-2 | Create a profile | Built |
| PROF-3 | Edit any profile | Built |
| PROF-4 | Save as draft | Built |
| PROF-5 | Publish a draft | Built |
| PROF-6 | Hide (unpublish) a published profile | Built |
| PROF-7 | Delete after confirming; soft delete | Built; restore is manual SQL |
| PROF-8 | Preview before publishing | Built |
| PROF-9 | Slug from the name, unique, URL-safe, editable | Built |
| PROF-10 | Required fields validated before publish; drafts may be incomplete | Built (zod and a database constraint) |
| PROF-11 | Website URL validated; contact email validated if entered | Built |
| PROF-12 | Optional logo upload (image only, size limit) | Built: PNG, JPEG, WebP, 2 MB |
| PROF-13 | Set the display order | Built (move up and down) |
| PROF-14 | Record created date, updated date and last editor | Built (database trigger) |
| PROF-15 | Long text supports paragraphs, bold, bullets, links | Built (plus italic) |

### Public profiles

| ID | Requirement | Status |
|---|---|---|
| PUB-1 | Overview lists all published profiles in display order | Built |
| PUB-2 | Each published profile has its own page at its slug | Built |
| PUB-3 | Draft, hidden and deleted profiles are never shown, even by direct address | Built (query filter and RLS) |
| PUB-4 | Each profile shows the "independently researched, not a sponsored listing" note | Built |
| PUB-5 | The organization's website opens in a new tab | Built |
| PUB-6 | The site menu links to the overview | Built |
| PUB-7 | Each page has its own title and description | Built |
| PUB-8 | Published changes appear within a minute | Built (cache tag invalidated on save; 30-second lifetime otherwise) |
| PUB-9 | Unknown or unpublished slugs return "not found" | Built |

### Data Axle Translator Phase 1

Not built. The requirements are the 35 GitHub issues (each with steps and acceptance criteria) and the spec in [translator/](translator/). The rules that shape every Translator task:

| Rule | Detail |
|---|---|
| Synthetic data only | No Data Axle connection. Never upload, copy or commit real records |
| Browser only | Rows are never sent to the server, stored or logged |
| One criteria object | The form fills a `SearchBrief`; Phase 2 AI fills the same shape |
| Deterministic ranking | No AI in Phase 1; same file and brief give the same order and reasons |
| Pure modules | No React outside `ui/` |
| Admin only | `/admin/translator`, not in the public menu or sitemap |

Field mapping, ranking rules and the expected results that tests must lock in: [translator/README.md](translator/README.md).

## Changes since the CMS plan

On Nov 3, 2026 the profile structure was changed to follow Paul's draft (commit `0e7289b`, migration `20261103010000_profiles_follow_paul_structure.sql`):

| Plan | Now |
|---|---|
| "How they can help" (required) | **Worth exploring** (required), stored in `how_they_help` |
| "Who should explore" (required) | **People to know** (required), stored in `who_should_explore` |
| "History / background" (optional) | **Getting started** (now required), stored in `history` |
| (none) | **Official sources / useful links**: up to 10, optional |

## Non-functional requirements

| Area | Requirement | Source | Status |
|---|---|---|---|
| Ownership | All accounts and data stay in JCA's name | CMS plan | **Unverified** |
| Security | Secrets only in environment variables, never in the repo or emails | CMS plan | Met in the repo |
| Security | Service role key never in the client bundle | BUILD_SPEC | Met (`server-only`) |
| Reliability | Admin actions show clear success or error messages; nothing fails silently | CMS plan | Met, except password reset which deliberately always reports success |
| Performance | Public profile pages cached and refreshed on change | CMS plan | Met |
| Performance | Lighthouse Performance, Accessibility and SEO 90+ | BUILD_SPEC | **Unverified** |
| Mobile | Admin and public pages work on phone and desktop; checked at 390, 768 and 1440 px | Both | **Unverified** by any recorded test |
| Accessibility | Keyboard usable, contrast 4.5:1, labelled fields, touch targets 44 px | Both | Designed for; not audited |
| Maintainability | New content types reuse the same patterns | CMS plan | Met for profiles |
| Cost | No new paid services | CMS plan | Met |
| Privacy | Translator rows never leave the browser | CLAUDE.md | To be built |

## Business rules

These must not be broken.

1. **`/BI101` is printed on flyers as a QR code. Never rename or remove it.** `src/proxy.ts` redirects other casings to it.
2. A draft, hidden or deleted profile must never be public, even by direct URL. The database enforces this.
3. A profile can be published only when tagline, introduction, Worth exploring, People to know, Getting started and website are all filled in. Enforced by both the zod schema and a database constraint.
4. Delete is a soft delete.
5. Published changes show on the public site within a minute.
6. Every profile shows the "Independently researched... Not a sponsored listing" note.
7. No em-dashes in site copy (client preference).
8. No new paid services. The project runs on free tiers.
9. Every Register button goes to Eventbrite; the site does not handle registration.
10. Translator: synthetic data only, and processing only in the browser.

## User roles and permissions

| Action | Visitor | Logged-in non-admin | Admin |
|---|---|---|---|
| Read public pages and published profiles | Yes | Yes | Yes |
| Join the mailing list | Yes | Yes | Yes |
| Open `/admin` or `/preview` | No (sent to login) | No (refused) | Yes |
| Create, edit, publish, hide, delete, reorder profiles | No | No | Yes |
| Upload, replace, remove logos | No | No | Yes |
| Read `admins` | No | No | Yes |
| Read or export subscribers | No | No | Only in the Supabase dashboard |
| Add or remove admins | No | No | Only with Supabase dashboard access |
| Use the Translator | No | No | Yes (once built) |

"Logged-in non-admin" exists only if someone has an Auth account without an `admins` row; it has the same access as a visitor.

## Confirmed versus assumed

| Statement | Basis |
|---|---|
| CMS scope "Option B" approved by Paul on Oct 26, 2026 | Confirmed in [JCA_CMS_Plan.md](JCA_CMS_Plan.md) |
| Profile structure follows Paul's draft | Confirmed by commit `0e7289b` |
| All admins have equal rights | Confirmed: plan and code |
| "Who Can Help?" as the section name and its wording | **Assumed**: marked as a draft in `src/content/who-can-help.ts` |
| Logos are shown only with each organization's permission | **Assumed**: a policy in the plan; the code does not check it |
| Who uses the Translator beyond admins (for example library patrons) | **Assumed**: the spec describes patrons, but Phase 1 is admin-only |
| Dashboard settings (sign-up off, SMTP, Site URL, templates) are as documented | **Unverified**: not in the repository |

## Pending requirements and decisions

| Item | Waiting on | Where it shows |
|---|---|---|
| BI101 online platform (Zoom, Teams or YouTube) | Paul | `PENDING` in `src/content/events.ts` |
| "Who Can Help?" page name and wording | Paul | `src/content/who-can-help.ts` |
| What the site should show now that BI101 (Oct 21, 2026) is over | Paul | No date logic; see [KNOWN-ISSUES.md](KNOWN-ISSUES.md) |
| Which admins should exist beyond Paul and Jeel | Paul | CMS plan question 5 |
| Content for Maricopa SBDC, Arizona Commerce Authority and Local First Arizona | Paul | CMS plan question 6 |
| Staging URL for the `translator` branch | Project lead (Vercel) | TR-01 |
| Scope and timing of the four planned admin modules | Paul | `plannedModules` in `src/components/admin/modules.ts` |
| Translator Phase 2 (AI that fills the `SearchBrief`) | Not scheduled | [translator/README.md](translator/README.md) |
