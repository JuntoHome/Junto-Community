# Changelog

Significant changes, newest first, taken from the git history. The project has no version tags or releases (`package.json` stays at `0.1.0`), so entries are grouped by date. Hashes are the commits on `main` unless noted.

Add an entry when work is merged into `translator` (under **Unreleased**) and move it under a date when it reaches `main`.

## Unreleased (on `translator`, not yet on `main`)

### Added
- Translator spec, synthetic test workbooks and `CLAUDE.md` (`87b40eb`, Nov 10).
- TR-01: Translator docs README with Phase 1 rules and staging warning (PR #36, open).
- TR-02: `/admin/translator` page for admins only, with the synthetic-data banner, a 5-step indicator (Upload, Preview, Criteria, Results, Export; placeholders for now) and a "Data Axle Translator" sidebar link.
- TR-03: shared `SearchBrief` criteria schema in `src/features/translator/criteria/schema.ts` (intent, must-haves, preferences, exclusions, priority order by ranking dimension, list size, assumptions), with `SCORING_VERSION` "1.0", the supported fields, operators and dimensions as constants, plain-language validation messages, and the business owner and job seeker example briefs from the spec in `criteria/examples.ts`.
- TR-04: field mapping in `src/features/translator/import/`. One `TranslatorRecord` shape (core, contact and extra fields in `fields.ts`) for both input layouts, declared as config in `mappings/synthetic.ts` (9 columns) and `mappings/reference-solutions.ts` (396-column export: IUSA Number or a generated `ROW-0001` ID, title falls back to Professional Title, executives 1 to 50 as display-only extra info, no email). `map-row.ts` applies a mapping to one row and holds `normalizeHeader()` (trim, ignore case, keep inner spacing). Values stay raw; blank cells become `null`. A fixture row in `import/__fixtures__/rs-row.ts` is ready for the TR-29 unit test (PR #39, open).
- TR-05: "Load sample (500 fictional records)" button on the Translator's Upload step. It fetches `public/translator/JCA_Synthetic_Contacts.xlsx` (a byte-identical copy of the docs workbook), turns it into a `File` and passes it to `handleWorkbook(file)`, the one entry point uploads will also use (TR-06). For now that stores the file and moves to Preview, which shows the file name and size; validation and parsing plug in with TR-07 and TR-08. Samples are listed in `ui/samples.ts`; TR-35 adds the Reference Solutions sample there (PR #40).
- TR-06: workbook upload on the Translator's Upload step: a labelled file picker inside a drag-and-drop zone, with ".xlsx only, up to 2 MB" shown next to it. `checkWorkbookFile()` in `src/features/translator/import/check-file.ts` checks, in order, that exactly one file was chosen, that it isn't empty, that it is at most 2 MB, that its name ends in `.xlsx` (any case) and that its first 4 bytes are the ZIP signature `50 4B 03 04`. It reads only those 4 bytes and ignores the browser's MIME type. It runs first in `handleWorkbook`, so samples pass the same checks. On a problem the step stays on Upload and shows a plain-language message in a live region. Nothing is sent to the server (PR #41).
- TR-07: file gate on the Translator's Upload step. After the size and type checks, `handleWorkbook` reads the workbook once and `checkAllowlist()` in `src/features/translator/import/file-gate.ts` compares its SHA-256 (computed in the browser with `crypto.subtle`) with `import/allowlist.ts`. Only `JCA_Synthetic_Contacts.xlsx` is listed for now; TR-35 adds the Reference Solutions layout file. Any other file, including a copy re-saved in Excel, is refused with "Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it." Without a secure context (https or localhost) every file is refused. The bytes are kept in memory for the parser (TR-08); the hash is never logged or sent (PR #42).
- TR-08: workbook parser. `parseWorkbook()` in `src/features/translator/import/parse.ts` reads the bytes the file gate kept, with ExcelJS (new dependency, loaded only when a workbook is parsed). It uses the `Contacts` sheet, or else the first sheet whose row 1 is a known layout, and detects the layout from the headers (`LAYOUT_MAPPINGS` in `import/mappings/index.ts`; detection headers now follow the ticket: Synthetic `Record ID` + `Company`, Reference Solutions `Company Name`, `City`, `State`, `Primary SIC Description`). Each data row keeps its spreadsheet row number, raw cells and mapped record; empty rows are skipped; more than 1,000 rows, no rows, an unrecognised file and a damaged file each get a plain-language message on the Upload step. `import/xlsx-compat.ts` rewrites namespace-prefixed XML and absolute part paths first, because ExcelJS can't open files written that way (the Reference Solutions headers file is one). The Preview step shows the layout, sheet and row count (PR #43).
- TR-09: header validation. `validateHeaders()` in `src/features/translator/import/validate-headers.ts` runs in `parseWorkbook()` right after the layout is recognised and before any data row is read. Missing required columns stop the import with "Missing required columns: City, State" (real column names, in mapping order) and, on its own line, "Add these columns to the file and upload again." A required column that appears twice stops it with "The column City appears more than once. Keep one and upload again." Missing optional columns are allowed: their values are unknown (`null`), and the parse result's new `missingOptional` list is shown on the Preview step as "Not in this file: Email. These will show as unknown." (PR #44).
- TR-10: value normalizing in `src/features/translator/normalize/`. `normalizeRecord()` (`normalize.ts`) turns each mapped record into a `NormalizedRecord` (`types.ts`): every text value keeps its `original`, gets a trimmed, whitespace-collapsed `value` for display and, for city, state, industry and title, a `key` for matching from `matchKey()` (`match-key.ts`: NFKC, trim, collapse whitespace, lower case), so " phoenix " and "Phoenix" match. Blank values are a tagged unknown (`{ known: false, reason: "blank" }`) instead of `null`. Employees are a whole number (commas and spaces allowed), otherwise unknown with reason `invalid`; when unknown, the Reference Solutions employee range ("10 to 19", "10,000+") gives a min and max instead (formats **Unverified**). The wizard normalizes every row after parsing and keeps `sourceValues` and `record` unchanged for export (PR #45).
- TR-11: row checks in `src/features/translator/normalize/validate-rows.ts`. `validateRows()` runs in the wizard right after normalizing and returns `kept`, `excluded` and `issues`, each issue `{ sourceRow, recordId, code, severity, reason }` sorted by row then code. An employees value that isn't a whole number (`invalid-employees`) and a blank Record ID that was given a `ROW-0001` style ID (`generated-id`; one summary issue for a Reference Solutions file with no IUSA Number) are warnings, and the row is kept. A Record ID used again (`duplicate-id`, compared ignoring case and spacing) keeps the first row and excludes every later one, so each Record ID in `kept` is unique; later steps use only `kept`. "Invalid rows" in the counts (TR-23) means excluded rows. The Preview step shows "N rows need attention" and up to 20 reasons (placeholder until TR-13). The synthetic sample has no issues (PR #46).
- TR-12: duplicate grouping in `src/features/translator/normalize/duplicates.ts`. `groupDuplicates()` runs in the wizard on the rows `validateRows()` kept and returns `records`, `duplicateCount` and `issues`. Rows equal on every field except the Record ID after normalizing (so `" Phoenix "` and `"phoenix"` match, but a blank and an invalid value don't) are folded into the earliest row, whose new `duplicateIds` and `duplicateRows` list them in row order. Rows with the same company, city and state (and address, when both have one) that aren't exact duplicates are all kept, and each later one gets a `possible-duplicate` warning naming the fields that differ, from the new `FIELD_LABELS` in `import/fields.ts`. These warnings join the TR-11 issues in one list. Ranking (TR-17) will use `records`. Preview shows "500 rows, 1 duplicate grouped, 499 unique records" for the sample (placeholder until TR-13). In the sample, SYN-0500 is grouped under SYN-0001 and there are no possible duplicates (PR #47).
- TR-13: the Translator's Preview step (`ui/preview-step.tsx`) replaces the placeholder lines. It shows the file name, layout and sheet; the counts (Rows read, Duplicates grouped, Unique records, Rows left out, Rows with warnings, and Empty rows skipped when there are any); each duplicate group ("SYN-0001 also appears as SYN-0500 (row 501)"); a Field, Spreadsheet column, Status table from the new `describeMapping()` (`import/describe-mapping.ts`); and every issue in a Row, Record ID, What happened, Result table, collapsed behind "Show all N issues" when there are more than 10. "Continue to criteria" moves to the Criteria step and is disabled only when no usable rows are left. The counts come from the new `summarizeImport()` (`normalize/summary.ts`), which TR-23 will reuse. Tables scroll inside their own box at phone width (PR #48).
- TR-14: the Translator's Criteria step (`ui/criteria-step.tsx`). Goal is required: "Find prospective customers or partners" (`business_owner`) or "Find potential employers" (`job_seeker`), neither preselected. City and State, then Industry and Title under "More must-haves (optional)", are all optional must-haves, each a new reusable multi-select (`ui/value-picker.tsx`: "Type to filter", checkboxes such as "Phoenix (100)", "N selected", Clear). The values and counts come from the loaded records through the new `fieldOptions()` (`normalize/field-options.ts`: grouped by match key, most common spelling as the label, blanks skipped, sorted by label). On Continue the new `toBrief()` (`criteria/from-form.ts`) builds a `SearchBrief` (one value `equals`, several `in` in option order) and validates it with the schema; with no goal the step shows "Choose what you're trying to do." inline and in a summary that gets focus. The form's choices are kept in the wizard when going back, and cleared when a new workbook loads. Nothing is posted. Continue opens the Results placeholder (PR #49).
- TR-15: preferences, exclusions and list size on the Translator's Criteria step (`ui/criteria-step.tsx`). Preferences ("These change the order of the list. They don't remove rows.") are Industry, Title and Company size, each with No preference (default) or Prefer. Prefer shows a picker for Industry and Title (one value `equals`, several `in`) and From and To employee counts for Company size (`range`, both required, whole numbers, From no more than To). No preference leaves the dimension out of `preferences` and clears what was picked. "Rank my preferences by importance" (optional) lists the active preferences, Industry, Title, Company size by default, with Move up and Move down buttons; focus follows the moved item and a live region announces "Title moved to position 1 of 3." When ticked, `priorityOrder` is the active preferences in that order; unticked, it is left out. Leave out ("Rows with these values are removed. A blank value is never removed.") has pickers for Industry, Title and City. List size is a number box, "How many rows do you want?", 1 to 100, default 40. `toBrief()` (`criteria/from-form.ts`) builds all of it, with new pure helpers `setPreferenceMode()`, `moveImportance()` and `activePreferences()`; errors use the TR-14 summary and inline pattern. There is no geography preference in the form on purpose; the schema still supports one for Phase 2 (PR #50).
- TR-16: criteria summary at the top of the Translator's Results step (`ui/criteria-summary.tsx`, inside the new `ui/results-step.tsx`). "Your criteria" lists the brief in plain language, for example "Goal: find prospective customers or partners.", "Must be in Phoenix, AZ.", "Prefer Fabrication, Owner, 10 to 99 employees.", "Show 40." and "No assumptions." The text comes from the new pure `describeBrief()` and `describeLines()` (`criteria/describe.ts`), which the export's Criteria sheet (TR-26) will reuse. Each item has a Change button (on the Preferences line one per part: Change industry, Change title, Change company size, Change order) that opens an inline editor with the Criteria step's controls on a draft copy of the form. Nothing applies until Save, which runs `toBrief()` and changes only that item; an invalid value shows its error inline and changes nothing. Cancel discards the draft, and only one editor is open at a time. After Save, focus returns to the Change button and a live region says "Updated." or, once results show, "Updated. Results refreshed." "Confirm and rank" ranks the pending brief. The new `rank(records, brief)` (`ranking/index.ts`) returns `{ brief, rows }` and the summary always describes `results.brief`; it is a stub with no rows until TR-17 to TR-19, so a placeholder reads "Ranked against the criteria above. Results table comes in TR-22." (PR #51).
- TR-17: filtering in `src/features/translator/ranking/`. `filterRecords(records, brief)` (`filter.ts`) runs on the grouped records: rows matching any exclusion are removed first (a missing value is never a match), then rows not excluded that fail any must-have (a missing value fails). It returns `eligible` in input order, `statusById` (`eligible`, `excluded` or `failed-must-have` per Record ID, for pin and omit in TR-21), `counts` (`input`, `excluded`, `failedMustHave`, `failedOnlyMissing`, `eligible`) and `byCriterion` (rows removed by each exclusion and must-have, and how many had no value, for TR-24). `failedOnlyMissing` counts rows whose only failed must-haves were missing values. Every comparison goes through the new `matchCriterion()` (`match.ts`, reused by scoring in TR-18): `equals` and `in` by match key, employee `range` by count, or by the whole size range fitting inside the user range (an open range such as "10,000+" never matches). `rank()` now returns `{ brief, rows, filter }`, with `rows` the eligible records, unscored, until TR-18 and TR-19. The Results placeholder now reads, for the business owner walkthrough, "100 match. 0 left out by your exclusions. 399 didn't meet a must-have (0 only because of missing data)." (PR #52).

### Fixed
- `docs/translator/JCA_Synthetic_Contacts.xlsx` restored to the original from `87b40eb`. Commit `188675f` had replaced it with a different dataset, which no longer matched the `public/translator/` copy, the documented SHA-256 or the expected results (TR-07).

### Changed
- TR-16: the Criteria step's controls (goal, must-have, preference, importance order, exclusion and list size inputs, and the error summary) moved from `ui/criteria-step.tsx` to `ui/criteria-controls.tsx`, so the criteria summary's editors reuse them. The step looks and works the same. Continue now also hands the wizard the form that produced the brief, and replaces any confirmed brief, so the new brief has to be confirmed again.
- TR-15: `searchBriefSchema` (`criteria/schema.ts`) has two cross-field checks, so the form and the Phase 2 AI both get them. A value can't be both a must-have and an exclusion on one field ("You can't require and leave out Phoenix.") or both a preference and an exclusion ("You can't prefer and leave out Retail."). Values are compared with `matchKey()`; ranges aren't compared. The issue points at the exclusion's value.
- TR-13: the Preview step no longer shows the file size, and missing optional columns now appear as "Missing (shown as unknown)" in the column mapping instead of the "Not in this file: ..." line from TR-09.
- TR-09: layout detection uses each mapping's new `signatureHeaders` (headers only that layout has; the layout with the most, at least 2, wins, and a tie is not recognised) instead of `detectHeaders`. Required columns moved to a separate `requiredHeaders` list. Before, the Reference Solutions detection headers were exactly its required columns, so a Reference Solutions file missing `City` was reported as "couldn't recognize" instead of naming the missing column.
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
