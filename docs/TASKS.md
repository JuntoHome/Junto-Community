# Tasks

The project's task status in one place. GitHub issues are the source of truth for Translator work; this file summarises them. Update it when a ticket changes state.

**As of:** Nov 14, 2026.

**Sources:** GitHub issues #1 to #35 (milestone "Data Axle Translator Phase 1"), [JCA_CMS_Plan.md](JCA_CMS_Plan.md) for CMS tickets, and the commit history for completion evidence.

**Priority:** no priorities are recorded in GitHub or the plans. Set them on the issues and copy them here; until then, issue order is the working order.

## Completed

CMS tickets with a commit on `main` that names them. Details of each ticket: [JCA_CMS_Plan.md](JCA_CMS_Plan.md#10-tickets).

| ID | Title | Evidence | Modules |
|---|---|---|---|
| CMS-01 | Project setup for the admin area | `65e2e77` | `src/app/admin/`, `src/lib/supabase/` |
| CMS-02 | Admins table and access rules | `4bdd3f8` | `supabase/migrations/20261028000000_create_admins.sql` |
| CMS-03 | Login | `45970f5` | `src/features/admin-auth/` |
| CMS-04 | Protect admin routes | `e7d8ded` | `src/lib/auth.ts`, `admin/(protected)/layout.tsx` |
| CMS-05 | Logout | `49ead5e` | `src/features/admin-auth/` |
| CMS-06 | Forgot and reset password | `7ddef5d` | `src/features/admin-auth/`, `admin/set-password/` |
| CMS-07 | Admin home shell and navigation | `8bbad68` | `src/components/admin/` |
| CMS-09 | Profiles table, rules and grants | `2117a8e` | `20261029000000_create_profiles.sql` |
| CMS-10 | Logo storage bucket | `ca7e264` | `20261029010000_create_profile_logos_bucket.sql` |
| CMS-12 | Public overview page | `75e7615` | `src/app/(site)/who-can-help/` |
| CMS-13 | Public profile page | `c38fc56` | `who-can-help/[slug]/`, `profile-article.tsx` |
| CMS-14 | Search engine and link-preview tags | `94e51c9` | `src/app/sitemap.ts` |
| CMS-15 | Menu link and refresh on publish | `0a385a9` | `src/content/site.ts`, `profiles/queries.ts` |
| CMS-16 | Profiles list in admin | `d5a74a4` | `admin-profile-list.tsx` |
| CMS-17 | Create profile with draft save | `3f6b6d2` | `profile-form.tsx`, `actions.ts` |
| CMS-18 | Edit profile | `5c53376` | `profiles/[id]/page.tsx`, `actions.ts` |
| CMS-19 | Validation | `0c3ac71` | `profiles/schema.ts` |
| CMS-20 | Publish and hide | `0c3ac71` | `actions.ts` |
| CMS-21 | Preview | `ec2fd1c` | `src/app/(site-preview)/` |
| CMS-22 | Delete with confirmation (soft delete) | `f4d22d4` | `delete-profile.tsx` |
| CMS-23 | Logo upload | `ab9423b` | `logo-storage.ts` |
| CMS-24 | Display order | `47882be` | `move-buttons.tsx`, `repository.ts` |
| CMS-25 | Admin home summary | `a1fd8e3` | `admin/(protected)/page.tsx` |

Also done without a ticket: profiles follow Paul's structure (`0e7289b`), point-of-contact wording (`bb9e5ef`), branded invite and reset emails (`45d477c`). Phase 1 site work is in [CHANGELOG.md](CHANGELOG.md).

### Status not verifiable from the repository

These may be done; confirm and move them.

| ID | Title | What would confirm it |
|---|---|---|
| CMS-08 | Invite Paul | Paul's row in `admins` |
| CMS-11 | Seed the SCORE profile | A published SCORE profile on `/who-can-help` |
| CMS-26 | Security testing | A test record. Commit `513bc93` (logout ends API access) is a fix from it, not proof the testing was finished |
| CMS-27 | Functional and device testing | A test record |
| CMS-28 | Admin guide for Paul | The guide (not in the repo) |
| CMS-29 | Walkthrough with Paul | Meeting notes |
| CMS-30 | Production release and backup check | Backup confirmation |

## In progress

| ID | Title | Status | Links |
|---|---|---|---|
| TR-01 | Staging environment and project docs | Docs merged into `translator` (PR #36); Vercel staging alias and Preview variables pending with the project lead | [#1](https://github.com/JuntoHome/Junto-Community/issues/1), [PR #36](https://github.com/JuntoHome/Junto-Community/pull/36) |
| TR-02 | Translator page scaffold with private access | Merged into `translator` (PR #37): `/admin/translator` with banner, 5-step indicator and sidebar link | [#2](https://github.com/JuntoHome/Junto-Community/issues/2), [PR #37](https://github.com/JuntoHome/Junto-Community/pull/37) |
| TR-03 | Shared criteria schema (used by the form now and the AI later) | Merged into `translator` (PR #38): `SearchBrief` schema, `SCORING_VERSION`, field, operator and dimension lists, and the two spec example briefs in `criteria/` | [#3](https://github.com/JuntoHome/Junto-Community/issues/3), [PR #38](https://github.com/JuntoHome/Junto-Community/pull/38) |
| TR-04 | Field mapping: synthetic and Reference Solutions layouts | Merged into `translator` (PR #39): `TranslatorRecord` fields, mapping configs for both layouts, `mapRow()` and `normalizeHeader()` in `import/`, and a Reference Solutions fixture row for the TR-29 unit test | [#4](https://github.com/JuntoHome/Junto-Community/issues/4), [PR #39](https://github.com/JuntoHome/Junto-Community/pull/39) |
| TR-05 | Bundled sample workbook and "Load sample" button | Merged into `translator` (PR #40): sample copied to `public/translator/` (same SHA-256), "Load sample (500 fictional records)" button on the Upload step, single `handleWorkbook(file)` entry point that moves to Preview. Validation in it comes with TR-07 and TR-08; the Reference Solutions sample button with TR-35 | [#5](https://github.com/JuntoHome/Junto-Community/issues/5), [PR #40](https://github.com/JuntoHome/Junto-Community/pull/40) |
| TR-06 | File upload with type and size checks | Merged into `translator` (PR #41): file picker and drop zone on the Upload step; `checkWorkbookFile()` in `import/check-file.ts` checks one file, not empty, at most 2 MB, `.xlsx` name and ZIP signature, and runs first in `handleWorkbook` for uploads and samples | [#6](https://github.com/JuntoHome/Junto-Community/issues/6) |
| TR-07 | File gate: allow only the approved synthetic workbook | Merged into `translator` (PR #42): `checkAllowlist()` in `import/file-gate.ts` hashes the workbook (SHA-256, in the browser) and accepts only hashes listed in `import/allowlist.ts` (one entry for now, `JCA_Synthetic_Contacts.xlsx`; TR-35 adds the Reference Solutions file). Runs in `handleWorkbook` after `checkWorkbookFile()`; the bytes read for it are kept for the parser (TR-08). Fails closed without a secure context. Also restores `docs/translator/JCA_Synthetic_Contacts.xlsx`, which had been replaced by a different file in `188675f` | [#7](https://github.com/JuntoHome/Junto-Community/issues/7), [PR #42](https://github.com/JuntoHome/Junto-Community/pull/42) |
| TR-08 | Parse the workbook and detect its layout | Merged into `translator` (PR #43): `parseWorkbook()` in `import/parse.ts` reads the gated bytes with ExcelJS, picks the `Contacts` sheet or the first sheet in a known layout, detects Synthetic or Reference Solutions from row 1, and maps each data row (keeping `sourceRow` and `sourceValues`). Skips empty rows, stops above 1,000 rows, and returns plain-language problems. `import/xlsx-compat.ts` makes files written by non-Excel tools (namespace-prefixed XML, absolute paths) readable. Preview shows layout, sheet and row count | [#8](https://github.com/JuntoHome/Junto-Community/issues/8), [PR #43](https://github.com/JuntoHome/Junto-Community/pull/43) |
| TR-09 | Header validation | Merged into `translator` (PR #44): mappings now have `signatureHeaders` (recognise the layout) and `requiredHeaders` (must be present once) instead of `detectHeaders`. `validateHeaders()` in `import/validate-headers.ts` runs in `parseWorkbook()` before any row is read: "Missing required columns: City" for missing ones, a stop for a required column that appears twice, and missing optional columns become unknown and are listed on Preview | [#9](https://github.com/JuntoHome/Junto-Community/issues/9), [PR #44](https://github.com/JuntoHome/Junto-Community/pull/44) |
| TR-10 | Normalize values | Merged into `translator` (PR #45): `normalizeRecord()` in `normalize/normalize.ts` gives every value an `original`, a tidy `value` and, for city, state, industry and title, a match `key` from `matchKey()` (`normalize/match-key.ts`); blanks become a tagged unknown; employees are parsed as a whole number, or from the employee range when that is unknown. The wizard normalizes every row after parsing and keeps the originals | [#10](https://github.com/JuntoHome/Junto-Community/issues/10), [PR #45](https://github.com/JuntoHome/Junto-Community/pull/45) |
| TR-11 | Row validation: invalid employee counts and duplicate IDs | In review (PR into `translator`, branch `tr-11-row-validation`): `validateRows()` in `normalize/validate-rows.ts` returns `kept`, `excluded` and `issues` (`{ sourceRow, recordId, code, severity, reason }`). Invalid employee counts and blank Record IDs are warnings (row kept); a repeated Record ID keeps the first row and excludes the rest, so every Record ID in `kept` is unique. The wizard runs it after normalizing; later steps use only `kept`. Preview lists the issues (placeholder until TR-13) | [#11](https://github.com/JuntoHome/Junto-Community/issues/11), [PR #46](https://github.com/JuntoHome/Junto-Community/pull/46) |

## Pending

Data Axle Translator Phase 1, all open. Each issue has the steps and acceptance criteria. Module locations are the expected ones from [../CLAUDE.md](../CLAUDE.md); the code does not exist yet.

### Setup and shared shapes

| ID | Title | Expected location | Issue |
|---|---|---|---|
| TR-35 | Synthetic test file in the real Reference Solutions layout | `docs/translator/` | [#35](https://github.com/JuntoHome/Junto-Community/issues/35) |

### Import and cleaning

| ID | Title | Expected location | Issue |
|---|---|---|---|
| TR-12 | Duplicate grouping | `normalize/` | [#12](https://github.com/JuntoHome/Junto-Community/issues/12) |
| TR-13 | Preview step | `ui/` | [#13](https://github.com/JuntoHome/Junto-Community/issues/13) |

### Criteria

| ID | Title | Expected location | Issue |
|---|---|---|---|
| TR-14 | Criteria form: goal and must-haves | `ui/`, `criteria/` | [#14](https://github.com/JuntoHome/Junto-Community/issues/14) |
| TR-15 | Criteria form: preferences, exclusions and list size | `ui/`, `criteria/` | [#15](https://github.com/JuntoHome/Junto-Community/issues/15) |
| TR-16 | Criteria summary panel | `ui/` | [#16](https://github.com/JuntoHome/Junto-Community/issues/16) |

### Ranking

| ID | Title | Expected location | Issue |
|---|---|---|---|
| TR-17 | Filtering engine | `ranking/` | [#17](https://github.com/JuntoHome/Junto-Community/issues/17) |
| TR-18 | Scoring engine | `ranking/` | [#18](https://github.com/JuntoHome/Junto-Community/issues/18) |
| TR-19 | Sorting and list limit | `ranking/` | [#19](https://github.com/JuntoHome/Junto-Community/issues/19) |
| TR-20 | Match reasons | `ranking/` | [#20](https://github.com/JuntoHome/Junto-Community/issues/20) |
| TR-21 | Pin and omit overrides | `ranking/`, `ui/` | [#21](https://github.com/JuntoHome/Junto-Community/issues/21) |

### Results and export

| ID | Title | Expected location | Issue |
|---|---|---|---|
| TR-22 | Results table | `ui/` | [#22](https://github.com/JuntoHome/Junto-Community/issues/22) |
| TR-23 | Counts summary | `ui/` | [#23](https://github.com/JuntoHome/Junto-Community/issues/23) |
| TR-24 | No-results helper | `ui/` | [#24](https://github.com/JuntoHome/Junto-Community/issues/24) |
| TR-25 | Excel export: Shortlist sheet | `export/` | [#25](https://github.com/JuntoHome/Junto-Community/issues/25) |
| TR-26 | Excel export: Criteria sheet | `export/` | [#26](https://github.com/JuntoHome/Junto-Community/issues/26) |
| TR-27 | Safe export cells (formula injection) | `export/` | [#27](https://github.com/JuntoHome/Junto-Community/issues/27) |
| TR-28 | Session-only data and reset | `ui/` | [#28](https://github.com/JuntoHome/Junto-Community/issues/28) |

### Testing, documentation and handover

| ID | Title | Expected location | Issue |
|---|---|---|---|
| TR-29 | Unit tests: import and data cleaning (adds Vitest and `npm run test`) | tests beside the modules | [#29](https://github.com/JuntoHome/Junto-Community/issues/29) |
| TR-30 | Unit tests: ranking walkthroughs from the spec | tests | [#30](https://github.com/JuntoHome/Junto-Community/issues/30) |
| TR-31 | Edge case tests | tests | [#31](https://github.com/JuntoHome/Junto-Community/issues/31) |
| TR-32 | Manual QA on staging | staging | [#32](https://github.com/JuntoHome/Junto-Community/issues/32) |
| TR-33 | Developer documentation | `docs/` | [#33](https://github.com/JuntoHome/Junto-Community/issues/33) |
| TR-34 | Phase 1 walkthrough with Paul | | [#34](https://github.com/JuntoHome/Junto-Community/issues/34) |

## Blocked

Waiting on someone outside the code.

| Item | Waiting on | Where |
|---|---|---|
| BI101 online platform | Paul | `PENDING` in `src/content/events.ts` |
| "Who Can Help?" name and wording | Paul | `src/content/who-can-help.ts` |
| Content for Maricopa SBDC, Arizona Commerce Authority, Local First Arizona profiles | Paul | CMS plan question 6 |
| What to show now that BI101 is over | Paul | [KNOWN-ISSUES.md](KNOWN-ISSUES.md#fix-or-decide-soon) |
| Staging URL (TR-01, needed by TR-32) | Project lead, in Vercel | [DEPLOYMENT.md](DEPLOYMENT.md#environments) |

## Technical debt

The full list with evidence is in [KNOWN-ISSUES.md](KNOWN-ISSUES.md). The items most likely to need a ticket:

| Item | Why it matters |
|---|---|
| Upgrade `next` past 16.3.6 and review `npm audit` advisories | Published advisories, some critical |
| A separate Supabase project for staging and local work | Testing currently changes production data |
| CI that runs typecheck, lint, build and tests on pull requests | Nothing checks a change before it reaches `main` |
| Grants in the `subscribers` migration | A fresh database may not accept signups |
| Date logic for past events | The site still promotes the Oct 21 workshop |
