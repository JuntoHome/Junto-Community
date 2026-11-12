# Changelog

Significant changes, newest first, taken from the git history. The project has no version tags or releases (`package.json` stays at `0.1.0`), so entries are grouped by date. Hashes are the commits on `main` unless noted.

Add an entry when work is merged into `translator` (under **Unreleased**) and move it under a date when it reaches `main`.

## Unreleased (on `translator`, not yet on `main`)

### Added
- Translator spec, synthetic test workbooks and `CLAUDE.md` (`87b40eb`, Nov 10).
- TR-01: Translator docs README with Phase 1 rules and staging warning (PR #36, open).
- TR-02: `/admin/translator` page for admins only, with the synthetic-data banner, a 5-step indicator (Upload, Preview, Criteria, Results, Export; placeholders for now) and a "Data Axle Translator" sidebar link.
- TR-03: shared `SearchBrief` criteria schema in `src/features/translator/criteria/schema.ts` (intent, must-haves, preferences, exclusions, priority order by ranking dimension, list size, assumptions), with `SCORING_VERSION` "1.0", the supported fields, operators and dimensions as constants, plain-language validation messages, and the business owner and job seeker example briefs from the spec in `criteria/examples.ts`.
- TR-04: field mapping in `src/features/translator/import/`. One `TranslatorRecord` shape (core, contact and extra fields in `fields.ts`) for both input layouts, declared as config in `mappings/synthetic.ts` (9 columns) and `mappings/reference-solutions.ts` (396-column export: IUSA Number or a generated `ROW-0001` ID, title falls back to Professional Title, executives 1 to 50 as display-only extra info, no email). `map-row.ts` applies a mapping to one row and holds `normalizeHeader()` (trim, ignore case, keep inner spacing). Values stay raw; blank cells become `null`. A fixture row in `import/__fixtures__/rs-row.ts` is ready for the TR-29 unit test.

### Changed
- Documentation reorganized into `docs/`: the root README moved to `docs/README.md` as an index, with separate documents for overview, architecture, requirements, features, database, API, authentication, workflow, setup, deployment, tasks, known issues and troubleshooting.

## 2026-11-07

### Changed
- Invite and reset-password emails use the JCA look (`45d477c`). The templates must be pasted into Supabase.

## 2026-11-04

### Changed
- Profile form says where the point of contact appears (`bb9e5ef`).

## 2026-11-03

### Added
- Delete profiles with a confirmation step; soft delete (CMS-22, `f4d22d4`).
- Upload, replace and remove profile logos (CMS-23, `ab9423b`).
- Change the order of profiles (CMS-24, `47882be`).

### Changed
- **Breaking (database):** profiles follow Paul's structure (`0e7289b`). Sections are now Worth exploring, People to know and Getting started; Getting started is required to publish; new `links` column. The migration stops if a published profile has no Getting started text.

### Security
- Logging out ends API access for that session's tokens; `is_admin()` requires a live session (CMS-26, `513bc93`).

## 2026-11-02

### Added
- Publish and hide profiles, with publish-time checks (CMS-19, CMS-20, `0c3ac71`).
- Preview a profile as visitors will see it (CMS-21, `ec2fd1c`).

## 2026-11-01

### Added
- Edit saved profiles (CMS-18, `5c53376`).

### Changed
- Admin redesigned with a sidebar and a dashboard home (CMS-25, `a1fd8e3`).

## 2026-10-31

### Added
- Profile form with draft save (CMS-17, `3f6b6d2`).

## 2026-10-30

### Added
- Admin profiles list (CMS-16, `d5a74a4`).

## 2026-10-29

### Added
- Admin home and navigation (CMS-07, `8bbad68`).
- `profiles` table, access rules and grants (CMS-09, `2117a8e`).
- Profile logos storage bucket and rules (CMS-10, `ca7e264`).
- Public "Who Can Help?" overview (CMS-12, `75e7615`) and profile pages (CMS-13, `c38fc56`).
- Profile pages in the sitemap (CMS-14, `94e51c9`).
- "Who Can Help?" in the site menu; profile changes appear within a minute (CMS-15, `0a385a9`).

## 2026-10-28

### Added
- CMS plan: requirements, workflows and tickets (`406a428`).
- Admin area and Supabase login session (CMS-01, `65e2e77`).
- `admins` table and `is_admin()` access check (CMS-02, `4bdd3f8`).
- Admin login with email and password (CMS-03, `45970f5`).
- Every admin page protected behind an admin login (CMS-04, `e7d8ded`).
- Logout in the admin header (CMS-05, `49ead5e`).
- Forgot password, reset and invite password setup (CMS-06, `7ddef5d`).

## 2026-10-26

### Changed
- Supabase keep-alive runs hourly and records each run in `keep_alive` (`500e9b9`).

## 2026-10-14

### Added
- Daily cron to keep Supabase from pausing (`4bbe7f7`).

## 2026-10-12

### Added
- Library Intelligence page, nav link and homepage teaser (`c72877a`).

## 2026-10-08

### Added
- BI101 flyer for the email campaign (`89b644c`).

## 2026-10-05

### Changed
- Removed the photo circle from the BI101 presenter section (`18b5518`).

## 2026-10-03

### Changed
- `hello@` used for workshop questions on the homepage (`44fafcd`) and in the footer (`0ea587e`).

## 2026-10-01

### Added
- "The Culture Architect" review page, linked from BI101 (`4e196ae`).
- Email to the team when someone joins the Junto (`e1502f1`).

### Changed
- Reworded the SCORE mention on About and removed the library caption (`aaeae97`).
- Redeploy to pick up new environment variables (`9e35fde`).

## 2026-09-30

### Added
- Photo hero and site-wide workshop announcement bar (`781c465`).
- Google Search Console verification (`7ccbbd5`).

## 2026-09-29

### Changed
- Homepage made JCA-first, with Paul's homepage and About copy (`40fad2f`).

## 2026-09-26

### Added
- Phase 1 site: homepage, `/BI101`, About, "Join the Junto" form, and a content layer ready for a CMS (`ece0cec`).
- Repository created (`1a7830c`).
