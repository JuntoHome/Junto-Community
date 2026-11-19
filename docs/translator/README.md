# Data Axle Translator

The developer guide for the Data Axle Translator. This file owns every Translator fact: [ARCHITECTURE.md](../ARCHITECTURE.md#the-translator) has a short summary that links here, and [DEVELOPMENT-SETUP.md](../DEVELOPMENT-SETUP.md) covers general setup. When you change the Translator, update the section here that owns the fact.

## Contents

1. [What it is](#what-it-is)
2. [Phase 1 rules](#phase-1-rules)
3. [Quick start](#quick-start)
4. [Folder map](#folder-map)
5. [Data flow](#data-flow): [Upload limits](#upload-limits), [File gate](#file-gate), [Reading the workbook](#reading-the-workbook), [Cleaning values](#cleaning-values), [Row checks](#row-checks), [Duplicate grouping](#duplicate-grouping), [Pending and confirmed briefs](#pending-and-confirmed-briefs), [Session and Start over](#session-and-start-over)
6. [Field mapping](#field-mapping): [Two input layouts, one set of fields](#two-input-layouts-one-set-of-fields), [Signature and required headers](#signature-and-required-headers)
7. [Criteria schema](#criteria-schema)
8. [Ranking rules](#ranking-rules): [Filtering](#filtering), [Scoring](#scoring), [Sorting and list size](#sorting-and-list-size), [Match reasons](#match-reasons), [Pin and omit](#pin-and-omit)
9. [Screens](#screens): [Preview step](#preview-step), [Criteria step](#criteria-step), [Criteria summary](#criteria-summary), [Counts summary](#counts-summary), [Results table](#results-table), [No-results helper](#no-results-helper), [Export step](#export-step)
10. [Excel export](#excel-export): [Sheet `Shortlist`](#sheet-shortlist), [Sheet `Criteria`](#sheet-criteria)
11. [Tests](#tests)
12. [Expected results](#expected-results)
13. [How to add a new input format](#how-to-add-a-new-input-format)
14. [How Phase 2 AI will plug in](#how-phase-2-ai-will-plug-in)
15. [How to change scoring](#how-to-change-scoring)
16. [Troubleshooting](#troubleshooting)
17. [Known limitations](#known-limitations)
18. [Files in this folder](#files-in-this-folder): [The Reference Solutions sample](#the-reference-solutions-sample)

## What it is

The Data Axle Translator is a tool in the JCA admin area that lets a library patron upload a business contacts spreadsheet, describe a target in plain terms (for example "Phoenix fabrication owners"), and download a ranked, explained shortlist as an Excel file. Typical users are business owners looking for customers and job seekers looking for employers; in Phase 1 the JCA team runs it for them from the admin area. Phase 1 covers upload, preview, a criteria form, deterministic ranking, results and Excel export, with synthetic data only and no AI. Page: `/admin/translator` (`src/app/admin/(protected)/translator/page.tsx`), behind the admin login, not in the public menu or sitemap. Work is tracked in GitHub issues TR-01 to TR-35 (milestone "Data Axle Translator Phase 1"); status is in [TASKS.md](../TASKS.md).

Staging: `<URL pending>`

> **Database warning:** staging shares the production Supabase project. Logging in to the admin area, editing profiles or using the subscribe form on staging changes live data (a staging signup creates a real subscriber and emails the team). The Translator itself stores nothing, but the rest of the site on staging is live. The same is true locally with the shared keys ([DEVELOPMENT-SETUP.md](../DEVELOPMENT-SETUP.md#database-connection)).

## Phase 1 rules

- **Synthetic data only.** No Data Axle connection. Never upload, copy, paste or commit real Data Axle or Reference Solutions records, not even one row.
- **Browser only.** Parsing, cleaning, ranking and export all run in the browser. Rows are never sent to the server, stored (Supabase, localStorage, cookies) or logged. They last for one session: Start over or a refresh clears them ([Session and Start over](#session-and-start-over)).
- **Independent modules.** Code lives in `src/features/translator/`: `import/`, `normalize/`, `criteria/`, `ranking/`, `export/` (no React) and `ui/` ([Folder map](#folder-map)).
- **Two input layouts, one set of fields.** The 9-column synthetic workbook and the 396-column Reference Solutions export are read through mapping configs ([Field mapping](#field-mapping)).
- **One row per business.** Record ID is the IUSA Number, or `ROW-0001` style when blank. Industry is the Primary SIC Description. Real exports have no email; phone and website are the contact fallbacks.
- **One criteria object.** The form fills a `SearchBrief` ([Criteria schema](#criteria-schema)); the Phase 2 AI will fill the same object.
- **Deterministic ranking, no AI.** The same file and the same brief always give the same order and reasons.

## Quick start

Translator-specific steps only. For cloning, installing, Node versions and environment variables, follow [DEVELOPMENT-SETUP.md](../DEVELOPMENT-SETUP.md) first.

1. **Environment.** The Translator itself needs no variables of its own, but its page is behind the admin login, so `.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and you need an admin account ([guides/ADMIN-OPERATIONS.md](../guides/ADMIN-OPERATIONS.md#add-an-admin)). Without those two values, every admin page, the Translator included, fails with "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY". With them, `/admin/translator` sends you to `/admin/login` until you log in. There is no way to open the page without an admin login. Read the database warning above before using the shared keys.
2. **Run** `npm run dev` and open `http://localhost:3000/admin/translator`. Log in when asked. Use `localhost`, not a LAN address such as `http://192.168.x.x:3000`: the [file gate](#file-gate) needs a secure context and refuses every file on plain http.
3. **Load sample.** On the Upload step, click "Load sample (500 fictional records)". The Preview step shows layout Synthetic, 500 rows read, 1 duplicate grouped and 499 unique records. "Load Reference Solutions sample (100 fictional rows)" loads the [other sample](#the-reference-solutions-sample).
4. **Business owner walkthrough** (the first row of [Expected results](#expected-results)):
   1. Click **Continue to criteria**.
   2. Goal: "Find prospective customers or partners". City: Phoenix. State: AZ.
   3. Preferences: Industry, Prefer, Fabrication. Title, Prefer, Owner. Company size, Prefer, From 10 To 99. Leave the importance order unticked. List size: 40.
   4. Click **Continue**. The Results step opens with "Your criteria". Click **Confirm and rank**.
   5. Expect `100 match your criteria`, `40 in your shortlist and export`, and SYN-0001 first with score 100.
   6. Click **Continue to export**, then **Download Excel**. The file is `JCA_Shortlist_Synthetic_Demo_YYYY-MM-DD.xlsx` with sheets `Shortlist` and `Criteria`.
5. **Tests.** `npm run test` runs every unit test once, with no environment variables, browser or network ([Tests](#tests)). On Windows, run it from a folder path with an uppercase drive letter ([TROUBLESHOOTING.md](../TROUBLESHOOTING.md#local-development)).

## Folder map

Everything is in `src/features/translator/` unless the path says otherwise.

| Folder | Responsibility | Key files | Must not |
|---|---|---|---|
| `import/` | Check the chosen file, gate it by hash, parse the workbook, recognise the layout, check headers, map each row to a `TranslatorRecord` | `load.ts`, `check-file.ts`, `file-gate.ts`, `allowlist.ts`, `parse.ts`, `xlsx-compat.ts`, `validate-headers.ts`, `map-row.ts`, `fields.ts`, `mappings/`, `describe-mapping.ts` | Use React, log, or send anything. Clean values (they leave as raw text). Trust the allowlist entry's `layout` |
| `normalize/` | Clean values (keep the original, a tidy value and a match key), check rows, group duplicates, count the import, list picker options | `normalize.ts`, `match-key.ts`, `types.ts`, `validate-rows.ts`, `duplicates.ts`, `summary.ts`, `field-options.ts` | Use React, I/O or the workbook library. Change `original` values |
| `criteria/` | The `SearchBrief` schema and its constants, the form to brief conversion, the brief in plain language, the two spec briefs | `schema.ts`, `from-form.ts`, `describe.ts`, `examples.ts` | Use React or I/O. Create a second criteria shape. Rank anything |
| `ranking/` | Filter, score, sort, explain, pin and omit, cut to the list size; counts, no-results diagnosis, missing fields | `index.ts` (`rank()`), `match.ts`, `filter.ts`, `weights.ts`, `score.ts`, `sort.ts`, `compare-ids.ts`, `reasons.ts`, `overrides.ts`, `limit.ts`, `counts.ts`, `diagnose.ts`, `missing.ts` | Use React, I/O, logging, randomness, AI, `localeCompare()` or `Intl.Collator` |
| `export/` | Build the `.xlsx` in memory: Shortlist and Criteria sheets, safe text cells, file name and labels | `workbook.ts`, `shortlist-rows.ts`, `criteria-rows.ts`, `cells.ts`, `file-name.ts`, `labels.ts` | Use React. Read the uploaded buffer. Write a formula, or text other than through `setTextCell()` |
| `ui/` | The React components and all session state | `translator-session.tsx`, `translator-wizard.tsx`, `file-upload.tsx`, `sample-buttons.tsx`, `preview-step.tsx`, `criteria-step.tsx`, `criteria-controls.tsx`, `criteria-summary.tsx`, `results-step.tsx`, `results-table.tsx`, `counts-summary.tsx`, `no-results.tsx`, `export-step.tsx`, `start-over.tsx`, `log-error.ts`, `samples.ts` | Compare or score records itself (it calls the pure modules). Store anything outside React state. Call `console` except through `logTranslatorError()` |
| `__fixtures__/` | Test-only helpers, fixture builders and golden files | `pipeline.ts`, `import-pipeline.ts`, `build-workbook.ts`, `records.ts`, `rs-headers.ts`, `rs-row.ts`, `walkthroughs/` | Be imported by app code. Be allowlisted. Contain real data |

Tests sit beside the code as `*.test.ts`; two cover the whole feature and sit at the top: `edge-cases.test.ts` and `rs-sample.test.ts` ([Tests](#tests)). ExcelJS is imported by `import/parse.ts` and `export/workbook.ts` (both loaded with `import()` on first use) and as a type by `export/cells.ts`; JSZip only by `import/xlsx-compat.ts`.

Outside the feature folder:

| Path | What it is |
|---|---|
| `src/app/admin/(protected)/translator/page.tsx` | The page: `requireAdmin()`, then `SyntheticBanner` and `TranslatorSession` |
| `src/components/admin/modules.ts` | The admin sidebar entry |
| `public/translator/` | The two sample workbooks served to the sample buttons, byte-identical to the ones in this folder |
| `scripts/translator/make-rs-fixture.ts` | Builds the Reference Solutions sample. Not part of the app |
| `docs/translator/` | This guide, the spec and the workbooks ([Files in this folder](#files-in-this-folder)) |

## Data flow

```text
File ─▶ check ─▶ gate ─▶ parse ─▶ normalize ─▶ validate ─▶ group ─▶ records ──┐
                                                                             ▼
criteria form ─▶ toBrief() ─▶ pending brief ─▶ Confirm and rank ─▶ rank(records, brief, overrides)
                                                                             │
                     Download Excel ◀─ export ◀─ results table ◀─ counts ◀───┘
                       all in the browser; Start over throws it all away
```

Every step runs in the browser. The pure functions live in `import/` to `export/`; `ui/translator-wizard.tsx` calls them and holds the results in React state.

1. **Choose a workbook.** Every workbook enters through `handleWorkbook(input)` in `ui/translator-wizard.tsx`. The sample buttons (`ui/sample-buttons.tsx`, configured in `ui/samples.ts`) fetch a bundled file from `public/translator/` and turn it into a `File`; the file picker and drop zone (`ui/file-upload.tsx`) pass what the user chose. All take the same path, so there is no sample-only shortcut. If a workbook is already loaded, `handleWorkbook` starts a new session with the new files ([Session and Start over](#session-and-start-over)); otherwise `checkAndLoad()` calls `loadWorkbook(input, isCurrent)` (`import/load.ts`), which runs steps 2 to 4 and returns the gated file and the parsed workbook, or the step that refused the file with the message to show and, for an unexpected failure, the code the wizard logs. `isCurrent` lets it stop between steps once a newer file has been chosen, so a slow file never replaces it. On any problem the wizard stays on Upload and shows the message.
2. **Check.** `checkWorkbookFile()` (`import/check-file.ts`): one file, not empty, at most 2 MB, `.xlsx` name, ZIP signature. Details: [Upload limits](#upload-limits).
3. **Gate.** `file.arrayBuffer()` reads the file once, and `checkAllowlist()` (`import/file-gate.ts`) compares its SHA-256 with `import/allowlist.ts`. Details: [File gate](#file-gate).
4. **Parse.** `parseWorkbook()` (`import/parse.ts`) reads that same buffer, so the file is never read twice. It is loaded with a dynamic `import()`, so ExcelJS is downloaded only when a workbook is parsed. It runs `makeExcelJsCompatible()` (`import/xlsx-compat.ts`), then (a) detects the sheet and layout from row 1 with `detectLayout()` and each mapping's `signatureHeaders` in `LAYOUT_MAPPINGS` (`import/mappings/index.ts`), (b) checks the headers with `validateHeaders()` (`import/validate-headers.ts`) before any data row is read, and (c) maps each data row with `mapRow()` (`import/map-row.ts`). It returns the layout, sheet name, headers, `missingOptional` and rows with `sourceRow`, `sourceValues` and `record`. Details: [Reading the workbook](#reading-the-workbook), [Field mapping](#field-mapping).
5. **Normalize.** `normalizeWorkbook()` (`normalize/normalize.ts`) runs `normalizeRecord()` on every row's `record` and adds the result as `normalized`, leaving `sourceValues` and `record` untouched. Match keys come from `matchKey()` (`normalize/match-key.ts`). Details: [Cleaning values](#cleaning-values).
6. **Validate.** `validateRows()` (`normalize/validate-rows.ts`) returns `kept`, `excluded` and `issues`. Only `kept`, in which each Record ID is unique, goes on. Details: [Row checks](#row-checks).
7. **Group.** `groupDuplicates()` (`normalize/duplicates.ts`) folds exact duplicates among the kept rows into the earliest one and flags look-alikes. The wizard keeps the results of steps 5 to 7 as `ImportState` (`normalize/summary.ts`: `parsed`, `validation`, `records`, `duplicateCount`, `issues`, the last being the row check and duplicate issues in one sorted list, via `compareIssues()`), plus `{ file, buffer, entry }` from the gate. Every later step uses only `records`. The Preview step reads that state through `summarizeImport()` (`normalize/summary.ts`) and `describeMapping()` (`import/describe-mapping.ts`). Details: [Duplicate grouping](#duplicate-grouping), [Preview step](#preview-step).
8. **Criteria form to `toBrief()`.** The Criteria step (`ui/criteria-step.tsx`) offers the values `fieldOptions()` (`normalize/field-options.ts`) finds in `records`. The form's choices (`CriteriaForm`: the goal, picked match keys for must-haves, preferences and exclusions, each preference's mode, the employee range and list size as typed, and the importance order) live in the wizard's state; pure helpers in `criteria/from-form.ts` change it (`setPreferenceMode()`, `moveImportance()`), so each change touches only its own section. On Continue, `toBrief()` (`criteria/from-form.ts`) writes a candidate `SearchBrief` and validates it with `searchBriefSchema` (`criteria/schema.ts`); errors come back keyed by form field. No Server Action. Details: [Criteria step](#criteria-step), [Criteria schema](#criteria-schema).
9. **Pending and confirmed brief.** Continue sets the pending brief; **Confirm and rank** in the criteria summary sets the confirmed brief. Only the confirmed brief is ranked. Details: [Pending and confirmed briefs](#pending-and-confirmed-briefs).
10. **`rank(records, brief, overrides)`** (`ranking/index.ts`), in this order:
    1. Filter: `filterRecords(records, brief)` (`ranking/filter.ts`) applies the exclusions, then the must-haves. Every comparison goes through `matchCriterion()` (`ranking/match.ts`), with criteria prepared once by `prepareCriterion()`.
    2. Score: `scoreRecords(eligible, brief)` (`ranking/score.ts`) with weights from `weightsFor(brief)` and the constants in `ranking/weights.ts`.
    3. Sort: `sortScored(rows)` (`ranking/sort.ts`) by unrounded score, then `compareRecordIds()` (`ranking/compare-ids.ts`).
    4. Reasons: `explain(row, brief)` (`ranking/reasons.ts`) on every sorted row. That full sorted list is `ranked`.
    5. Overrides: `applyOverrides(ranked, overrides, brief.listSize)` (`ranking/overrides.ts`) takes omitted rows out and puts pinned rows first.
    6. Cut: the same call fills up to `listSize` and numbers the rows with `takeShortlist()` (`ranking/limit.ts`). That is `shortlist`.

    It returns `{ brief, scoringVersion, weights, filter, ranked, shortlist, overrides, droppedPins, omittedRows }`. Details: [Ranking rules](#ranking-rules).
11. **Counts.** `buildCounts(importSummary, rankResult)` (`ranking/counts.ts`) gives every figure from rows read to rows exported, and `describeCounts()` in the same file turns them into lines for the screen and the export. Details: [Counts summary](#counts-summary).
12. **Results.** `ui/results-step.tsx` shows the criteria summary (`ui/criteria-summary.tsx`, text from `describeLines()` in `criteria/describe.ts`), the counts (`ui/counts-summary.tsx`) and the shortlist (`ui/results-table.tsx`, with `missingFields()` and `contactLines()` from `ranking/missing.ts`). A typed Record ID is checked with `checkPin()` (`ranking/overrides.ts`) before it is pinned. An empty shortlist shows `ui/no-results.tsx` instead, from `diagnoseEmpty()` (`ranking/diagnose.ts`). Details: [Screens](#screens).
13. **Export.** **Download Excel** on `ui/export-step.tsx` loads `export/workbook.ts` with a dynamic `import()` and calls `buildWorkbook(rankResult, mapping, { counts, source, now })`. It writes sheet `Shortlist` from `shortlistTable()` (`export/shortlist-rows.ts`) and sheet `Criteria` from `criteriaTable()` (`export/criteria-rows.ts`), every text cell through `setTextCell()` (`export/cells.ts`), and runs `assertNoFormulas()` before writing. The file is named by `shortlistFileName()` (`export/file-name.ts`) and saved through a `Blob`. Details: [Export step](#export-step), [Excel export](#excel-export).
14. **Start over.** `TranslatorSession` (`ui/translator-session.tsx`) remounts the wizard with a new `key`, which throws every piece of state away. Details: [Session and Start over](#session-and-start-over).

### Upload limits

- One `.xlsx` file, up to 2 MB (2,097,152 bytes). Larger, empty, `.xls`, `.csv` and other files are refused with a message that says how to fix it ([Troubleshooting](#troubleshooting)).
- The file is recognised by its name ending in `.xlsx` (any case) and by its first 4 bytes, the ZIP signature `50 4B 03 04`. The MIME type the browser reports is ignored.
- These checks don't look inside the workbook: any ZIP named `.xlsx` passes them. The file gate (TR-07) and the parser (TR-08) reject the rest.
- The bundled samples go through the same checks. Code: `checkWorkbookFile()` in `src/features/translator/import/check-file.ts`.

### File gate

During Phase 1 the Translator accepts only the workbooks we issued, so real contact data can't be processed by accident.

- After the upload limits pass, the browser reads the file once and computes its SHA-256 hash (`crypto.subtle.digest`, in `sha256Hex()`). If the hash isn't in the allowlist, the step stays on Upload and shows: "Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it."
- The allowlist is `src/features/translator/import/allowlist.ts`, the only place hashes live. It has two entries: `JCA_Synthetic_Contacts.xlsx` and `JCA_Synthetic_RS_Layout.xlsx` (TR-35). The top comment there says how to compute a hash.
- Any change to the file changes its hash and blocks it, even opening it in Excel and saving it with no edits. To approve a changed file, add its new hash to the allowlist.
- `crypto.subtle` works only on https or localhost. On plain http (for example the dev server opened from a LAN address) the gate refuses every file and says the page needs a secure connection. It never skips the check.
- The hash is not logged or sent anywhere, even for refused files. The bytes read for the gate are kept in memory and handed to the parser (TR-08), so the file is read only once. The wizard keeps them read-only: they are used for hashing and parsing only, and never reach the export.
- Each entry also records a `layout`. It is information only: the parser detects the layout from the headers.
- The gate runs in the browser, so it is a guardrail, not a security control: someone determined could bypass it. That is acceptable for Phase 1 ([KNOWN-ISSUES.md](../KNOWN-ISSUES.md#security)). Code: `checkAllowlist()` in `src/features/translator/import/file-gate.ts`.

### Reading the workbook

After the file gate, the browser parses the same bytes with ExcelJS (TR-08). Code: `parseWorkbook()` in `src/features/translator/import/parse.ts`.

- **Sheet:** the sheet named `Contacts` (ignoring case and outer spaces) if its row 1 is a known layout; otherwise the first sheet, in workbook order, whose row 1 is. Real exports may not have a `Contacts` sheet.
- **Layout:** recognised from the mapping's signature headers (matched like all headers: trimmed, ignoring case). The layout with the most signatures in row 1 wins, if it has at least 2. A tie, or fewer than 2, is "couldn't recognize". Extra, unknown and blank header cells are ignored. The layout comes from the headers, never from the allowlist entry. The Preview step shows the layout, sheet name and row count.
- **Header check:** right after the layout is recognised, and before any data row is read, the required headers are checked (TR-09, [Signature and required headers](#signature-and-required-headers)).
- **Rows:** each data row keeps `sourceRow` (its spreadsheet row number; the header is row 1), `sourceValues` (its cells in column order) and `record` (the mapped `TranslatorRecord`). Rows where every cell is blank or only spaces are skipped. A generated ID still follows the spreadsheet row (row 10 is `ROW-0009`), so skipped rows don't shift it.
- **Cell values** (`toSourceCell()`): text, numbers and true/false stay as they are; rich text and links become their text, formulas their last calculated result (blank when the file has none) and dates ISO text (`2026-01-02`). Error cells (`#N/A`, `#REF!`) are blank, like an empty cell, so an error code is never matched or shown as if it were a value (changed in TR-29).
- **Limit:** at most 1,000 data rows (empty rows don't count).
- **Files from other writers:** some tools (for example the .NET Open XML SDK, which wrote `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`) write namespace-prefixed XML and absolute part paths, which ExcelJS can't open on its own. `makeExcelJsCompatible()` in `import/xlsx-compat.ts` rewrites just those two things in the browser first; files saved by Excel are untouched.
- **Problems** (not a workbook, no known layout, a required column missing or repeated, no data rows, more than 1,000 rows) each stop the import with a plain-language message, listed in [Troubleshooting](#troubleshooting). During Phase 1 the file gate runs first, so in the app these messages can only appear for an approved file. The parser itself accepts any workbook, ready for when the gate is lifted.

### Cleaning values

Right after a workbook is parsed, every row's record is normalized in the browser (TR-10). Code: `normalizeRecord()` in `src/features/translator/normalize/normalize.ts`, shapes in `normalize/types.ts`. Each row then holds `sourceRow`, `sourceValues` and `record` exactly as parsed, plus `normalized`.

**Three versions of each value:**

| Version | What it is | Used for |
|---|---|---|
| `original` | The mapped value, untouched | Kept for reference. The export (TR-25) writes `value`, like the screen |
| `value` | Trimmed, inner whitespace (including non-breaking spaces) collapsed to one space | Display |
| `key` | `matchKey(value)`; only city, state, industry and title have one | Matching. Never shown |

`matchKey()` (`normalize/match-key.ts`) applies Unicode NFKC, trims, collapses inner whitespace and lower-cases (not locale-based). So `" phoenix "` and `"Phoenix"` both have the key `phoenix`. SearchBrief values go through the same function when they are compared (TR-17). The key is deliberately conservative: punctuation is kept (`St. Louis` and `St Louis` differ), abbreviations aren't expanded (`Arizona` is not `AZ`) and words aren't stemmed ([KNOWN-ISSUES.md](../KNOWN-ISSUES.md#correctness-risks)).

**Unknown values.** A value that is `null`, empty or only spaces is unknown: `{ known: false, reason: "blank", original }`, never `null` or `""`. The original (`null`, or the spaces) is kept for export. A blank cell already reaches this step as `null`, because the parser maps blank and space-only cells to `null`. An employee count that can't be read is unknown with reason `invalid`, so the row checks can flag it without reading the cells again. Ranking treats unknown the same everywhere: a missing value is not a match for an exclusion, fails a must-have and scores 0 on a preference ([Filtering](#filtering), [Scoring](#scoring)).

**Other fields.** `recordId` is trimmed and never unknown. Other executives have their name and title trimmed; an executive with neither is dropped.

**Employees** (`normalizeEmployees()`):

1. The `employees` value with commas and spaces removed must be digits only. `"25"`, `"1,200"` and `" 40 "` give 25, 1200 and 40 (`source: "actual"`). `"25.5"`, `"-3"`, `"about 20"` and `"N/A"` are unknown (`invalid`); blank is unknown (`blank`).
2. Only when that is unknown and `employeeRange` has a value, the range is read instead (`source: "range"`, with `min` and `max`). Accepted: `"10 to 19"`, `"10-19"`, `"10 - 19"`, `"1,000 to 4,999"`, and open ranges `"10,000+"` and `"10,000 or more"` (`max` is infinity). Anything else (for example `"Unknown"`, or a min above the max) leaves the count unknown with the reason from step 1. **Unverified:** these formats are a guess. The Reference Solutions headers workbook has no data rows, so the exact range wording in real exports hasn't been seen. The [Reference Solutions sample](#the-reference-solutions-sample) uses the `10 to 19` form, which is the same guess.
3. A range that is read replaces an `invalid` actual count, and the `invalid` reason is not kept.

`employeeRange` is also kept as its own text field for display.

**Range fit rule** (applied by ranking in `matchCriterion()`, see [Filtering](#filtering), not by this step): a range-sourced count matches a user range only when the whole range fits inside it (`min >= userMin` and `max <= userMax`). An open range such as `10,000+` never matches, because a user range always has a whole-number max. So `10 to 19` matches 10 to 99, but `10 to 199` doesn't.

**In the synthetic workbook** all 500 rows have known company, city, state and industry. Title is blank in 125 rows, email in 125 and employees in 124; those values are unknown (`blank`). No row has an invalid employee count, and the file has no range column.

### Row checks

After cleaning, every row is checked for problems (TR-11). Code: `validateRows()` in `src/features/translator/normalize/validate-rows.ts`. It returns `kept` (rows that go forward), `excluded` (rows left out) and `issues`. Every later step (duplicate grouping, ranking, pin and omit, export) uses only `kept`.

Each issue is `{ sourceRow, recordId, code, severity, reason }`. `severity` is `warning` (the row is kept) or `excluded` (the row is left out). Issues are sorted by row number, then code (`compareIssues()`), so the same file always gives the same list. A row can have more than one issue.

| Code | When | Severity | Reason shown |
|---|---|---|---|
| `invalid-employees` | The employees cell has text that isn't a whole number (`25.5`, `-3`, `N/A`). Blank cells are not flagged | `warning` | Employees value "25.5" isn't a whole number, so company size is treated as unknown. When a size range was read instead, it ends: Using the size range 10 to 19 instead. |
| `duplicate-id` | The Record ID was already used on an earlier row. IDs are compared with `matchKey()`, so `SYN-0007` and ` syn-0007 ` are the same | `excluded` | Record ID SYN-0007 is also used on row 5. Row 5 is used and this row is left out. |
| `generated-id` | The ID cell was blank (or the ID column is missing), so the row was given a `ROW-0001` style ID | `warning` | Record ID is blank, so this row was given the ID ROW-0016. (The Reference Solutions layout names its column: IUSA Number is blank, ...) |

The reasons are built by `ROW_ISSUE_REASONS` in the same file. Cell values quoted in a reason are trimmed and cut to 40 characters. They are shown on screen but never logged.

**Keep or exclude:**

- **Invalid employee count: kept, with a warning.** Employees is optional. An unknown size already scores 0 on the employees preference and fails an employees must-have ([Ranking rules](#ranking-rules)), so dropping the whole business over one bad cell would lose more than it protects.
- **Duplicate Record ID: the first row (lowest row number) is kept; every later one is excluded.** Pin, omit, the Record ID tiebreak in sorting and export all identify a row by its Record ID ([Sorting and list size](#sorting-and-list-size), [Pin and omit](#pin-and-omit)), so two rows with one ID would break all four. After this step every Record ID in `kept` is unique, ignoring case and spacing.
- **Generated ID: kept, with a warning.** A generated ID is detected by a flag from the parser, not by comparing strings: `mapRow()` sets `record.idGenerated` to `true` only when it had to make up the ID, and `validateRows()` reads that flag. So a file's own ID that happens to look generated (`ROW-0016` on row 17) is not flagged. The flag is not a field: it isn't shown, exported, ranked or part of the duplicate signature. For the Reference Solutions layout, when no row has an IUSA Number (the column is optional), there is one summary issue for the whole file instead of one per row. It has no row number (`sourceRow` and `recordId` are null) and reads: No row has an IUSA Number, so every row was given an ID from its row number (row 2 is ROW-0001). This summary is tied to the layout id `reference-solutions` in `validateRows()`.

**"Invalid rows"** in the counts summary (TR-23) means `excluded.length`; the Preview step calls it "Rows left out". Warnings are shown but don't reduce the count. These excluded rows are not the same as rows removed by an exclusion criterion during ranking.

**Not checked here:** the same business under two different IDs (SYN-0500 repeats SYN-0001). That is [duplicate grouping](#duplicate-grouping) (TR-12).

The [Preview step](#preview-step) lists every issue in a table.

**The synthetic sample has 0 issues:** 500 kept, 0 excluded. Its 124 blank employee counts are not flagged, and its Record IDs are all filled and unique.

### Duplicate grouping

After the row checks, the same business listed more than once is folded into one record (TR-12). Code: `groupDuplicates()` in `src/features/translator/normalize/duplicates.ts`. It runs on `kept` only, so every Record ID it sees is unique. It returns `records` (one per business, in row order), `duplicateCount` and `issues`. Ranking (TR-17) and every later step use `records`.

**Exact duplicates are grouped.** Two rows are exact duplicates when every field except the Record ID is equal after [cleaning](#cleaning-values):

- Text and category fields are compared by `matchKey()`, so `" Phoenix "` and `"phoenix"` are the same.
- An unknown value only equals an unknown value with the same reason. A blank never equals an invalid value or a real one, so a blank employee count and `N/A` don't group.
- Employees are compared by the count, or by min and max for a range.
- Other executives are compared in order, by the match keys of each name and title.

The row with the lowest row number is kept. The others are folded into it: their Record IDs go into its `duplicateIds` and their row numbers into `duplicateRows`, both in row order. Grouped rows are not issues: they are counted in `duplicateCount` and shown as where the record came from.

**Possible duplicates are flagged, never merged.** Among the records left, rows with the same company, city and state (compared by `matchKey()`), and the same address when both rows have one, look like the same business. Company alone isn't enough, because a chain with several locations would match. Both rows are kept. Every row except the earliest gets a `possible-duplicate` warning naming the earliest row it matches and the fields that differ, by their display names (`FIELD_LABELS` in `import/fields.ts`) in field order:

> Looks like the same business as row 2 (SYN-0001), but Title and Email differ. Both are kept, so check them before using the list.

A row with an unknown company, city or state is never flagged. These warnings join the [row check](#row-checks) issues in one list, sorted by row number, then code.

The [Preview step](#preview-step) shows the count and each group.

**In the synthetic sample:** SYN-0500 (row 501) is an exact duplicate of SYN-0001 (row 2), so SYN-0001 has `duplicateIds` `["SYN-0500"]` and `duplicateRows` `[501]`. That gives 499 records, `duplicateCount` 1 and 0 possible duplicates.

### Pending and confirmed briefs

The wizard holds two briefs (TR-16), so a brief is always confirmed before it is ranked.

- The **pending brief** is set by Continue on the Criteria step, together with the form that produced it, and is what the [criteria summary](#criteria-summary) shows before ranking. Continue replaces any earlier pending brief and clears the confirmed one.
- The **confirmed brief** is set by **Confirm and rank**. Only this one is ranked: `results = useMemo(() => confirmedBrief ? rank(records, confirmedBrief, overrides) : null)`, so ranking runs again whenever the confirmed brief or the overrides change.
- A **Save** in the criteria summary runs `toBrief()` on a draft copy of the form and, when valid, updates the form and the pending brief, plus the confirmed brief when results are showing, which re-ranks.
- Next to the confirmed brief the wizard keeps the **overrides** (TR-21), the user's pins and omits. Editing the brief keeps them; when `results.droppedPins` is not empty, the wizard replaces its overrides with `results.overrides` (the same minus those pins) and the Results step says which pins were removed ([Pin and omit](#pin-and-omit)).
- Whatever describes the results (the summary, the export's Criteria sheet) reads `results.brief`, the brief `rank()` got, never one rebuilt from form state.

### Session and Start over

The Translator keeps everything for one session only (TR-28). Code: `ui/translator-session.tsx`, `ui/start-over.tsx`, `ui/log-error.ts`.

- **Session-only data.** The file, its bytes, the parsed rows, the criteria form, both briefs, the pins and omits, the results and the export status live only in the wizard's React state. Nothing is written to `localStorage`, `sessionStorage`, IndexedDB, cookies or the Cache API, nothing goes in the URL, and nothing is sent to the server. Refreshing or closing the page starts fresh on Upload. Going back to the tab may restore the page from the browser's back/forward cache; that is the same session in the same tab, and still nothing is written anywhere. There is no "leave page" warning.
- **Start over.** A **Start over** button sits under the step indicator once a workbook is loaded (Preview, Criteria, Results and Export, and Upload when it is reopened with a file loaded). Before results exist it clears straight away. Once results exist it first asks, on the page: `Start over?` / `This clears your file, criteria and shortlist. Download your file first if you need it.` with **Clear everything** and **Cancel** (Escape also cancels, and focus goes back to Start over). After clearing, the wizard is on Upload with nothing loaded, focus is on the Upload heading, and a live region announces `Everything was cleared.`
- **How it clears.** `TranslatorSession` renders `<TranslatorWizard key={sessionKey} />` and Start over changes the key, so React throws the whole wizard away and mounts a new one. Nothing is cleared by hand, so state added later is cleared too. Keep every piece of Translator state inside the wizard (or its children). The session also owns the live region that announces "Everything was cleared.", so it survives the remount.
- **A new workbook is a new session.** Choosing another file (upload, drop or Load sample) while a workbook is loaded starts a new session with that file, the same remount: the session passes the chosen files to the new wizard, which loads them on mount. So no criteria, brief, pins, omits or results from the old file carry over. If the new file is refused, the Upload step shows why and nothing from the old file is kept. An empty drop does nothing.
- **Logging.** Translator code never calls `console` directly. Unexpected failures call `logTranslatorError(code)`, which logs only `[translator] <code>`: `file-unreadable`, `parser-unavailable`, `sample-load-failed` or `export-failed`. Never the error object or message, a file name or a value, because ExcelJS errors can quote cell text. Problems the user can fix (wrong type, over 2 MB, not on the allowlist, unrecognised layout) are shown on the page and not logged. The rows never reach the server, so the Vercel function logs can't contain them.
- **Synthetic labels.** The synthetic banner (`ui/synthetic-banner.tsx`, TR-02) sits above the wizard on the page, outside every step, so it stays on every step and through Start over. Every export says it too ([Excel export](#excel-export)).

## Field mapping

### Two input layouts, one set of fields

| Internal field | Synthetic file | Reference Solutions export |
|---|---|---|
| `recordId` | Record ID | IUSA Number; if blank, generate `ROW-0001` style |
| `company` | Company | Company Name |
| `name` | Name | Executive First Name + Executive Last Name |
| `title` | Title | Executive Title, else Professional Title |
| `city` / `state` | City / State | City / State |
| `industry` | Industry | Primary SIC Description |
| `employees` | Employees | Location Employee Size Actual |
| `email` | Email | none (real exports have no email column) |
| `phone` / `website` | none | Phone Number Combined / Website |
| `address` / `zip` | none | Address / ZIP Code |
| `otherExecutives` | none | Executive 1 to 50 first, last, title (display only) |
| `naicsDescription` | none | Primary NAICS Description (display only) |
| `employeeRange` | none | Location Employee Size Range (display; also the employee count when `employees` is unknown, see [Cleaning values](#cleaning-values)) |

- Fields are grouped as core (`recordId`, `company`, `city`, `state`, `industry`, `employees`, `title`), contact (`name`, `email`, `phone`, `website`, `address`, `zip`) and extra info (`naicsDescription`, `employeeRange`, `otherExecutives`). Code: `src/features/translator/import/` (`fields.ts`, `mappings/`, `map-row.ts`). Display names are `FIELD_LABELS` in `fields.ts`.
- A mapping is plain config (`LayoutMapping` in `mappings/types.ts`): one rule per field, of kind `column`, `join`, `firstNonBlank`, `none`, `generatedId` or `repeated`. `mapRow()` is the only code that reads the rules.
- Mapped values are the raw cell text, or `null` when blank. Cleaning and parsing happen afterwards ([Cleaning values](#cleaning-values)).
- One shortlist row per business.
- Required to run: company, city, state, industry (`REQUIRED_FIELDS` in `fields.ts`). The columns behind them, per layout, are in [Signature and required headers](#signature-and-required-headers).
- Ignore unknown columns and blank headers (real exports end with an unnamed column). Headers are matched with `normalizeHeader()`, after trimming the ends and ignoring case, but inner spacing must match exactly: `Advertising  Expenses` has two spaces.
- Generated IDs (`generatedRecordId()`) use the 1-based data row position: the first row after the header is `ROW-0001` (wider past 9999, e.g. `ROW-12345`). Skipped empty rows still count, so the ID always points at the same spreadsheet row.
- Executive slots are skipped only when first name, last name and title are all blank. The main contact is kept separate from slot 1, even when slot 1 repeats it.

### Signature and required headers

Each mapping in `src/features/translator/import/mappings/` has two header lists (TR-09). Code: `validateHeaders()` in `import/validate-headers.ts`, called by `parseWorkbook()`.

| Layout | Signature headers (recognise the layout) | Required headers (must be present, once) |
|---|---|---|
| Synthetic | Record ID, Company, Name, Title, Industry, Email, Employees | Record ID, Company, City, State, Industry |
| Reference Solutions | Company Name, IUSA Number, Primary SIC Description, Primary NAICS Description, Location Employee Size Actual, Location Employee Size Range, Phone Number Combined, Executive First Name, Executive Last Name, Executive Title | Company Name, City, State, Primary SIC Description |

- **Signatures** only recognise the layout. Each is a header the other layout doesn't have (checked against `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`), so a file missing a required column is still recognised and gets the "Missing required columns" message instead of "couldn't recognize". `City` and `State` are in both layouts, so they are never signatures. `Industry` is both a signature and required for Synthetic: without it the other six still recognise the layout.
- **Required** headers feed company, city, state and industry (and the Synthetic `Record ID`). Missing ones are listed in the order above, by their real column names. A required header that appears twice stops the import.
- **Optional** mapped headers may be missing. Their values are unknown (`null`): a missing half of a joined name gives just the other half, a missing `Executive Title` falls back to `Professional Title`, absent executive slots are skipped, and without `IUSA Number` every row gets a generated `ROW-0001` style ID. On the [Preview step](#preview-step) their fields show as "Missing (shown as unknown)" in the column mapping. Numbered executive slots are checked by slot 1 only: Other Executives is Missing when no slot 1 column (`Executive First Name 1` and so on) is there.
- An optional or unmapped header that appears twice is allowed; the first one is used.

## Criteria schema

One object describes a search: the `SearchBrief`, defined by `searchBriefSchema` in `src/features/translator/criteria/schema.ts` (zod). The form produces it through `toBrief()`; the Phase 2 AI will produce the same object ([How Phase 2 AI will plug in](#how-phase-2-ai-will-plug-in)). Values are only trimmed by the schema; matching case and spelling is the normalize step's job. The module is pure, so it runs in the browser and on the server.

**Fields.** The brief is a strict object: an unknown key is an error that names it.

| Field | Type | Rules | Example |
|---|---|---|---|
| `intent` | `"business_owner"` or `"job_seeker"` (`BRIEF_INTENTS`) | Required | `"business_owner"` |
| `mustHaves` | criterion list | Default `[]`. A record must match every one to be eligible; a missing value fails | `[{ "field": "city", "operator": "equals", "value": "Phoenix" }]` |
| `preferences` | criterion list | Default `[]`. Matches add to the score; a missing value scores 0 | `[{ "field": "title", "operator": "equals", "value": "Owner" }]` |
| `exclusions` | criterion list | Default `[]`. A record that matches any one is removed first; a missing value is not a match. See the cross-field checks | `[{ "field": "industry", "operator": "equals", "value": "Retail" }]` |
| `priorityOrder` | list of dimensions (`BRIEF_DIMENSIONS`: `industry`, `geography`, `title`, `employees`), optional | Each dimension once, each with at least one preference. When given, weights 4, 3, 2, 1 replace the defaults ([Scoring](#scoring)) | `["title", "industry", "employees"]` |
| `listSize` | whole number | 1 to 100 (`LIST_SIZE_MIN`, `LIST_SIZE_MAX`), default 40 (`LIST_SIZE_DEFAULT`) | `40` |
| `assumptions` | list of text | Default `[]`, each trimmed. Plain-language notes on anything assumed while filling the brief | `["No exclusions given."]` |

**A criterion** is `{ field, operator, value }`, a strict object (`criterionSchema`). `BRIEF_FIELDS` are `city`, `state`, `industry`, `title` and `employees`; `OPERATOR_FIELDS` says which fields each operator works with:

| Operator | Fields | Value | Example |
|---|---|---|---|
| `equals` | `city`, `state`, `industry`, `title` | Text, not empty after trimming | `{ "field": "city", "operator": "equals", "value": "Phoenix" }` |
| `in` | `city`, `state`, `industry`, `title` | A list of one or more texts, none empty | `{ "field": "city", "operator": "in", "value": ["Phoenix", "Tempe"] }` |
| `range` | `employees` only | `{ min, max }`, whole numbers of 0 or more, `min <= max` | `{ "field": "employees", "operator": "range", "value": { "min": 10, "max": 99 } }` |

`FIELD_DIMENSION` maps each field to its scoring dimension: city and state to `geography`, the others to themselves. `SCORING_VERSION` (`"1.0"`) lives in the same file. Every error message names the problem and says how to fix it, for example `"range" only works with employees. For city, use "equals" or "in".`

**Cross-field checks** (in the schema's `superRefine`, not the form, so a brief from the Phase 2 AI gets them too):

- `priorityOrder` lists a dimension twice: `priorityOrder lists "title" more than once. List each one once.`
- `priorityOrder` lists a dimension with no preference: `priorityOrder lists "geography", but there is no city or state preference. Add one, or remove "geography" from priorityOrder.`
- An exclusion has the same value as a must-have on the same field: `You can't require and leave out Phoenix.` As a preference on the same field: `You can't prefer and leave out Retail.` Values are compared with `matchKey()`, so " phoenix " and "Phoenix" conflict. Only text values (`equals`, `in`) are compared, not employee ranges. The issue's path points at the exclusion's value (`exclusions.0.value`, or `exclusions.0.value.1` inside an `in` list).

**The business owner brief** (`BUSINESS_OWNER_BRIEF` in `criteria/examples.ts`, the first walkthrough), as JSON:

```json
{
  "intent": "business_owner",
  "mustHaves": [
    { "field": "city", "operator": "equals", "value": "Phoenix" },
    { "field": "state", "operator": "equals", "value": "AZ" }
  ],
  "preferences": [
    { "field": "industry", "operator": "equals", "value": "Fabrication" },
    { "field": "title", "operator": "equals", "value": "Owner" },
    { "field": "employees", "operator": "range", "value": { "min": 10, "max": 99 } }
  ],
  "exclusions": [],
  "listSize": 40,
  "assumptions": []
}
```

`JOB_SEEKER_BRIEF` in the same file is the same shape with `job_seeker`, Tempe, Logistics, Operations Manager and list size 30. How the form fills each field: [Criteria step](#criteria-step).

## Ranking rules

`rank(records, brief, overrides)` (`ranking/index.ts`) returns `{ brief, scoringVersion, weights, filter, ranked, shortlist, overrides, droppedPins, omittedRows }`, where `brief` is the brief it ranked against, `scoringVersion` is `SCORING_VERSION` ("1.0"), `weights` and each row's score come from [scoring](#scoring), and `filter` is `{ counts, byCriterion, statusById }` from [filtering](#filtering). `ranked` is every eligible row, sorted, before pins and omits. `shortlist` is what the user sees: pinned rows first, then the best of the rest up to `listSize`, each with a `rank` ([Pin and omit](#pin-and-omit)). `overrides` (optional, none by default) is the user's pins and omits; the result's `overrides`, `droppedPins` and `omittedRows` are described there. Each row is `{ record, score, displayScore, breakdown, reasons, reasonText }`, plus `rank` and `override` in `shortlist`. The whole module is pure: no React, no I/O, no logging.

1. Apply exclusions (a missing value is not a match).
2. Apply must-haves (a missing value fails). Count rows that failed because of missing data.
3. Score 0 to 100 from preferences. Default weights: industry 35, geography 30, title 25, employees 10. Full weight for a match in a dimension, 0 if missing. Only active dimensions count, scaled to 100. No preferences = 0. If the user orders preferences, use weights 4, 3, 2, 1. Details: [Scoring](#scoring).
4. Sort by unrounded score descending, then Record ID ascending. Default list size 40 (1 to 100). Details: [Sorting and list size](#sorting-and-list-size).
5. Pinned rows first (labelled, keep their score). Omitted rows removed. Excluded rows cannot be pinned. Pins take slots within the list size, omits happen before the cut, and only eligible rows can be pinned. Details: [Pin and omit](#pin-and-omit).
6. Every result lists its reasons from its own values. Details: [Match reasons](#match-reasons).

In code, reasons are built after sorting and before pins and omits (filter, score, sort, explain, overrides, cut), so every row of `ranked` has them.

### Filtering

Steps 1 and 2 (TR-17). Code: `filterRecords(records, brief)` in `ranking/filter.ts`, on the grouped `records` from [duplicate grouping](#duplicate-grouping) (499 for the sample, not the 500 source rows).

**One comparison function.** `matchCriterion(record, criterion)` (`ranking/match.ts`) is the only place a record is compared with a criterion; scoring (TR-18) and the no-results helper reuse it. It returns `"match"`, `"no-match"` or `"unknown"`. The brief's criteria are first turned into match keys once per brief with `prepareCriterion()`, not once per row.

- `equals`: the record's match key equals `matchKey(value)`.
- `in`: the record's match key is one of the values' match keys.
- `range` (employees only): an actual count matches when `min <= count <= max`. A range-sourced count follows the [range fit rule](#cleaning-values): `10 to 19` matches 10 to 99, `10 to 249` doesn't, and an open range such as `10,000+` never does.
- A value the record doesn't have (blank or invalid) gives `"unknown"`.

**Two stages that don't overlap.**

1. Exclusions: a record is excluded when any exclusion gives `"match"`. `"unknown"` and `"no-match"` don't exclude, so a row with a blank title is not left out by "Leave out Owner".
2. Must-haves, only for records that weren't excluded: a record fails when any must-have gives `"no-match"` or `"unknown"`. An excluded record is never checked against the must-haves.

Every criterion in a stage is tested, so a record counts under each one it failed.

**What it returns:** `{ eligible, statusById, counts, byCriterion }`.

- `eligible`: the records that passed, in input order.
- `statusById`: `Map` of Record ID to `"eligible"`, `"excluded"` or `"failed-must-have"`, for every record. Pin and omit (TR-21) use it, because excluded rows can't be pinned.
- `counts`: `{ input, excluded, failedMustHave, failedOnlyMissing, eligible }`, with `input = excluded + failedMustHave + eligible`.
- `byCriterion`: one entry per exclusion, then per must-have, in brief order: `{ stage, index, field, removed, removedMissing }`. `stage` is `"exclusions"` or `"mustHaves"`, so `brief[stage][index]` is the criterion. For an exclusion, `removed` is the rows it matched and `removedMissing` is always 0. For a must-have, `removed` is the rows it failed, including missing values, and `removedMissing` the ones with no value.

**"Only because of missing data"** (`failedOnlyMissing`): rows that failed must-haves where every failed must-have was `"unknown"` and none was a real mismatch. These are the rows that might qualify if their data were complete. A row outside Phoenix with a blank title fails on city anyway, so it isn't counted.

**With the synthetic sample** (499 records):

| Brief | eligible | excluded | failedMustHave | failedOnlyMissing |
|---|---|---|---|---|
| Business owner (`BUSINESS_OWNER_BRIEF`) | 100 | 0 | 399 | 0 |
| Job seeker (`JOB_SEEKER_BRIEF`) | 100 | 0 | 399 | 0 |
| Must Phoenix, AZ, title Operations Manager | 25 | 0 | 474 | 25 |
| Must title Operations Manager only | 126 | 0 | 373 | 125 |
| Must Phoenix, AZ; leave out Retail | 80 | 99 | 320 | 0 |
| Must city not in the file | 0 | 0 | 499 | 0 |

With Phoenix, AZ and title Operations Manager, `byCriterion` gives city removed 399, state removed 0, and title removed 373 with `removedMissing` 125 (every blank title in the file, inside Phoenix or not). Leaving out Retail excludes all 99 Retail records in the file, not only the 20 in Phoenix, because exclusions run first on every record.

### Scoring

Step 3 (TR-18). Code: `scoreRecords(eligible, brief)` in `ranking/score.ts`, with the constants in `ranking/weights.ts`. It runs on the eligible records only, keeps their input order and uses `matchCriterion()` for every preference.

**Dimensions and weights.** A dimension is active when the brief has at least one preference on it; only active dimensions count. `weightsFor(brief)` gives each active dimension its weight:

| Dimension (`DIMENSIONS`, default order) | Fields | Default weight (`DEFAULT_WEIGHTS`) |
|---|---|---|
| `industry` | industry | 35 |
| `geography` | city and state | 30 |
| `title` | title | 25 |
| `employees` | employees | 10 |

- No `priorityOrder`: the default weights above.
- With `priorityOrder`: the listed dimensions first, in that order, then any active dimension it leaves out, in default order. They get 4, 3, 2, 1 by position (`ORDERED_WEIGHTS`). The form always lists every active preference. A brief from the Phase 2 AI may list only some; an unlisted preference still counts, but less than every listed one. With title, industry and employees active and only title listed, the weights are title 4, industry 3, employees 2.
- `priorityOrder` holds dimensions, not fields, so city and state share the one geography weight (`FIELD_TO_DIMENSION` in `weights.ts`, which is the schema's `FIELD_DIMENSION` under another name). An empty `priorityOrder` counts as none (the form never sends one).
- The weights are relative, not a budget: the score is scaled by the active total.

**One result per dimension**: `"match"`, `"no-match"` or `"unknown"`.

- Several preferences on one field (or an `in` list): a match if any value matches.
- **Geography with both a city and a state preference: a match only if the city and the state each match.** A Phoenix, AZ preference means Phoenix in Arizona, so Mesa, AZ is a no match and earns no geography points.
- Otherwise a real mismatch on any of the dimension's fields gives `"no-match"`, and a missing value (with no mismatch) gives `"unknown"`. A row with a blank title and a title preference is `"unknown"`. So is Phoenix with a blank state, because the state might have matched.
- The dimension earns its full weight on `"match"` and 0 on `"no-match"` or `"unknown"`.

**The score.** `score = earned total / active weight total * 100`, kept **unrounded**: in the business owner walkthrough, a record matching industry and title scores 60 / 70 * 100 = 85.71428571428571, not 86. Sorting (TR-19) uses `score`. `displayScore = Math.round(score)` is what the screen and the [Excel export](#excel-export) show, so the file never disagrees with what the user saw; `rank` keeps the exact order. Weights are whole numbers, so the totals are exact and the one division comes last, in a fixed dimension order: the same records and brief give the same scores to the last bit. With no preferences every record scores 0, with no weights and an empty breakdown.

**Breakdown.** Each row has one `breakdown` entry per active dimension, in default order: `{ dimension, weight, earned, result, criteria }`. `criteria` lists each preference in that dimension as `{ index, field, result }`, where `index` is its position in `brief.preferences`. [Match reasons](#match-reasons) (TR-20) are built from it.

**With the synthetic sample** (scores to 2 decimal places, with the count of the 100 eligible records at each):

| Brief | Weights (total) | Scores |
|---|---|---|
| Business owner (`BUSINESS_OWNER_BRIEF`) | industry 35, title 25, employees 10 (70) | 100 (1, SYN-0001), 85.71 (4), 64.29 (7), 50 (10), 35.71 (20), 14.29 (19), 0 (39) |
| Same, title Operations Manager | same | 100 (6: SYN-0006, 0026, 0126, 0226, 0326, 0426), 64.29 (2, including SYN-0001), 50 (33), 0 (59) |
| Job seeker (`JOB_SEEKER_BRIEF`) | same | 100 (7: SYN-0002, 0007, 0027, 0127, 0227, 0327, 0427), 64.29 (1), 50 (33), 0 (59) |
| Business owner, prefer only Fabrication and 10 to 99 | industry 35, employees 10 (45) | 100 (8), 77.78 (14, industry only), 22.22 (19, employees only), 0 (59) |
| Business owner, ordered title, industry, employees | title 4, industry 3, employees 2 (9) | A title-only match scores 44.44 |

SYN-0001 scores 100 in the business owner walkthrough because it is in Phoenix, AZ (both must-haves) and matches all three active preferences: Fabrication (35), Owner (25) and 25 employees, inside 10 to 99 (10), so it earns 70 of 70. Ties at the top are why "SYN-0006 first" and "SYN-0002 first" depend on the Record ID tiebreak ([Sorting and list size](#sorting-and-list-size)).

### Sorting and list size

Step 4 and the list size (TR-19). Code: `sortScored(rows)` in `ranking/sort.ts`, `compareRecordIds(a, b)` in `ranking/compare-ids.ts` and `takeShortlist(sorted, listSize)` in `ranking/limit.ts`. `sortScored()` and `takeShortlist()` return new arrays and never change their input.

**Sort.** By unrounded `score`, highest first, then Record ID ascending. Two scores are tied only when they are exactly equal (`===`); there is no tolerance. Equal matches go through the same arithmetic with the same weights, so they give identical numbers, and a tolerance would make the order depend on a tuning value. The order depends only on score and Record ID, never on input order, so shuffling the records gives the same list. Record IDs are unique after the [row checks](#row-checks), so no two rows tie on both.

**How Record IDs compare.** `compareRecordIds()` never uses `localeCompare()` or `Intl.Collator`, because their results can differ between browsers.

1. IDs made only of digits (IUSA Numbers) come before every other ID. Between two of them the shorter comes first, then text order (UTF-16 code units). That is numeric order without turning the ID into a number, so long IDs lose no digits: `9001` comes before `123456789`. With leading zeros the longer one is still later: `12` before `0012`.
2. Any other two IDs: text order of the upper-cased IDs, then of the IDs as written. `ROW-0002` comes before `SYN-0001`.

Digit IDs go first as a group, not compared as text with the others, so the order has no loops (see [KNOWN-ISSUES.md](../KNOWN-ISSUES.md#correctness-risks)). For `ROW-0001` and `SYN-0001` style IDs this is the same as text order.

**List size.** Without pins or omits, `shortlist` is the first `listSize` rows of `ranked`, or all of them when fewer are eligible: 40 of 100 gives 40, 40 of 12 gives 12. Each gets `rank` 1 to N in order; tied scores still get different, sequential ranks. `ranked` keeps every eligible row, so pins and omits ([Pin and omit](#pin-and-omit)) are applied to the full list before the cut.

### Match reasons

Step 6 (TR-20). Code: `explain(row, brief)` in `ranking/reasons.ts`. `rank()` calls it on every row of `ranked`, not only the shortlist, because pins (TR-21) come from `ranked`. It returns `{ reasons, reasonText }`:

- `reasons`: a list of `{ kind, dimension, text }`. `kind` is `"required"`, `"preferred"`, `"not-preferred"`, `"unknown"` or `"info"`. `dimension` is the scoring dimension the line is about (`"geography"` for a Location, City or State line), or `null` for `info`.
- `reasonText`: every `text` joined with `"; "`. The export (TR-25) uses exactly this string.

**One source of text.** The reasons are written once, here. The results table (TR-22) and the export (TR-25) show `reasons` and `reasonText` as they are and never rebuild the wording. `explain()` doesn't compare anything again: preference lines come from the row's `breakdown`, and required lines from the row having passed every must-have.

**Wording.** The value shown is always the **record's** own tidy `value` (TR-10), never the brief's: a record with city " phoenix " shows `City: phoenix`.

| Case | Text |
|---|---|
| Must-have met, city and state | `Location: Phoenix, AZ (required)` |
| Must-have met, only city or only state | `City: Phoenix (required)` / `State: AZ (required)` |
| Must-have met, other field | `Industry: Fabrication (required)` |
| Preference matched | `Industry: Fabrication (preferred)`, `Title: Operations Manager (preferred)` |
| Geography preference matched | `Location: Phoenix, AZ (preferred)`; only a city or only a state preference: `City: Phoenix (preferred)` / `State: AZ (preferred)` |
| Employees matched | `Company size: 25 employees (preferred)`; range-sourced: `Company size: 10 to 19 employees (preferred)` |
| Preference not matched | `Title: General Manager (not preferred)`, `Company size: 8 employees (not preferred)`, `Location: Mesa, AZ (not preferred)` |
| Preference value unknown | `Title unknown`, `Company size unknown`; geography names only the missing part: `State unknown` for Phoenix with a blank state, `Location unknown` when both are blank |
| Geography not matched, one part blank | Only the part the record has: `City: Mesa (not preferred)` |
| No must-haves and no preferences | `Matches your criteria. No preferences were set.` (`info`) |
| Must-haves but no preferences | The required lines, then `No preferences were set, so all matches score 0.` (`info`) |

- **Labels** come from `FIELD_LABELS` (`import/fields.ts`), so the title is "Title". Two names come from the criteria summary's `DIMENSION_NAMES` (`criteria/describe.ts`) instead: "Location" for city and state together, and "Company size" for employees (`FIELD_LABELS` calls it "Employees").
- **Employee counts** are written from the parsed number, with commas from plain code (not `toLocaleString()`), so every browser gives the same text: `1 employee`, `1,200 employees`, a range `10 to 19 employees` (whether the cell said "10-19" or "10 to 19"), an open range `10,000 or more employees`.
- **Long values** are cut to 60 characters, the last one being `…`. Reasons are plain text.
- **Exclusions aren't listed.** Every eligible row passed them, so "not Retail" would only add noise.
- **Pins** (TR-21): a pinned row in `shortlist` gets `Pinned by user` (`info`) as its first reason, and its `reasonText` starts with it: `Pinned by user; Location: Phoenix, AZ (required); ...`. The same row in `ranked` and `omittedRows` keeps its own reasons. Built by `withPinReason()` in `reasons.ts`.

**Order** (the same every time):

1. Required lines, in the order the brief first names each must-have dimension. City and state share one Location line.
2. Preference lines, one per active dimension, by weight, highest first. Equal weights stay in default dimension order (industry, geography, title, employees). The default weights (35, 30, 25, 10) give that same order; with `priorityOrder` it is the user's order, then any dimension it leaves out.
3. The `info` line, when the brief has no preferences.

Every row has at least one reason: a brief with preferences gives one line per active dimension, and one without gives the `info` line.

**With the synthetic sample** (Phoenix, AZ must-haves):

| Brief, record | `reasonText` |
|---|---|
| Business owner, SYN-0001 | `Location: Phoenix, AZ (required); Industry: Fabrication (preferred); Title: Owner (preferred); Company size: 25 employees (preferred)` |
| Title Operations Manager, SYN-0006 | `Location: Phoenix, AZ (required); Industry: Fabrication (preferred); Title: Operations Manager (preferred); Company size: 25 employees (preferred)` |
| Title Operations Manager, SYN-0011 | `Location: Phoenix, AZ (required); Industry: Fabrication (preferred); Title unknown; Company size: 25 employees (preferred)` |
| Business owner, SYN-0016 | `Location: Phoenix, AZ (required); Industry: Retail (not preferred); Title: General Manager (not preferred); Company size unknown` |
| Business owner, SYN-0021 | `Location: Phoenix, AZ (required); Industry: Technology (not preferred); Title: Owner (preferred); Company size: 8 employees (not preferred)` |
| Business owner, ordered title, industry, employees, SYN-0001 | `Location: Phoenix, AZ (required); Title: Owner (preferred); Industry: Fabrication (preferred); Company size: 25 employees (preferred)` |
| Phoenix, AZ only, no preferences | `Location: Phoenix, AZ (required); No preferences were set, so all matches score 0.` |
| No criteria at all | `Matches your criteria. No preferences were set.` |

The "not preferred" lines show why scores differ. With the business owner brief SYN-0001 has 100 and SYN-0006 has 64, and SYN-0006's reasons say why: `Location: Phoenix, AZ (required); Industry: Fabrication (preferred); Title: Operations Manager (not preferred); Company size: 25 employees (preferred)`.

### Pin and omit

Step 5 (TR-21). Code: `ranking/overrides.ts`. The user can keep a record in the list (pin) or take one out (omit). Pure: no React, no storage.

**The overrides** are two lists of Record IDs, `{ pinned, omitted }`, each sorted with `compareRecordIds()`, so the same choices always give the same value. They live only in the wizard's memory, next to the confirmed brief: nothing is saved anywhere. Change them only with `pin()`, `unpin()`, `omit()` and `restore()`. Record IDs are compared with `matchKey()`, so ` syn-0496 ` is SYN-0496.

- **Pin and omit cancel each other.** Pinning an omitted record un-omits it; omitting a pinned one unpins it. The latest action wins, so an ID is never in both lists.
- **Overrides survive brief edits.** When a brief change makes a pinned row ineligible, the pin is removed and the user is told which pins were removed ([Troubleshooting](#troubleshooting)). Omitted IDs stay omitted; an omitted row that isn't eligible is simply not listed. A new workbook starts a new session, which clears them ([Session and Start over](#session-and-start-over)).

**Who can be pinned.** Only eligible records. `checkPin(typed, context)` returns `{ ok: true, recordId }` (the ID as the file has it) or `{ ok: false, message }`. `context` comes from `pinContext(records, leftOutRows, statusById)`: the filter's `statusById`, the duplicate map (each folded duplicate's ID to the ID it was folded into) and the rows the [row checks](#row-checks) left out. Checked in this order, each refusal with its own message (`PIN_MESSAGES`, listed in [Troubleshooting](#troubleshooting)):

1. Nothing typed.
2. No row has the ID.
3. Only rows the row checks left out have it.
4. A grouped duplicate (the message names the ID to pin instead).
5. Matches an exclusion.
6. Fails a must-have.
7. Omitted: allowed, and pinning un-omits it.

A row is only left out for repeating an earlier row's Record ID, and that earlier row is kept, so a typed ID always finds the kept row first. The "left out" message is there for any future reason a row check removes a row with an ID of its own.

**Applying them.** `applyOverrides(ranked, overrides, listSize)` runs in `rank()` between sorting (and reasons) and the cut, and replaces TR-19's plain cut:

1. Omitted rows are taken out of `ranked` first, so the next row moves up and the list stays at `listSize`.
2. The rest split into pinned rows and the others. Both keep `ranked` order (score, then Record ID), so the order within pins doesn't depend on when they were pinned.
3. `shortlist` is every pinned row, then the best others until it has `listSize` rows. **Pins take slots within the list size**: 40 with 2 pins is 2 pins and the top 38 others. With more pins than the list size, every pin is shown and nothing else.
4. Ranks run 1 to N over the whole shortlist (`takeShortlist()`). Pinned rows get `override: "pinned"` (others `null`) and `Pinned by user` as their first reason. Scores don't change.

`rank()` also returns `overrides` (the ones given, minus `droppedPins`), `droppedPins` (pinned IDs with no eligible row under this brief, which the wizard removes and reports) and `omittedRows` (the omitted rows that are still eligible, with score and reasons, in `ranked` order). The [Shortlist sheet](#sheet-shortlist) (TR-25) is exactly `shortlist`; the [Criteria sheet](#sheet-criteria) (TR-26) lists `omittedRows` and `overrides`, so the file shows exactly what is on screen.

**On screen** (in the [results table](#results-table), TR-22): each row has Pin (Unpin when pinned) and Omit buttons, and a pinned row has a `Pinned by user` badge under its rank. "Pin by Record ID" above the table pins any eligible record, including one below the cut, with the messages above in a live region. "Omitted by you (N)" under the table has a Restore button for each row. After a button, focus stays on that row's button, or goes to the same button on the row now in its place when it left the list, and a live region says what changed.

**With the synthetic sample** (business owner brief, list size 40; without overrides SYN-0441 is 40th and SYN-0461 41st):

| Overrides | Result |
|---|---|
| Pin SYN-0496 (score 0, last) | 40 rows. 1 SYN-0496 at 0 with `Pinned by user` first, 2 SYN-0001 at 100. SYN-0441 drops out |
| Omit SYN-0001 | 40 rows. SYN-0101 (86) first; SYN-0461 comes in at 40. SYN-0001 is in `omittedRows` at 100 |
| Pin SYN-0496 and SYN-0016 | Both first, SYN-0016 before SYN-0496 (both 0, so by Record ID) |
| Pin SYN-0496, then change the must-have to Tempe, AZ | SYN-0496 in `droppedPins`, removed from the overrides, notice shown |
| List size 2, pin SYN-0016, SYN-0021, SYN-0496 | 3 rows, all pinned: SYN-0021 (36), SYN-0016, SYN-0496 |

## Screens

The five steps (`ui/steps.ts`: Upload, Preview, Criteria, Results, Export) are rendered by `ui/translator-wizard.tsx`, with the numbered row from `ui/step-indicator.tsx`. Done steps can be reopened; later steps are disabled until the earlier ones are done. What each screen computes is in [Data flow](#data-flow); this section is what the user sees.

### Preview step

After a workbook loads, the Preview step shows what was found before the user sets criteria (TR-13). It shows no row data: the shortlist shows rows later. Code: `ui/preview-step.tsx`, with two pure helpers, `summarizeImport()` (`normalize/summary.ts`) and `describeMapping()` (`import/describe-mapping.ts`).

- **File:** file name, layout label and sheet name.
- **Counts:** Rows read, Duplicates grouped, Unique records, Rows left out and Rows with warnings. "Empty rows skipped" appears only when it is more than 0. Rows read = Rows left out + Duplicates grouped + Unique records.
  - *Empty rows skipped* counts the gaps in the row numbers between the header and the last data row. Blank rows after the last data row aren't counted.
  - *Rows with warnings* counts rows that are not left out and have at least one warning. A warning about the whole file (no IUSA Number anywhere) counts every such row.
- **Duplicate groups:** one line per group, for example "SYN-0001 also appears as SYN-0500 (row 501)". More than 5 groups are inside a closed "Show all N duplicate groups".
- **Column mapping:** a table of Field, Spreadsheet column and Status, one row per field the layout has, in field order. Status is "Found" when the file has at least one of the columns the field reads, otherwise "Missing (shown as unknown)" (`MAPPING_STATUS`). Fields the layout never has are listed under the table: "Not in this layout: Phone, Website, ...". `describeMapping()` reads only the header row, never a data cell.
- **Issues:** a table of Row, Record ID, What happened (the issue's reason) and Result ("Left out" or "Kept"). A whole-file issue shows "All rows". More than 10 issues are inside a closed "Show all N issues". With none: "No problems found."
- **Continue to criteria** moves to the Criteria step. Warnings never block it. It is disabled only when there are 0 unique records, with a message ([Troubleshooting](#troubleshooting)).
- Focus moves to the step heading when Preview opens, and to the Criteria heading after Continue. Wide tables scroll inside their own box, so the page doesn't scroll sideways at phone width.

**The synthetic sample shows:** file `JCA_Synthetic_Contacts.xlsx`, layout Synthetic, sheet Contacts; Rows read 500, Duplicates grouped 1, Unique records 499, Rows left out 0, Rows with warnings 0; one group, "SYN-0001 also appears as SYN-0500 (row 501)"; 9 mapping rows, all Found, and "Not in this layout" for the other 7 fields; "No problems found."

For the Reference Solutions mapping against the full 396-column header row, every field is Found except Email (Not in this layout). Without `IUSA Number` and `Website`, those two are Missing.

### Criteria step

After Preview, the Criteria step asks what the user is trying to do and what every row must have (TR-14), then what to prefer, what to leave out and how many rows to return (TR-15). It fills the one `SearchBrief`. Code: `ui/criteria-step.tsx`, `ui/criteria-controls.tsx` (shared with the criteria summary's editors) and `ui/value-picker.tsx`, with two pure helpers, `fieldOptions()` (`normalize/field-options.ts`) and `toBrief()` (`criteria/from-form.ts`). Nothing is posted: it is a plain form handled in the browser.

- **Goal (required):** "Find prospective customers or partners" (`business_owner`) or "Find potential employers" (`job_seeker`). Neither is chosen at first. It is the only required input.
- **Must-haves (all optional):** City and State, then Industry and Title under "More must-haves (optional)". Above them: "Only rows that match every must-have are kept. Rows with a blank value for a must-have are left out." A field with nothing selected is no filter, so no geography means no geography filter.
- **Each picker** has a "Type to filter" box, a scrolling list of checkboxes such as "Phoenix (100)", "N selected" and Clear. Filtering only hides values; ticked ones stay ticked.
- **Options come from the data, never a hard-coded list.** `fieldOptions(records, field)` reads the grouped `records` (after [duplicate grouping](#duplicate-grouping)), so the counts are what ranking sees. Values are grouped by match key, so " phoenix " and "Phoenix" are one option. Unknown (blank) values aren't listed. Each option is `{ key, label, count }`: the label is the most common spelling for that key (a tie goes to the earliest row), the count is the number of records, and options are sorted by label (`localeCompare(…, "en")`, for display only).
- **Preferences** ("These change the order of the list. They don't remove rows."): Industry, Title and Company size, each with two radio buttons, No preference (default) and Prefer. Prefer shows a picker for Industry and Title, and From and To boxes (number of employees) for Company size. No preference leaves that dimension out of `preferences` and clears what was picked or typed.
- **No geography preference in the form.** City and state are must-haves only. The schema and ranking still accept a city or state preference (the geography dimension), so Phase 2's AI can use one.
- **Importance order (optional):** a checkbox, "Rank my preferences by importance" ("The first one counts most."). When ticked, the preferences set to Prefer are listed most important first, Industry, Title, Company size by default, each with Move up and Move down buttons. After a move, focus stays with the item and screen readers hear "Title moved to position 1 of 3." A preference set to No preference leaves the list; set back to Prefer, it comes back last. Unticked, the brief has no `priorityOrder` and the default weights apply.
- **Leave out** ("Rows with these values are removed. A blank value is never removed."): pickers for Industry, Title and City. There is no employee or state exclusion in the form.
- **List size:** "How many rows do you want?", a whole number from 1 to 100, default 40.
- **From form to brief:** on Continue, `toBrief()` writes the choices as a candidate brief and checks it with `searchBriefSchema`. For every picker, one value picked gives `equals`; two or more give `in`, with the values in option order. The brief gets the option labels. Company size gives `range` `{ min, max }`. Lists are in a fixed order: must-haves city, state, industry, title; preferences industry, title, employees; exclusions industry, title, city. `priorityOrder` is the preferences in the brief, in the order shown.
- **Errors**, each inline under its input and in a summary at the top that gets focus, with a link to the input. An error clears once its input is changed. The messages (`CRITERIA_FORM_ERRORS`, plus the schema's clash messages, which show on the Leave out picker) are in [Troubleshooting](#troubleshooting).
- **Continue** stores the brief as the pending brief and opens Results, which starts with the [criteria summary](#criteria-summary) ([Pending and confirmed briefs](#pending-and-confirmed-briefs)). The form's choices are kept in the wizard, so going back to Criteria shows them; loading a new workbook clears them. Changing one section never resets another.
- **City and state are separate filters.** "Springfield" with "IL" and "MO" means city in [Springfield] and state in [IL, MO], which also keeps a Springfield in a state where it isn't the one meant. Fine for Phase 1 ([KNOWN-ISSUES.md](../KNOWN-ISSUES.md#correctness-risks)).

**The synthetic sample offers:** City Glendale 100, Mesa 100, Phoenix 100, Scottsdale 99, Tempe 100; State AZ 499; Industry Business Services 100, Fabrication 100, Logistics 100, Retail 99, Technology 100; Title General Manager 124, Operations Manager 126, Owner 124 (blank titles not listed). Business owner with Phoenix and AZ gives `mustHaves` `[{ field: "city", operator: "equals", value: "Phoenix" }, { field: "state", operator: "equals", value: "AZ" }]`. Adding Prefer Fabrication, Owner and 10 to 99 with list size 40 gives exactly `BUSINESS_OWNER_BRIEF` (`criteria/examples.ts`); job seeker with Tempe and AZ, Logistics, Operations Manager, 10 to 99 and 30 gives `JOB_SEEKER_BRIEF`.

### Criteria summary

The Results step opens with "Your criteria" (TR-16): the brief in plain language, to confirm or change one item at a time before ranking. Code: `ui/criteria-summary.tsx` (inside `ui/results-step.tsx`), with the pure `describeBrief()` and `describeLines()` in `criteria/describe.ts`. The export's Criteria sheet (TR-26) reuses them.

- **One line per item, in a fixed order**, each value passed through as plain text, never HTML:
  - Goal: "Goal: find prospective customers or partners." or "Goal: find potential employers."
  - Location: city and state together, "Must be in Phoenix, AZ." Several values: "Must be in Phoenix or Tempe, AZ." Only one of them set: "Must be in AZ."
  - Other must-haves: "Industry must be Fabrication.", "Title must be Owner or General Manager."
  - Preferences, one sentence: "Prefer Fabrication, Owner, 10 to 99 employees." With an importance order: "Prefer, most important first: 1. Owner, 2. Fabrication, 3. 10 to 99 employees."
  - Exclusions, one line per field: "Leave out Retail."
  - List size: "Show 40."
  - Assumptions: one line each, or "No assumptions."
  - Lines with nothing set are left out, except list size and assumptions.
- **Items and ids.** `describeBrief()` returns `{ id, section, text }` items with stable ids: `goal`, `must-geo`, `must-industry`, `must-title`, `pref-industry`, `pref-title`, `pref-employees`, `priority`, `exclude-industry`, `exclude-title`, `exclude-city`, `list-size`, `assumptions`. A preference item's text is its part of the sentence ("Owner"); `priority` is "Most important first: Title, Industry, Company size." `describeLines()` joins the preference items into the one Preferences sentence. A brief the form can't produce (Phase 2) can also have `pref-geo`, `must-employees`, `exclude-state` and `exclude-employees`, so the summary still shows all of it; those have no Change button.
- **Change** opens an inline editor under the line for just that item, with the Criteria step's controls (`ui/criteria-controls.tsx`). The Preferences line has one button per part: Change industry, Change title, Change company size and, when ordered, Change order. Goal, location, each must-have, each exclusion and list size have one Change each. Assumptions have none (the form has no input for them).
- **Edits apply only on Save.** The editor works on a draft copy of the form that produced the brief; typing there changes nothing. Save runs `toBrief()` on the draft. If it is invalid, the error shows inline (a clash with another criterion, such as "You can't require and leave out Tempe.", is listed in the editor) and nothing changes. If it is valid, the briefs update as in [Pending and confirmed briefs](#pending-and-confirmed-briefs). Cancel discards the draft. Opening another editor cancels the open one.
- **A Save changes only that item.** Every other key in the brief stays the same. One exception follows from the schema: with an importance order on, setting a preference to No preference also removes it from `priorityOrder`.
- **Confirm and rank** (shown until results show) ranks the pending brief and shows the [counts summary](#counts-summary) and [results table](#results-table).
- **Two intro texts** (TR-37), picked by the required `afterRanking` prop (`results !== null` on the Results step), under the "Your criteria" heading:
  - Before Confirm and rank (`TEXT.intro`): "Check these before ranking. Change any item here: a change applies only when you save it."
  - Once results show (`TEXT.introAfterRanking`): "Your shortlist uses these criteria. Change any item here: the list updates when you save it."
  - The same prop hides Confirm and rank and its hint ("Nothing is ranked until you confirm.") and makes a Save announce "Updated. Results refreshed." instead of "Updated." The summary appears only on the Results step, not on the Criteria step. After Continue on the Criteria step the brief is pending again, so the first text shows until Confirm and rank.
- **The summary always shows the brief behind the results**: `results.brief` once confirmed, and the pending brief before. It is never rebuilt from form state.
- **Going back to Criteria** shows the same values as the summary, because a Save writes to the same form state. A Save starts from the form that produced the current brief, so changes made on Criteria without pressing Continue are replaced by it ([KNOWN-ISSUES.md](../KNOWN-ISSUES.md#correctness-risks)).
- **Opening an item from elsewhere.** `openItem(itemId)` (through the summary's `ref`) opens that item's editor as if its Change button were pressed, scrolls to it and focuses its first control. The [no-results helper](#no-results-helper) uses it. `editableItemName(itemId)` says whether an item has an editor.
- **Accessibility:** Change moves focus to the editor's heading. After Save or Cancel, focus returns to that item's Change button (or the "Your criteria" heading if the item is gone), and a live region says "Updated." or, once results show, "Updated. Results refreshed." After a failed Save, focus goes to the first problem. After Confirm and rank, focus moves to the results.

**With the synthetic sample**, the business owner walkthrough shows "Goal: find prospective customers or partners.", "Must be in Phoenix, AZ.", "Prefer Fabrication, Owner, 10 to 99 employees.", "Show 40." and "No assumptions." Changing the title preference to Operations Manager changes only the Preferences line and `preferences[1]` of the brief.

### Counts summary

What happened to the rows from upload to shortlist, on the Results step between the [criteria summary](#criteria-summary) and the [results table](#results-table) (TR-23). Code: `buildCounts(importSummary, rankResult)` in `ranking/counts.ts` (pure), shown by `ui/counts-summary.tsx`. `importSummary` is [`summarizeImport()`](#preview-step) for the loaded file and `rankResult` the current `rank()` result, so the numbers change with every brief or override change, from the same result the table shows.

**One source of wording.** `describeCounts(counts)` in `ranking/counts.ts` turns the counts into the lines below, with the hide-at-0 rules, and `describeCriterionCount()` writes each "Why rows were filtered out" line. The screen and the export's [Criteria sheet](#sheet-criteria) (TR-26) both show `describeCounts()`, so they always say the same thing.

**What it returns:** `{ rowsRead, skippedEmptyRows, rowsLeftOut, rowsWithWarnings, duplicatesGrouped, uniqueRecords, excluded, failedMustHave, failedOnlyMissing, eligible, omittedByUser, pinned, notShownListSize, exported, byCriterion, listSize }`. `listSize` is the brief's list size, for the "not shown" line.

- The import figures come from `summarizeImport()`, the filter figures from [filtering](#filtering).
- `omittedByUser`: omitted rows that are still eligible (`omittedRows`). `pinned`: pinned rows in the shortlist.
- `exported`: the shortlist length, after pins and omits: exactly what the Excel file will contain.
- `notShownListSize`: `eligible - omittedByUser - exported`, never below 0.
- `byCriterion`: filtering's `byCriterion`, each with a `label` (`criterionLabel()`): `Leave out Industry`, `Must-have City`, `Must-have Company size` and so on.

**Checks.** `buildCounts()` throws an error naming the numbers when any of these fails, so a bug shows up instead of wrong figures:

- `rowsRead = rowsLeftOut + duplicatesGrouped + uniqueRecords`
- `uniqueRecords = excluded + failedMustHave + eligible`
- `exported <= eligible - omittedByUser`, or `exported = pinned` when there are more pins than the list size

**On screen:** "From your file to your shortlist", an ordered list in the order the data flows (read, clean, group, filter, override, cut), so each line follows from the one above. "Rows left out" and "rows with warnings" are separate lines: left out rows are gone, warned rows are still included and don't reduce any count.

| Line | Text | Hidden at 0 |
|---|---|---|
| Rows read | `500 rows read from your file` | No |
| Empty rows | `N empty rows skipped` | Yes |
| Left out | `N rows left out because of problems in the file` | No |
| Warnings | `N rows have warnings (still included)` | Yes |
| Duplicates | `1 duplicate grouped` | No |
| Unique | `499 unique records` | No |
| Excluded | `N removed by your Leave out rules` | No |
| Must-haves | `399 didn't meet your must-haves (0 only because a value was blank)` | No |
| Eligible | `100 match your criteria` | No |
| Omitted | `N omitted by you` | Yes |
| Not shown | `60 more matches not shown (list size 40)` | Yes |
| Exported | `40 in your shortlist and export` (bold) | No |

Under it, a closed `<details>` "Why rows were filtered out" lists one line per `byCriterion` entry, for example `Must-have City: 399 rows (0 with a blank value)` (exclusions have no blank count, since a blank never matches a Leave out rule), then `A row can fail more than one rule, so these can add up to more than the total.` It isn't shown when the brief has no exclusions or must-haves.

**With the synthetic sample:**

| Brief | Lines |
|---|---|
| Business owner | 500 read, 0 left out, 1 duplicate, 499 unique, 0 removed, 399 didn't meet the must-haves (0 only blank), 100 match, 60 not shown (list size 40), 40 in the shortlist and export. Why: Must-have City 399 (0 blank), Must-have State 0 |
| Job seeker | Same to 100 match, then 70 not shown (list size 30), 30 in the shortlist and export |
| Business owner, omit SYN-0001 | 1 omitted by you, 59 not shown, 40 in the shortlist and export |
| Business owner, leave out Retail | 99 removed, 320 didn't meet the must-haves, 80 match, 40 not shown, 40 in the shortlist and export |
| Must Phoenix, AZ and title Operations Manager | 474 didn't meet the must-haves (25 only blank), 25 match, no "not shown" line, 25 in the shortlist and export. Why: Must-have Title 373 (125 blank) |

### Results table

The shortlist on the Results step (TR-22). Code: `ui/results-table.tsx`, inside `ui/results-step.tsx`, with `missingFields()` and `contactLines()` (the Contact fallback below, moved out of the table in TR-31 so it can be tested) in `ranking/missing.ts`.

**Above the table:** the [counts summary](#counts-summary), an **Edit criteria** button that scrolls to the [criteria summary](#criteria-summary) and moves focus to its "Your criteria" heading, and [Pin by Record ID](#pin-and-omit). **Below it:** "Omitted by you (N)" with Restore, then **Continue to export**. An empty shortlist shows the [no-results helper](#no-results-helper) instead of the table.

**Columns**, one row per business:

| Column | Shows |
|---|---|
| Rank | `rank`, and a `Pinned by user` badge for a pinned row |
| Company | The company name |
| Location | `City, ST`, or the one part that is known |
| Name | The main contact's name |
| Title | The main contact's title |
| Contact | See the fallback order below |
| Score | `displayScore` (rounded) |
| Why | The row's [`reasons`](#match-reasons), one per line, exactly as ranking wrote them |
| Missing | `missingFields()` joined with ", ", or `None` |
| Actions | Pin or Unpin, Omit, Details |

A value the row doesn't have shows `Unknown`, in a muted style but as real text, so it doesn't rely on colour.

**Contact fallback order:** the email when the row has one; otherwise the phone and the website, each that is known, on separate lines; otherwise `Unknown`. The synthetic layout has an email column and no phone or website; Reference Solutions exports have no email column, so they show phone and website.

**No links in results.** Email and website are plain text, never `mailto:` or web links. The values come from a spreadsheet, so plain text avoids any link-scheme risk and needs no URL cleanup. They can still be selected and copied.

**The Missing rule** (`missingFields(record, mapping)`, `mapping` being [`describeMapping()`](#preview-step) for the loaded file): the labels of the shown fields the row has no value for, in this order: Name, Title, Contact, Company size.

- A field is listed only when the file has a column for it (status Found). A column missing from the whole file, or not in the layout, is already explained on the Preview step, so it isn't repeated on every row.
- **Contact** is listed only when email, phone and website are all unknown, and the file has at least one of those columns. In the Reference Solutions layout, email is never listed (no such column): Contact is missing only when phone and website are both blank.
- **Company size** is the employee count, which [normalizing](#cleaning-values) fills from the employee range when the count is blank, so it is listed only when both are blank. Either column counts as the file having it.
- The export (TR-25) uses the same function, so its Missing column matches the screen.

**Details** (in the table, a button that opens a row under that row, with `aria-expanded` and `aria-controls`; on a card, a `<details>`), showing only what has a value:

- Other executives, one `Name, Title` per line, all of them
- Industry (NAICS): the NAICS description
- Employee range
- Address: address and ZIP
- Where the row is in the file: `Row 2 in your file`, plus `Also in your file as SYN-0500 (row 501)` when exact duplicates were [grouped](#duplicate-grouping) into it

**Desktop and phone.** From the `md` breakpoint up the shortlist is a `<table>` with a visually hidden caption "Your shortlist", `<th scope="col">` headers and the company as each row's header. Below `md` it is a list of cards with the same data: rank, company and score at the top, then location, name, title, contact, reasons and missing, then Details, then Pin and Omit. Both are built from one view of each row, so they can't differ. Both are rendered and CSS hides one; a hidden one (`display: none`) is left out of the accessibility tree. At most 100 rows, so the extra markup is small.

**Width.** At 400 px and 375 px nothing scrolls the page sideways: long values (emails, websites) wrap. On wider screens the table scrolls inside its own box when it is wider than the page; the box is focusable, so keyboard users can scroll it, and an open Details row stays at the box's left edge. The 10 columns are wider than the admin content area even at 1280 px, so on the admin page the right-hand columns (Why, Missing, Actions) are reached by scrolling that box.

**Accessibility.** Every button is at least 44 px high and names its record for screen readers ("Omit SYN-0001"). Focus after Pin, Unpin, Omit and Restore follows [Pin and omit](#pin-and-omit).

**With the synthetic sample** (business owner brief): 40 rows; row 1 is SYN-0001 (Synthetic Company 0001), Phoenix, AZ, score 100, 4 reasons, Missing `None`, Details `Row 2 in your file` and `Also in your file as SYN-0500 (row 501)`. With the title preference changed to Operations Manager, SYN-0006 is first at 100, and SYN-0011 (rank 8, 64) shows Title `Unknown`, Contact `Unknown` and Missing `Title, Contact`. Pinning SYN-0496 puts it at rank 1 with the badge and Missing `Company size`.

### No-results helper

When the shortlist is empty, the Results step shows "No matches for these criteria" instead of the [results table](#results-table), with hints that say why and an **Edit** button that opens the criterion to change (TR-24). Code: `diagnoseEmpty(records, brief, rankResult)` in `ranking/diagnose.ts` (pure), shown by `ui/no-results.tsx`.

**What it returns:** `{ kind, hints }`, each hint `{ text, itemId, removed }`. `itemId` is the [criteria summary](#criteria-summary) item to open, from `summaryItemFor(stage, field)` in `criteria/describe.ts` (`must-geo` for a city or state must-have, `must-industry`, `exclude-industry` and so on), or null when no single criterion is to blame. `removed` is how many records the hint's filter removes. Every count is over the grouped `records` (499 for the sample), the same records as the [counts summary](#counts-summary). Values are the brief's own, as written, in plain text. Hints never name a value that isn't in the brief, so there are no guesses at "similar" cities.

**Kinds**, decided in this order:

| Kind | When | Hints |
|---|---|---|
| `all-omitted` | Records are eligible, but the user omitted every one | `You omitted every match. Restore some below.` (no Edit) |
| `no-value` | A must-have matches 0 records on its own (`matchCriterion()` on every record) | One per such must-have, see below |
| `combination` | Each must-have matches some records on its own, but no record matches all of them | `Each must-have matches some records, but no record matches all of them.`, then one per must-have, fewest matches first: `Must-have Title (Owner): 124 records on its own.` |
| `excluded` | Some records meet every must-have, but Leave out rules removed all of them | One per Leave out rule that removed any of them: `Your Leave out rule for Industry removed 20 records.` The number counts only records that met every must-have, so it can be lower than the rule's line in "Why rows were filtered out", which counts every record |

`no-value` wording, by field:

| Field | Text |
|---|---|
| city | `No records are in Flagstaff. Try another city.` Several values: `No records are in Flagstaff or Yuma. Try another city.` |
| state | `No records are in TX. Try another state.` |
| industry | `No records are in the Mining industry. Try another industry.` |
| title | `No records have the title CEO. Try another title.` |
| employees | `No records have 500 to 999 employees. Try a wider range.` |

**Order and limit.** At most 3 hints name a filter: the ones that removed the most first, ties in brief order. For a must-have, "removed" is the records it fails on its own, so the hint points at the filter to loosen. The combination's opening line comes before them.

**Blank data note.** With any kind, when some records failed only because a must-have value was blank (`failedOnlyMissing` above 0), a note follows for each such field, with an Edit button for that must-have: `25 records have a blank Title, so they can't meet that must-have.` A record blank on two must-have fields counts under both.

**Edit** calls `openItem(itemId)` on the criteria summary, which opens that item's inline editor (cancelling any other), scrolls to it and focuses its first control. Saving re-ranks as usual. A hint for an item the summary can't edit (`must-employees`, `exclude-state` and `exclude-employees`, which only a Phase 2 brief can have) has no Edit button. Each Edit button names its item for screen readers ("Edit location").

**Reaching each kind from the form.** The form only offers values found in the file, so `no-value` can't happen from the form today; it can with a Phase 2 brief or a changed file. With the synthetic sample `combination` can't either: the file has one state (AZ), and every pairing of its cities, industries and titles has records. `excluded` and `all-omitted` can. All four are checked through `diagnoseEmpty()` directly.

**With the synthetic sample:**

| Brief | Kind | Hints |
|---|---|---|
| Must city Flagstaff, state AZ | `no-value` | `No records are in Flagstaff. Try another city.` (Edit location) |
| Must state TX | `no-value` | `No records are in TX. Try another state.` |
| Must city Flagstaff or Yuma | `no-value` | `No records are in Flagstaff or Yuma. Try another city.` |
| Must title CEO | `no-value` | `No records have the title CEO. Try another title.`, then `125 records have a blank Title, so they can't meet that must-have.` |
| Must Phoenix, AZ, title Owner, 40 employees (Phase 2 brief) | `combination` | Opening line, then City (Phoenix) 100, Company size (40 employees) 120, Title (Owner) 124. State (AZ, 499) is the fourth, so it isn't shown |
| Must Phoenix, AZ; leave out every industry found in Phoenix | `excluded` | `Your Leave out rule for Industry removed 100 records.` Removing Retail from that rule brings back the 20 Phoenix Retail records |
| Must Phoenix, AZ, title Operations Manager; omit all 25 | `all-omitted` | `You omitted every match. Restore some below.`, then `25 records have a blank Title, so they can't meet that must-have.` |

### Export step

**Continue to export**, at the bottom of the Results step, opens it (TR-25; the button isn't shown for an empty shortlist). Code: `ui/export-step.tsx`.

- It says `40 records will be exported.` (the [counts summary](#counts-summary)'s `exported`) and has a **Download Excel** button.
- The button builds the workbook ([Excel export](#excel-export)), wraps it in a `Blob` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `XLSX_MIME_TYPE`), clicks a temporary `<a download>` with an object URL and revokes the URL a second later (Firefox can cancel a download whose URL is revoked straight away). The file name is `JCA_Shortlist_Synthetic_Demo_YYYY-MM-DD.xlsx`, using the local date.
- Next to the button: `This file is a synthetic demonstration. All companies and people are fictional.`
- While it builds, the button is disabled and the step says `Preparing your file...`; focus goes back to the button afterwards. If it fails, the step shows a message ([Troubleshooting](#troubleshooting)) and the console gets only `[translator] export-failed`, never the error itself.

## Excel export

The export builds an Excel file of the shortlist in the browser (TR-25), with a second sheet that records how the list was made (TR-26). Code: `shortlistTable(rankResult, mapping)` in `export/shortlist-rows.ts` and `criteriaTable({ rankResult, counts, source, now })` in `export/criteria-rows.ts` (both pure, no ExcelJS), `buildWorkbook(rankResult, mapping, { counts, source, now })` in `export/workbook.ts`, `setTextCell()` in `export/cells.ts`, `assertNoFormulas()` in `export/workbook.ts` and `shortlistFileName()` in `export/file-name.ts`. `mapping` is [`describeMapping()`](#preview-step) for the loaded file; `source` (file name, layout label, sheet name and the allowlist SHA-256) and `counts` come from the wizard, `now` is the time of the click.

**Browser only.** No Server Action, no upload, no file on a server: the workbook is built from the `rank()` result in memory. ExcelJS is loaded with `await import()` on the first click, like the parser, so the first click also downloads that code from the site; after that a download makes no request. The uploaded workbook's bytes are never read or changed, so its hash still passes the [file gate](#file-gate) afterwards.

**Formula safety (TR-27).** A cell starting with `=`, `+`, `-` or `@` must never run as a formula, and the uploaded file must stay as it was:

- **Literal text cells.** Every text cell in both sheets, headers included, is written by `setTextCell(cell, value)`, the only text writer in the export. It sets the value to the plain string (never an object such as `{ formula }`, `{ richText }` or `{ hyperlink }`), so the file stores a string cell (`t="s"`), which Excel and Google Sheets never calculate. `=SUM(1,1)` shows as `=SUM(1,1)`, not 2.
- **Text format.** `setTextCell()` also sets Excel's Text format (`@`), so if someone opens the cell in Excel and presses Enter, it stays text instead of becoming a formula.
- **No prefix.** The value is written exactly as it is: no leading `'`, space or tab. That is a fix for CSV files; in .xlsx a string cell is never a formula, and a visible `'` would change the data. So `'quoted` stays `'quoted` and a value starting with a tab keeps its tab.
- **Guard before saving.** `buildWorkbook()` calls `assertNoFormulas(workbook)` right before writing the file. It checks every cell of every sheet and, if one is a formula (its type is Formula, or its value has `formula` or `sharedFormula`), throws `Export blocked: a cell would contain a formula.` The Export step then shows its usual failure message. Nothing writes a formula today; the guard makes a later mistake fail instead of shipping a file that calculates.
- **The source file is never modified.** The export reads only `rankResult`, `counts` and the `source` details. The wizard keeps the gated `ArrayBuffer` read-only, for hashing and parsing only, and never passes it to the export. The download is always a new `Blob` with its own name; nothing is saved over the uploaded file.

**File name.** `JCA_Shortlist_Synthetic_Demo_YYYY-MM-DD.xlsx`, using the local date (`shortlistFileName()`).

**Synthetic labels (TR-28).** Every export says it is synthetic: the note next to Download, the file name, the file's properties (Creator `JCA Data Axle Translator`, Title `JCA Data Axle Translator shortlist (synthetic demonstration)`, Subject `Synthetic demonstration`, in `export/labels.ts` with the note `SYNTHETIC_NOTE`), row 1 of the Shortlist sheet and the note at the top of the Criteria sheet.

### Sheet `Shortlist`

Exactly `rankResult.shortlist`, in the same order, so it has as many rows as the counts summary's "in your shortlist and export". **Omitted rows aren't on it**: the Criteria sheet lists them with the overrides. Columns, in order:

| Column | Value | Cell |
|---|---|---|
| Rank | `rank` | Number |
| Record ID | The Record ID | Text |
| Duplicate IDs | `duplicateIds` joined with `, ` (`SYN-0500`) | Text |
| Source row | `sourceRow`, the row in the uploaded file | Number |
| Company, Name, Title, City, State, Industry | The tidy `value` | Text |
| Employees | The actual count. Empty when unknown or read from the size range | Number |
| Employee range | The `employeeRange` text as written, so a range-only row still shows its size | Text |
| Email, Phone, Website | The tidy `value`. Always present, even when the layout has no such column (Reference Solutions has no email) | Text |
| Other executives | `Name (Title); Name (Title)`. No `()` when the title is blank, `(Title)` alone when the name is | Text |
| Score | `displayScore`, the rounded score shown on screen | Number |
| Reasons | `reasonText` from [Match reasons](#match-reasons), unchanged | Text |
| Missing | [`missingFields()`](#results-table) joined with `, `, the same as on screen | Text |
| Override | `Pinned`, or empty | Text |

- **Blanks stay blank.** A value the row doesn't have is left as a truly empty cell (`shortlistTable()` gives `null`): never `""`, `Unknown` or `None`. The same goes for an empty Duplicate IDs, Other executives, Missing or Override.
- **Text and numbers.** Only Rank, Source row, Employees and Score are numbers. Everything else is stored as text with Excel's Text format (`@`), so a long IUSA Number or a phone number never becomes a number or scientific notation, even when the source cell was a number. Excel may mark a digits-only Record ID with a small "number stored as text" triangle; that is expected. The sheet has no ZIP column.
- **Layout (TR-28).** Row 1: `Synthetic demonstration. All companies and people are fictional.` in bold. Row 2: blank. Row 3: the bold header row. Shortlist rows start on row 4. Frozen at row 3 (`ySplit: 3`, so the note and header stay in view), with a filter from the header (row 3) over every row. Column widths are set; Reasons and Other executives wrap.

**With the synthetic sample:**

| Brief | Sheet |
|---|---|
| Business owner | Note, blank row, header and 40 rows. The first shortlist row (sheet row 4): SYN-0001, Duplicate IDs `SYN-0500`, Source row 2, Employees 25, Score 100, Reasons = SYN-0001's `reasonText`, Missing and Override empty |
| Title preference Operations Manager | SYN-0006 first at 100. SYN-0011 (rank 8): Title and Email empty, Missing `Title, Contact` |
| Business owner, pin SYN-0496 | Rank 1 SYN-0496, Override `Pinned`, Score 0, Reasons start with `Pinned by user; `, Missing `Company size` |
| Business owner, omit SYN-0001 | 40 rows, SYN-0001 not on the sheet, SYN-0101 first |

Invented Reference Solutions-layout records give an empty Email column, filled Phone and Website, Other executives such as `Demo Beta (President); Demo Gamma`, and a 9-digit IUSA Number as text.

### Sheet `Criteria`

After `Shortlist`, sheet `Criteria` records exactly how the list was made, so it can be explained, checked or repeated later (TR-26). Everything about the run comes from `rankResult`, the same result the Shortlist sheet was made from, never from the form: the Criteria rows describe `rankResult.brief`, so a role changed in the criteria summary shows the revised role, and the scoring version is `rankResult.scoringVersion`, recorded from `SCORING_VERSION` when the list was ranked.

Two columns, `Item` (width 28) and `Details` (width 90), with a bold, frozen header. Each section has its heading in bold on its own row, with a blank row between sections. Every cell is text through `setTextCell()`, wrapped, so the scoring version stays `1.0` and never becomes the number 1. In order:

| Section | Rows |
|---|---|
| (top, no heading) | `JCA Data Axle Translator: how this list was made` (bold), then `Synthetic demonstration. All companies and people are fictional.`, each across both columns |
| Created | `Date and time`: local time with its offset from UTC (`localDateTime()`), `2026-11-16 11:24 (UTC+05:30)` |
| Source file | `File name` (the uploaded file's name), `Layout` (detected from the headers: `Synthetic`), `Sheet` (`Contacts`), `SHA-256` (the hash the [file gate](#file-gate) matched in the allowlist) |
| Criteria | One row per [criteria summary](#criteria-summary) line (`describeLines(rankResult.brief)`), labelled `Goal`, `Must-haves`, `Preferences`, `Leave out`, `List size` or `Assumptions`: the same sentences as on screen, such as `Prefer Fabrication, Owner, 10 to 99 employees.` |
| Scoring | `Scoring version`; `Weights mode`: `Default weights` or `Ordered by importance` (the brief has a priority order); then one row per active dimension, heaviest first: `Industry`, `35 (50%)`, the share of the active total rounded to 1 decimal. No preferences: `Weights`, `No preferences, so all scores are 0.` |
| Counts | One row per [counts summary](#counts-summary) line (`describeCounts()`), in the Details column, identical to the screen. The "Why rows were filtered out" lines aren't on the sheet |
| Overrides | `Pinned`: the pinned Record IDs joined with `, `, or `None`. `Omitted`: `None`, or the number of omitted records followed by one row each, `SYN-0001`, `Synthetic Company 0001, score 100` (the rounded score shown on screen). Omitted rows are listed here because they aren't on the Shortlist sheet |
| Technical | `Brief (JSON)`: `JSON.stringify(rankResult.brief)`. Parsing it gives back the exact brief, so with the same file (checked by its SHA-256) the run can be repeated and gives the same list |

**With the synthetic sample** (all at `now` 2026-11-16 11:24, UTC+05:30):

| Brief | Criteria sheet |
|---|---|
| Business owner | `Must be in Phoenix, AZ.`, `Prefer Fabrication, Owner, 10 to 99 employees.`, `Show 40.`; Scoring version `1.0`, `Default weights`, Industry `35 (50%)`, Title `25 (35.7%)`, Company size `10 (14.3%)`; the 9 count lines from `500 rows read from your file` to `40 in your shortlist and export`; Pinned `None`, Omitted `None`; Source file `JCA_Synthetic_Contacts.xlsx`, `Synthetic`, `Contacts`, `67a5108...580b` |
| Title preference Operations Manager | `Prefer Fabrication, Operations Manager, 10 to 99 employees.` |
| Ordered: title, industry, company size | `Ordered by importance`; Title `4 (44.4%)`, Industry `3 (33.3%)`, Company size `2 (22.2%)` |
| No preferences | `No preferences, so all scores are 0.` |
| Pin SYN-0496, omit SYN-0001 | Pinned `SYN-0496`; Omitted `1 record`, then `SYN-0001`, `Synthetic Company 0001, score 100`; counts add `1 omitted by you` and `59 more matches not shown (list size 40)` |

## Tests

Unit tests run with Vitest: `npm run test` runs every test once, `npm run test:watch` re-runs them on save (TR-29). Config: `vitest.config.ts` (Node environment, files matching `src/**/*.test.ts`, the `@` alias). They sit beside the code as `*.test.ts` and run in Node, with no browser, no network, no environment variables and no random data. When to run them (before every commit and PR) and the rules for changing them: [WAY-OF-WORKING.md](../WAY-OF-WORKING.md#testing). There is no CI.

**Run one file or one test.** Vitest filters by a part of the file path, and `-t` by test name:

```bash
npm run test -- walkthroughs                     # only ranking/walkthroughs.test.ts
npm run test -- src/features/translator/import   # every test under import/
npm run test -- edge-cases -t "file gate"        # tests in edge-cases.test.ts whose name contains "file gate"
```

**What each file covers** (all under `src/features/translator/`):

| File | Covers |
|---|---|
| `import/check-file.test.ts` | `checkWorkbookFile()`: count, empty, size, extension and ZIP signature |
| `import/file-gate.test.ts` | `checkAllowlist()`: both samples (and their `public/translator/` copies) accepted, altered copies refused, and the allowlist holds exactly the expected entries |
| `import/parse.test.ts` | `parseWorkbook()`: the synthetic sample, choosing the sheet, layout detection, rows, files that aren't workbooks |
| `import/validate-headers.test.ts` | Missing, optional and duplicate headers, with their exact messages |
| `import/cell-value.test.ts` | `toSourceCell()` and malformed cells: rich text, formulas, links, errors, dates |
| `import/formula-text.test.ts` | Formula-like text comes through import unchanged, as text |
| `import/map-row.test.ts` | `mapRow()` for both layouts (TR-04's Reference Solutions fixture row), `generatedRecordId()`, `normalizeHeader()`, and the Reference Solutions mapping against the real header list |
| `normalize/normalize.test.ts` | Match keys, unknown values, employee counts and the range fallback |
| `normalize/validate-rows.test.ts` | Invalid employee counts, duplicate Record IDs, generated IDs |
| `normalize/duplicates.test.ts` | Grouping in the sample (SYN-0500 under SYN-0001), exact and possible duplicates |
| `ranking/walkthroughs.test.ts` | The three spec walkthroughs (TR-30) from the sample's bytes through `runPipeline()`: counts, first 8 rows, last row, score spread, the role change's export builders, repeat runs, 3 seeded shuffles, and the golden files |
| `rs-sample.test.ts` | The [Reference Solutions sample](#the-reference-solutions-sample) (TR-35): its 396 headers, that only mapped columns are filled and every value is invented, the import figures, every documented row, the Phoenix fabrication shortlist and the export's Phone, Website and empty Email |
| `edge-cases.test.ts` | The spec edge cases (TR-31), each from a real file (below) |

`edge-cases.test.ts` in detail: a city not in the workbook (`no-value`, `No records are in Flagstaff. Try another city.`, Edit location), a required title with blank titles, the upload path through `loadWorkbook()` from a `File` (the sample and the Reference Solutions sample accepted; a copy with one cell changed and a copy re-saved with no edits refused by the file gate before parsing; a file over 2 MB refused at the size check), the Reference Solutions sample end to end (generated IDs and their warnings, other executives through to the export, no email and when Contact is missing, range-only sizes and the range fit rule, the job seeker brief with reasons from each record's own values, the Contact fallback), pins the ranking refuses (an excluded row, a grouped duplicate), and formula-like text in the export (every text cell a literal string with the Text format, no formula in the file, `assertNoFormulas()` throwing on a planted formula).

The ranking modules (`filter.ts`, `score.ts`, `sort.ts` and the rest), `criteria/` and the export builders have no test file of their own: they are covered through `runPipeline()` in the walkthrough, sample and edge case tests. The UI has no tests; check it by hand.

**Fixtures** live in `src/features/translator/__fixtures__/` and are built in code, never committed as binary workbooks, so every fixture can be read in review and a header change is a one-line diff:

- `build-workbook.ts`: `buildXlsx({ sheets: [{ name, rows }] })` writes an `.xlsx` in memory with ExcelJS from plain arrays, with helpers for rich text, formula, hyperlink, error and date cells, and `toArrayBuffer()`.
- `records.ts`: invented rows and row builders for both layouts (`TST-` IDs, `Test Company 01` names, `.invalid` emails), and `seededShuffle(items, seed)`, a shuffle that gives the same order for the same seed.
- `rs-headers.ts`: the 396 Reference Solutions headers in order, blank last column included, copied from the "Header Inventory" sheet of `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`. Headers only.
- `rs-row.ts`: the TR-04 fixture row and the record it must map to.
- `import-pipeline.ts`: `importWorkbook(buffer)` runs parse, normalize, row checks and duplicate grouping in the wizard's order; `importRows(rows)` builds a one-sheet workbook and imports it.
- `pipeline.ts`: `runPipeline(buffer, brief, overrides?)` runs that import, then `summarizeImport()`, `rank()` and `buildCounts()`, and returns the import state, `records`, `rankResult`, `counts` and `mapping` (for the export builders). The real functions in the wizard's order, with no shortcuts.
- `walkthroughs/`: the golden files, one per walkthrough (`business-owner.json`, `role-change.json`, `job-seeker.json`). Each is the full shortlist as `rank`, `recordId`, `displayScore` and `reasonText`, generated once from the sample, checked by hand against the [Expected results](#expected-results) and committed. The tests compare against them; there are no Vitest snapshots, so nothing can be accepted with `-u`. **Changing a golden file needs a reason in the PR**: which rows changed and why ([WAY-OF-WORKING.md](../WAY-OF-WORKING.md#testing)).

**The allowlist rule.** Fixtures are never allowlisted. Tests call `parseWorkbook()` directly, past the [file gate](#file-gate). `import/file-gate.test.ts` checks that the allowlist has exactly the expected entries (the two samples), so adding one fails the tests until that list is changed on purpose.

- The two committed samples are read from `docs/translator/` with `fs`, in tests only (`SAMPLE_PATH` and `RS_SAMPLE_PATH` in `records.ts`). Fixtures are invented: never copy rows from any real export into them.
- App code never imports a test or a fixture, so neither reaches the build.
- From [Expected results](#expected-results), the tests lock in the import figures (500 rows read, 0 issues, 499 unique with SYN-0500 grouped under SYN-0001), the altered copy rejected by the file gate, the three walkthroughs (TR-30), the Reference Solutions sample rows (TR-35) and the edge case rows (TR-31: city not in the workbook, required title, altered and re-saved copies).

## Expected results

The first three rows (the spec walkthroughs, with the TR-30 numbers: first 8 rows, last row and score spread) and the repeat row are locked in by `ranking/walkthroughs.test.ts` and the golden files in `src/features/translator/__fixtures__/walkthroughs/` ([Tests](#tests)). City not in the workbook, required title, the altered and re-saved copies and the Reference Solutions rows are locked in by `edge-cases.test.ts` (TR-31) and `rs-sample.test.ts` (TR-35). Scores in "Scores of the 100 eligible" are unrounded scores rounded to 2 decimals; the others are display scores.

| Scenario | Expected |
|---|---|
| Phoenix, AZ must-have; prefer Fabrication, Owner, 10 to 99; 40 rows | 500 in, 1 duplicate (SYN-0500 under SYN-0001), 499 unique, 0 excluded, 399 failed a must-have (0 only because of missing data), 100 eligible, 40 out (counts summary: 60 not shown, 40 in the shortlist and export), SYN-0001 first at 100. SYN-0001 is the only 100. First 8: SYN-0001 100, SYN-0101 86, SYN-0201 86, SYN-0301 86, SYN-0401 86, SYN-0006 64, SYN-0011 64, SYN-0026 64. Row 40: SYN-0441 (36). Scores of the 100 eligible: 100 (1), 85.71 (4), 64.29 (7), 50 (10), 35.71 (20), 14.29 (19), 0 (39) |
| Same, title Owner changed to Operations Manager | SYN-0006 first at 100, with `Title: Operations Manager (preferred)` in its reasons ([Match reasons](#match-reasons)). First 8: SYN-0006, SYN-0026, SYN-0126, SYN-0226, SYN-0326, SYN-0426 (all 100, tied, so ordered by Record ID), SYN-0001 64, SYN-0011 64 (8th, with `Title unknown`). Row 40: SYN-0476 (50). Scores of the 100 eligible: 100 (6), 64.29 (2), 50 (33), 0 (59) |
| Tempe, AZ; prefer Logistics, Operations Manager, 10 to 99; 30 rows | 100 eligible, 30 out, SYN-0002 first at 100, tied with 6 others (first by Record ID). First 8: SYN-0002, SYN-0007, SYN-0027, SYN-0127, SYN-0227, SYN-0327, SYN-0427 (all 100), SYN-0012 64. Row 30: SYN-0347 (50). Scores of the 100 eligible: 100 (7), 64.29 (1), 50 (33), 0 (59) |
| Business owner, list size 1 / 100 | 1 row (SYN-0001) / all 100 eligible rows |
| Same brief twice, or the records shuffled first | Identical `shortlist`, reasons included. Checked for each walkthrough: run twice, and with the records shuffled by 3 fixed seeds |
| Business owner, pin SYN-0496 | 40 rows, SYN-0496 first at 0 with `Pinned by user`, SYN-0001 second, SYN-0441 out ([Pin and omit](#pin-and-omit)) |
| Business owner, omit SYN-0001 | 40 rows, SYN-0461 comes in at 40 |
| Same brief and overrides twice, records shuffled, or pins made in another order | Identical `shortlist` |
| Any brief, every row in `ranked` | At least one reason, none empty, no em-dashes |
| Phoenix, AZ; prefer only Fabrication and 10 to 99 | Active weight total 45. Both match 100, industry only 77.78, employees only 22.22 |
| No preferences | Every score 0, empty breakdown |
| Prefer city Phoenix and state AZ; a Mesa, AZ row | Geography no match, 0 points |
| City not in the workbook | 0 eligible; empty list with `No records are in [city]. Try another city.` ([No-results helper](#no-results-helper)). The form can't produce this brief, so it is checked through `diagnoseEmpty()` |
| Required title Operations Manager | Rows with unknown title fail that filter. With Phoenix, AZ: 25 eligible, 474 failed a must-have, 25 only because of missing data |
| Business owner, Excel export | `JCA_Shortlist_Synthetic_Demo_YYYY-MM-DD.xlsx`. Sheet `Shortlist`: note on row 1, header on row 3, 40 rows from row 4, SYN-0001 first with Duplicate IDs `SYN-0500` and Score 100 ([Excel export](#excel-export)) |
| Title Operations Manager, Excel export | SYN-0011's Title and Email cells empty (not `""` or `Unknown`), Missing `Title, Contact` |
| Any Excel export | Sheets `Shortlist`, then `Criteria` ([Sheet `Criteria`](#sheet-criteria)); Scoring version `1.0`, the same as `SCORING_VERSION`; Brief (JSON) parses back to `rankResult.brief` |
| Title changed to Operations Manager in the criteria summary, then exported | Criteria sheet: `Prefer Fabrication, Operations Manager, 10 to 99 employees.` |
| Altered copy of the workbook | Rejected by the file gate |
| Copy opened and saved again with no edits | Rejected by the file gate, like any changed file |
| Reference Solutions sample (`JCA_Synthetic_RS_Layout.xlsx`), import | Accepted by the file gate; layout Reference Solutions; 100 read, 1 duplicate (`900000100` under `900000001`), 99 unique, 0 left out, 10 generated IDs (`ROW-0007` to `ROW-0088`, [documented rows](#documented-rows)) |
| Reference Solutions sample, Phoenix fabrication owners brief | 25 eligible, 25 out, `900000001` first at 100. Export: Phone and Website filled, Email empty on every row |

## How to add a new input format

A new layout is mostly config, but a few places name the existing layouts. Work through this list in order. Paths are under `src/features/translator/`.

1. **Mapping file.** Add `import/mappings/<name>.ts` exporting a `LayoutMapping` (`import/mappings/types.ts`): an `id`, a `label` (shown on Preview and in the export's Criteria sheet), `signatureHeaders`, `requiredHeaders`, `requiredFields` (normally `REQUIRED_FIELDS`) and one rule in `fields` for every internal field (`column`, `join`, `firstNonBlank`, `none`, `generatedId` or `repeated`). Write headers exactly as the source file has them. Rules for the two header lists ([Signature and required headers](#signature-and-required-headers)):
   - `signatureHeaders`: at least 2, each a header no other layout has, so the layouts can't be confused. Never `City` or `State`.
   - `requiredHeaders`: the columns behind company, city, state and industry (and the ID column if it can't be generated), in the order the "Missing required columns" message should list them.
2. **Register it.** Add the new id to `MAPPING_IDS` in `import/mappings/types.ts` and the mapping to `LAYOUT_MAPPINGS` in `import/mappings/index.ts`; `detectLayout()` in `import/parse.ts` reads that list, so nothing else is needed for detection. If you will allowlist a file in this layout, add the id to the `layout` type of `AllowedWorkbook` in `import/allowlist.ts` too. Then check the signatures don't clash: no test does this today, so add one (for example in `import/parse.test.ts`) that, for every pair of mappings, finds no shared signature header, and that a file in each existing layout is still detected as before.
3. **New fields** (only if the format has information no current field holds):
   1. Add the field to `CORE_FIELDS`, `CONTACT_FIELDS` or `EXTRA_FIELDS` and a label to `FIELD_LABELS` in `import/fields.ts`, and a rule for it (`none` where absent) in every mapping.
   2. Normalize it in `normalize/normalize.ts` (and `normalize/types.ts`); if it will be matched, it needs a match key (`CATEGORY_FIELDS`).
   3. Decide whether it is **ranked** or **display only**. Display only: show it in the results table's Details and, if wanted, the Shortlist sheet (`export/shortlist-rows.ts`). Ranked: add it to `BRIEF_FIELDS`, `OPERATOR_FIELDS` and `FIELD_DIMENSION` in `criteria/schema.ts`, give it a dimension and weight in `ranking/weights.ts` (a new dimension also needs `BRIEF_DIMENSIONS` and a fifth `ORDERED_WEIGHTS` value), support it in `matchCriterion()` (`ranking/match.ts`), and add its wording to `criteria/describe.ts`, `FIELD_NAMES` in `ranking/counts.ts`, `ranking/reasons.ts` and `ranking/diagnose.ts`. That is a scoring change, so also follow [How to change scoring](#how-to-change-scoring).
4. **What picks it up automatically, and what to check.** `describeMapping()` builds the Preview column mapping from any mapping; the Preview step, `missingFields()` and the export read that. Check: the Preview mapping shows the right column for every field and "Not in this layout" for the rest; Missing only lists fields the layout has; Contact falls back correctly when the layout has no email (or no phone and website); the Shortlist sheet's columns are filled; the Criteria sheet shows the new `label`. Also check the places that name a layout: the whole-file "no row has an ID" summary in `validateRows()` (`normalize/validate-rows.ts`) only runs for `reference-solutions`, and the "couldn't recognize" message in `import/parse.ts` names the Reference Solutions export.
5. **Sample.** Get a synthetic sample in the new layout (built by a script, like `scripts/translator/make-rs-fixture.ts`, never copied from real data). Put it in `docs/translator/` and, for a button, a byte-identical copy in `public/translator/`. Add its SHA-256 to `import/allowlist.ts` and to the expected list in `import/file-gate.test.ts`, and, if wanted, a sample button in `ui/samples.ts`.
6. **Tests.** A mapping unit test (`import/map-row.test.ts`: a fixture row in `__fixtures__/` and the record it must give), a parse and detect test (`import/parse.test.ts`, with the signature clash test from step 2), and an end-to-end edge case (`edge-cases.test.ts`, from the sample through `loadWorkbook()` and `runPipeline()`).
7. **Docs.** Update [Field mapping](#field-mapping), [Files in this folder](#files-in-this-folder) (with the sample's hash and what it contains) and `docs/CHANGELOG.md`.

**Real Reference Solutions files are out of scope for Phase 1.** The Reference Solutions mapping already reads the real 396-column layout, but the file gate only accepts allowlisted synthetic files. Accepting real exports needs the gate to change (or go) and a privacy decision first: who may upload real contact data, where it may be processed, and what the export may contain. Don't start that without the project lead.

## How Phase 2 AI will plug in

Phase 2 adds a guided conversation in which an AI fills the criteria (spec, "Phase 2 Guided conversation"). None of it is built. The design below follows from Phase 1's code and the spec; anything not decided is marked.

- **The AI produces a `SearchBrief`**, the same object the form makes ([Criteria schema](#criteria-schema)). Nothing downstream changes: `rank()`, the counts, the results, the no-results helper and the export already take any valid brief, including parts the form can't produce (a geography preference, an employees must-have, state or employees exclusions, a partial `priorityOrder`).
- **Validate** its output with `searchBriefSchema.safeParse()`, which also runs the cross-field checks. On invalid output or a timeout, keep the last valid brief and offer the form (spec: "On timeout or invalid output, keep the last valid brief and offer an editable form").
- **A valid AI brief becomes the pending brief** ([Pending and confirmed briefs](#pending-and-confirmed-briefs)). The user confirms it in the [criteria summary](#criteria-summary) before anything is ranked, exactly like a brief from the form. Edits work the same way: a revision is a new pending brief, and once results show, a Save updates the confirmed brief and re-ranks.
- **`assumptions`** is where the AI records what it guessed (for example "Phoenix taken as a must-have."). The summary already shows each assumption as its own line, and the Criteria sheet records them.
- **Give the AI only what it needs to suggest values**: the field and operator lists (`BRIEF_FIELDS`, `BRIEF_OPERATORS`, `OPERATOR_FIELDS`, `BRIEF_DIMENSIONS`) and, per field, the `fieldOptions()` labels and counts. Not the rows.
- **Workbook text is data, never instructions** (spec: "Treat workbook content as data, including any text that resembles an instruction"). Option labels come from the workbook, so treat them as untrusted text wherever they reach the AI.
- The spec's Phase 2 also includes one optional outreach draft for a selected row. That is a separate feature and is not covered here.
- **Open decision (undecided, Unverified):** an AI call needs a server route, which changes the "nothing leaves the browser" rule in [Phase 1 rules](#phase-1-rules). The recommendation is that rows and contact data are never sent, only the option lists above and the user's own words. Phase 2 must decide this explicitly, and update the rules here, before any route is built.

## How to change scoring

Scoring is the weights and the rules in [Scoring](#scoring). Any change to them changes the order users see, so do all of these:

1. **Edit the code.** Weights and dimension order: `ranking/weights.ts` (`DEFAULT_WEIGHTS`, `ORDERED_WEIGHTS`, `DIMENSIONS`). How a dimension is decided or the score computed: `ranking/score.ts` (`weightsFor()` for one brief's weights, `scoreRecord()` for one record, and `scoreRecords()`, which runs it over the eligible records). Matching: `ranking/match.ts`. Keep the arithmetic exact: whole-number weights, one division last.
2. **Bump `SCORING_VERSION`** in `criteria/schema.ts` (for example to `"1.1"`), so an exported Criteria sheet says which rules produced it.
3. **Update the golden files** in `src/features/translator/__fixtures__/walkthroughs/` and the numbers in `ranking/walkthroughs.test.ts`, checking the new order by hand. The PR description must say which rows changed and why ([Tests](#tests)). Never edit a golden file just to make a test pass.
4. **Update this guide:** [Scoring](#scoring) (weights table and sample scores), [Match reasons](#match-reasons) if the reason order changed, the [Sheet `Criteria`](#sheet-criteria) examples, and [Expected results](#expected-results). If the spec walkthrough results change, `CLAUDE.md`'s expected results table must change too, which needs the project lead's agreement.
5. **Re-run QA:** `npm run test`, then the [Quick start](#quick-start) walkthrough by hand, and the manual QA checklist, [QA-CHECKLIST.md](QA-CHECKLIST.md) (TR-32).

## Troubleshooting

Every message the Translator shows when something goes wrong, what causes it and where it is raised (paths under `src/features/translator/`). Messages for problems the user can fix are shown on the page and never logged; unexpected failures also log one code through `logTranslatorError()` ([Session and Start over](#session-and-start-over)). For build, environment and test-runner problems, see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md#local-development).

### Upload step messages

| Message | Cause | Raised in |
|---|---|---|
| Choose one .xlsx file. | No file, or more than one, was chosen or dropped | `WORKBOOK_FILE_MESSAGES.count`, `import/check-file.ts` |
| This file is empty. Choose a .xlsx file that contains your contacts. | 0 bytes | `WORKBOOK_FILE_MESSAGES.empty`, `import/check-file.ts` |
| This file is larger than 2 MB. Please upload a smaller .xlsx file. | Over 2,097,152 bytes | `WORKBOOK_FILE_MESSAGES.tooLarge`, `import/check-file.ts` |
| Only .xlsx files are supported. If your file is .xls or .csv, open it in Excel and save it as .xlsx. | The name doesn't end in `.xlsx` | `WORKBOOK_FILE_MESSAGES.extension`, `import/check-file.ts` |
| This file isn't a valid .xlsx workbook. Open it in Excel and save it as .xlsx again. | Named `.xlsx` but doesn't start with the ZIP signature | `WORKBOOK_FILE_MESSAGES.signature`, `import/check-file.ts` |
| This file couldn't be read. Choose it again, or use the Load sample button. | The browser couldn't read the file (for example it changed on disk after it was chosen). Logs `file-unreadable` | `FILE_GATE_MESSAGES.unreadable`, `import/file-gate.ts`, returned by `loadWorkbook()` |
| Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it. | The file's SHA-256 isn't in `import/allowlist.ts`: any edited, re-saved or real file | `FILE_GATE_MESSAGES.notAllowed`, `import/file-gate.ts` |
| This page needs a secure connection (https) to check the file. Open it from the staging or localhost address. | No `crypto.subtle`: the page was opened over plain http, such as a LAN address | `FILE_GATE_MESSAGES.insecureContext`, `import/file-gate.ts` |
| The Translator couldn't finish loading. Check your connection, reload the page and try again. | The parser's code (ExcelJS) couldn't be downloaded. Logs `parser-unavailable` | `LOAD_MESSAGES.parserUnavailable`, `import/load.ts` |
| This file couldn't be opened as an Excel workbook. It may be damaged. Open it in Excel, save it as .xlsx and try again. | ExcelJS can't open it | `PARSE_MESSAGES.unreadable`, `import/parse.ts` |
| We couldn't recognize this file. It should be a Data Axle Reference Solutions export. | No sheet whose row 1 has at least 2 signature headers of one layout, or a tie | `PARSE_MESSAGES.unrecognized`, `import/parse.ts` |
| Missing required columns: City, State (then: Add these columns to the file and upload again.) | The layout was recognised but required headers are missing | `missingRequiredMessage()` and `HEADER_MESSAGES`, `import/validate-headers.ts` |
| The column City appears more than once. Keep one and upload again. | A required header appears twice | `duplicateRequiredMessage()`, `import/validate-headers.ts` |
| This file has no contact rows below the header row. Choose a workbook that contains contacts. | Known layout, no data rows | `PARSE_MESSAGES.noRows`, `import/parse.ts` |
| This file has more than 1,000 contact rows. Remove rows in Excel (or split the file) so it has 1,000 or fewer, then upload it again. | Over 1,000 non-empty data rows | `PARSE_MESSAGES.tooManyRows`, `import/parse.ts` |
| The sample couldn't be loaded. Refresh the page and try again. | A sample button couldn't fetch its file from `public/translator/`. Logs `sample-load-failed` | `ui/sample-buttons.tsx` |

During Phase 1 the gate runs before the parser, so the parse and header messages can only appear for an allowlisted file.

### Preview step messages

Row issues (invalid employee counts, duplicate Record IDs, generated IDs, possible duplicates) are warnings or left-out rows, listed with their reasons in [Row checks](#row-checks) and [Duplicate grouping](#duplicate-grouping). The one blocking message:

| Message | Cause | Raised in |
|---|---|---|
| No usable rows were found in this file. Choose a different file. | 0 unique records after the row checks and grouping; Continue is disabled | `ui/preview-step.tsx` |

### Criteria step messages

These also show in the criteria summary's editors.

| Message | Cause | Raised in |
|---|---|---|
| Choose what you're trying to do. | No goal | `CRITERIA_FORM_ERRORS`, `criteria/from-form.ts` |
| Pick at least one industry, or choose No preference. (or title) | Prefer chosen with nothing picked | `CRITERIA_FORM_ERRORS`, `criteria/from-form.ts` |
| Enter both From and To, or choose No preference. | Company size Prefer with one or both boxes empty | `CRITERIA_FORM_ERRORS`, `criteria/from-form.ts` |
| Enter whole numbers of 0 or more, for example 10 and 99. | Company size not a whole number of 0 or more | `CRITERIA_FORM_ERRORS`, `criteria/from-form.ts` |
| From can't be more than To. For example, from 10 to 99. | Company size From above To | `CRITERIA_FORM_ERRORS`, `criteria/from-form.ts` |
| Choose a whole number from 1 to 100. | List size blank, 0, 101 or 40.5 | `CRITERIA_FORM_ERRORS`, `criteria/from-form.ts` |
| You can't require and leave out Phoenix. | The same value is a must-have and a Leave out value on one field | `searchBriefSchema`, `criteria/schema.ts` |
| You can't prefer and leave out Retail. | The same value is a preference and a Leave out value on one field | `searchBriefSchema`, `criteria/schema.ts` |

The schema's other messages (unknown keys, wrong operator for a field, bad `priorityOrder`) can't come from the form; they are for briefs from code or, later, the Phase 2 AI ([Criteria schema](#criteria-schema)).

### Results step messages

| Message | Cause | Raised in |
|---|---|---|
| Type a Record ID to pin. | Pin by Record ID with an empty box | `PIN_MESSAGES.blank`, `ranking/overrides.ts` |
| No record with ID NOPE-1 in this file. | No row has that ID | `PIN_MESSAGES.notFound`, `ranking/overrides.ts` |
| X was left out when the file was checked, so it can't be pinned. | Only rows the row checks left out have that ID | `PIN_MESSAGES.leftOut`, `ranking/overrides.ts` |
| SYN-0500 is a duplicate of SYN-0001. Pin SYN-0001 instead. | The ID was grouped into another record | `PIN_MESSAGES.duplicate`, `ranking/overrides.ts` |
| SYN-0016 can't be pinned because it matches your Leave out rule. | The record is excluded | `PIN_MESSAGES.excluded`, `ranking/overrides.ts` |
| SYN-0002 can't be pinned because it doesn't meet your must-haves. | The record fails a must-have | `PIN_MESSAGES.failedMustHave`, `ranking/overrides.ts` |
| SYN-0496 was unpinned because it no longer matches your criteria. (several: ... were unpinned because they no longer match your criteria.) | A brief change made pinned rows ineligible (`droppedPins`) | `ui/results-step.tsx` |
| No matches for these criteria, with hints | The shortlist is empty | `diagnoseEmpty()`, `ranking/diagnose.ts`, shown by `ui/no-results.tsx` ([No-results helper](#no-results-helper)) |

### Export step messages

| Message | Cause | Raised in |
|---|---|---|
| The file couldn't be created. Try again. | `buildWorkbook()` or the download failed, including `assertNoFormulas()` refusing a formula cell. Logs `export-failed` | `ui/export-step.tsx` |

### Errors that mean a bug

These are thrown, not shown as messages: `The counts summary doesn't add up: ...` from `buildCounts()` (`ranking/counts.ts`) when the counts don't reconcile, and `Export blocked: a cell would contain a formula.` from `assertNoFormulas()` (`export/workbook.ts`). If you see one, a recent change broke an invariant; the tests should catch it first.

## Known limitations

The Translator's limitations and accepted risks are owned by [KNOWN-ISSUES.md](../KNOWN-ISSUES.md). The entries are:

- [Correctness risks](../KNOWN-ISSUES.md#correctness-risks): the match key ignores only spacing and case; the employee range formats are guessed (**Unverified**); the first row of a repeated Record ID is kept, not the most complete; duplicate checks only catch near-exact matches; city and state must-haves are independent; the company size preference needs both ends; a Save in the criteria summary replaces unsaved changes on the Criteria step; a size range that only partly fits never matches; all-digit Record IDs sort before every other ID; only the first 5 results can be omitted from the screen; some no-results hints have no Edit button; a real ID that looks generated is reported as blank.
- [Security](../KNOWN-ISSUES.md#security): the file gate is client-side only (item 12).
- [Fix or decide soon](../KNOWN-ISSUES.md#fix-or-decide-soon): few automated tests and no CI.

## Files in this folder

| File | What it is |
|---|---|
| [README.md](README.md) | This developer guide |
| [DEMO-SCRIPT.md](DEMO-SCRIPT.md) | The 25-minute Phase 1 demo for Paul (TR-34): what to click, say and expect, prep steps, known limits and a fallback |
| [PHASE1-REVIEW.md](PHASE1-REVIEW.md) | Decisions for Paul from the Phase 1 walkthrough (TR-34) and the meeting notes. Answers stay empty until the meeting notes fill them |
| [JCA_Data_Axle_Translator_Specification.docx](JCA_Data_Axle_Translator_Specification.docx) | Full spec: workflow, ranking rules, walkthroughs, edge cases, phases |
| [JCA_Synthetic_Contacts.xlsx](JCA_Synthetic_Contacts.xlsx) | 500 fictional records, 9 columns, sheet `Contacts`. Used for the spec walkthroughs. SHA-256: `67a510867ed6c7273cfebabea5c6895e43bd2cae2c98395acd09146ba6ed580b` |
| [JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx](JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx) | Headers only (no records) of a real Reference Solutions export: 396 columns in order, a numbered inventory, and source notes |
| [JCA_Synthetic_RS_Layout.xlsx](JCA_Synthetic_RS_Layout.xlsx) | 100 fictional rows in the real 396-column Reference Solutions layout, sheet `Synthetic Detail Export` (TR-35). See [The Reference Solutions sample](#the-reference-solutions-sample). SHA-256: `ebf0a966b5548fe683f91b94c2a44a6a5f33d4a3274ab3aa217e57e4e4185eeb` |
| [QA-CHECKLIST.md](QA-CHECKLIST.md) | The manual QA checklist (TR-32): what to check on staging in Chrome, Safari and a phone, the expected result of each step, how to report bugs and the results comment for issue #32 |

Both samples are served from `public/translator/` for the Upload step's buttons: `JCA_Synthetic_Contacts.xlsx` for "Load sample (500 fictional records)" (TR-05) and `JCA_Synthetic_RS_Layout.xlsx` for "Load Reference Solutions sample (100 fictional rows)" (TR-35). Each copy must stay byte-identical to the one here, with the same SHA-256 as above, because the [file gate](#file-gate) checks that hash: if one copy changes, replace the other and update the hash here and in `allowlist.ts`. The copies are reachable without a login, which is acceptable only because the records are fictional. Don't link them from any public page or add them to the sitemap.

### The Reference Solutions sample

`JCA_Synthetic_RS_Layout.xlsx` proves the importer handles the real export format without real data (TR-35). It is built by `scripts/translator/make-rs-fixture.ts`; never edit it by hand.

- **Rebuild:** `node scripts/translator/make-rs-fixture.ts` from the repository root. Needs Node 22.18 or newer, which runs TypeScript directly (the app itself still runs on Node 20.9). It writes the file to `docs/translator/` and `public/translator/` and prints the SHA-256. The output is byte-identical on every run and in every time zone (fixed dates in the file and the ZIP), so the hash only changes when the script changes. If it does, update the hash here, in `allowlist.ts` and in `import/file-gate.test.ts`.
- **Headers:** row 1 is copied by the script, exactly and in order, from the "Export Headers" sheet of `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`: 396 columns, the last one without a header. `rs-sample.test.ts` checks it against `__fixtures__/rs-headers.ts`, which was copied from the other sheet ("Header Inventory"), so the two copies agree.
- **Values:** only the mapped columns are filled (IUSA Number, Company Name, Executive First Name, Executive Last Name, Executive Title, Professional Title, Address, City, State, ZIP Code, Phone Number Combined, Website, Primary SIC Description, Primary NAICS Description, Location Employee Size Actual, Location Employee Size Range, and Executive First Name, Last Name and Title 1 to 3). Every other column is empty. Everything is invented: companies `Synthetic Co 001` to `099`, contacts `Demo Person 001`, other executives `Demo Executive 001-1`, phones `(602) 555-0101` style (555-0100 to 555-0199 are reserved for fiction), websites `www.synthetic-co-001.example` (`.example` is reserved), addresses `101 Example Way`, IUSA Numbers `900000001` upward. No email (the layout has no email column). Industry (Primary SIC Description) uses the same five values as the synthetic workbook, so the same searches work; real SIC descriptions are more specific. ZIP codes are the city's main ZIP. **Unverified:** that no real business has one of these IUSA Numbers. They are attached to no real data either way.
- **Layout:** business n is spreadsheet row n + 1 (rows 2 to 100), so a blank IUSA Number gives it `ROW-00nn`. Cities cycle Phoenix, Tempe, Mesa, Glendale; industries change every 4 rows (Fabrication, Logistics, Retail, Technology, Business Services); titles change every 20 rows (Owner, Operations Manager, General Manager, President, then Owner again), so each block of 20 has every city and industry pairing once. State is AZ throughout. Sizes cycle 25, 8, 60, 140, 15, 42, 310, each with its matching range (`20 to 49` for 25). Business n has n % 4 other executives (Vice President, Controller, Sales Manager in slots 1 to 3), so row 2 has 1, row 3 has 2, row 4 has 3 and row 5 has none.

#### Documented rows

Checked by `rs-sample.test.ts`; later tests may rely on them.

| Case | Rows (Record ID) |
|---|---|
| Blank IUSA Number: generated ID and one `generated-id` warning each | 8 (`ROW-0007`), 17 (`ROW-0016`), 26 (`ROW-0025`, Phoenix), 35 (`ROW-0034`), 44 (`ROW-0043`), 53 (`ROW-0052`), 62 (`ROW-0061`, Phoenix, Fabrication), 71 (`ROW-0070`), 80 (`ROW-0079`), 89 (`ROW-0088`) |
| Exact duplicate, grouped | 101 (`900000100`) repeats row 2 (`900000001`, Phoenix, Fabrication, Owner, 25 employees) |
| Executive Title blank, title from Professional Title | 13 (`900000012`, Owner), 46 (`900000045`, Phoenix, General Manager) |
| Title blank (both columns) | 10 (`900000009`, Phoenix), 31 (`900000030`), 52 (`900000051`), 73 (`900000072`) |
| Employee count blank, size from the range | 19 (`900000018`, `10 to 19`), 42 (`900000041`, Phoenix, Fabrication, `20 to 49`), 48 (`900000047`, `1 to 4`), 67 (`900000066`, `1,000 to 4,999`), 82 (`900000081`, Phoenix, Fabrication, `100 to 249`). Against 10 to 99 employees, rows 19 and 42 fit; 48, 67 and 82 don't |
| Both employee columns blank: Missing `Company size` | 59 (`900000058`) |
| Phone blank, website only | 15 (`900000014`), 38 (`900000037`, Phoenix) |
| Website blank, phone only | 23 (`900000022`), 54 (`900000053`, Phoenix) |
| Phone and website blank: Missing `Contact` | 86 (`900000085`, Phoenix) |
| Other executives: 3 | 4 (`900000003`): Demo Executive 003-1 (Vice President), 003-2 (Controller), 003-3 (Sales Manager) |
| Other executives: slot 2 has no title | 3 (`900000002`): Demo Executive 002-1 (Vice President), Demo Executive 002-2 |
| Other executives: slot 1 empty, slots 2 and 3 filled | 12 (`900000011`): Demo Executive 011-2 (Controller), Demo Executive 011-3 (Sales Manager) |

**What it gives:** layout Reference Solutions; every field Found except Email (Not in this layout); 100 rows read, 1 duplicate grouped, 99 unique, 0 left out, 10 rows with warnings (the generated IDs). Pickers: City Glendale 24, Mesa 25, Phoenix 25, Tempe 25; Industry Business Services 19, Fabrication 20, Logistics 20, Retail 20, Technology 20; Title General Manager 19, Operations Manager 19, Owner 38, President 19. The Phoenix fabrication owners brief (`BUSINESS_OWNER_BRIEF`) gives 25 eligible and a 25-row shortlist: `900000001` 100 (with Duplicate IDs `900000100`), `900000081` 86, `900000041` 64, `ROW-0061` 64. The export has Phone and Website and an empty Email column.
