# Data Axle Translator

The Data Axle Translator is a tool in the JCA admin area that lets a library patron upload a business contacts spreadsheet, describe a target in plain terms (for example "Phoenix fabrication owners"), and download a ranked, explained shortlist as an Excel file. Typical users are business owners looking for customers and job seekers looking for employers. Phase 1 covers upload, preview, a criteria form, deterministic ranking, results and Excel export, with synthetic data only and no AI. Page: `/admin/translator`. Work is tracked in GitHub issues TR-01 to TR-35 (milestone "Data Axle Translator Phase 1").

Staging: `<URL pending>`

> **Database warning:** staging shares the production Supabase project. Logging in to the admin area, editing profiles or using the subscribe form on staging changes live data (a staging signup creates a real subscriber and emails the team). The Translator itself stores nothing, but the rest of the site on staging is live.

## Files in this folder

| File | What it is |
|---|---|
| [JCA_Data_Axle_Translator_Specification.docx](JCA_Data_Axle_Translator_Specification.docx) | Full spec: workflow, ranking rules, walkthroughs, edge cases |
| [JCA_Synthetic_Contacts.xlsx](JCA_Synthetic_Contacts.xlsx) | 500 fictional records, 9 columns, sheet `Contacts`. Used for the spec walkthroughs. SHA-256: `67a510867ed6c7273cfebabea5c6895e43bd2cae2c98395acd09146ba6ed580b` |
| [JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx](JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx) | Headers only (no records) of a real Reference Solutions export: 396 columns in order, a numbered inventory, and source notes |
| `JCA_Synthetic_RS_Layout.xlsx` | Added in TR-35: fictional records in the real 396-column layout |

A copy of `JCA_Synthetic_Contacts.xlsx` is served from `public/translator/JCA_Synthetic_Contacts.xlsx` for the "Load sample" button (TR-05). It must stay byte-identical, with the same SHA-256 as above, because the [file gate](#file-gate) checks that hash: if one copy changes, replace the other and update the hash here and in `allowlist.ts`. The copy is reachable without a login, which is acceptable only because the records are fictional. Don't link it from any public page or add it to the sitemap.

## Upload limits

- One `.xlsx` file, up to 2 MB (2,097,152 bytes). Larger, empty, `.xls`, `.csv` and other files are refused with a message that says how to fix it.
- The file is recognised by its name ending in `.xlsx` (any case) and by its first 4 bytes, the ZIP signature `50 4B 03 04`. The MIME type the browser reports is ignored.
- These checks don't look inside the workbook: any ZIP named `.xlsx` passes them. The file gate (TR-07) and the parser (TR-08) reject the rest.
- The bundled samples go through the same checks. Code: `checkWorkbookFile()` in `src/features/translator/import/check-file.ts`.

## File gate

During Phase 1 the Translator accepts only the workbooks we issued, so real contact data can't be processed by accident.

- After the upload limits pass, the browser reads the file once and computes its SHA-256 hash (`crypto.subtle.digest`). If the hash isn't in the allowlist, the step stays on Upload and shows: "Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it."
- The allowlist is `src/features/translator/import/allowlist.ts`, the only place hashes live. Today it has one entry, `JCA_Synthetic_Contacts.xlsx`. TR-35 adds the Reference Solutions layout file. The top comment there says how to compute a hash.
- Any change to the file changes its hash and blocks it, even opening it in Excel and saving it with no edits. To approve a changed file, add its new hash to the allowlist.
- `crypto.subtle` works only on https or localhost. On plain http (for example the dev server opened from a LAN address) the gate refuses every file and says the page needs a secure connection. It never skips the check.
- The hash is not logged or sent anywhere, even for refused files. The bytes read for the gate are kept in memory and handed to the parser (TR-08), so the file is read only once.
- Each entry also records a `layout`. It is information only: the parser detects the layout from the headers.
- The gate runs in the browser, so it is a guardrail, not a security control: someone determined could bypass it. That is acceptable for Phase 1 ([KNOWN-ISSUES.md](../KNOWN-ISSUES.md#security)). Code: `checkAllowlist()` in `src/features/translator/import/file-gate.ts`.

## Reading the workbook

After the file gate, the browser parses the same bytes with ExcelJS (TR-08). Code: `parseWorkbook()` in `src/features/translator/import/parse.ts`.

- **Sheet:** the sheet named `Contacts` (ignoring case and outer spaces) if its row 1 is a known layout; otherwise the first sheet, in workbook order, whose row 1 is. Real exports may not have a `Contacts` sheet.
- **Layout:** recognised from the mapping's signature headers (matched like all headers: trimmed, ignoring case). The layout with the most signatures in row 1 wins, if it has at least 2. A tie, or fewer than 2, is "couldn't recognize". Extra, unknown and blank header cells are ignored. The layout comes from the headers, never from the allowlist entry. The Preview step shows the layout, sheet name and row count.
- **Header check:** right after the layout is recognised, and before any data row is read, the required headers are checked (TR-09, below).
- **Rows:** each data row keeps `sourceRow` (its spreadsheet row number; the header is row 1), `sourceValues` (its cells in column order) and `record` (the mapped `TranslatorRecord`). Rows where every cell is blank or only spaces are skipped. A generated ID still follows the spreadsheet row (row 10 is `ROW-0009`), so skipped rows don't shift it.
- **Cell values:** text, numbers and true/false stay as they are; rich text and links become their text, formulas their last calculated result, errors their code (`#N/A`) and dates ISO text (`2026-01-02`).
- **Limit:** at most 1,000 data rows (empty rows don't count).
- **Files from other writers:** some tools (for example the .NET Open XML SDK, which wrote `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`) write namespace-prefixed XML and absolute part paths, which ExcelJS can't open on its own. `makeExcelJsCompatible()` in `import/xlsx-compat.ts` rewrites just those two things in the browser first; files saved by Excel are untouched.

| Problem | Message |
|---|---|
| Not a workbook, or damaged | This file couldn't be opened as an Excel workbook. It may be damaged. Open it in Excel, save it as .xlsx and try again. |
| No sheet in a known layout | We couldn't recognize this file. It should be a Data Axle Reference Solutions export. |
| Required column missing | Missing required columns: City, State (then, on its own line: Add these columns to the file and upload again.) |
| Required column appears twice | The column City appears more than once. Keep one and upload again. |
| Known layout, no data rows | This file has no contact rows below the header row. Choose a workbook that contains contacts. |
| More than 1,000 data rows | This file has more than 1,000 contact rows. Remove rows in Excel (or split the file) so it has 1,000 or fewer, then upload it again. |

During Phase 1 the file gate runs first, so in the app these messages can only appear for an approved file. The parser itself accepts any workbook, ready for when the gate is lifted.

### Signature and required headers

Each mapping in `src/features/translator/import/mappings/` has two header lists (TR-09). Code: `validateHeaders()` in `import/validate-headers.ts`, called by `parseWorkbook()`.

| Layout | Signature headers (recognise the layout) | Required headers (must be present, once) |
|---|---|---|
| Synthetic | Record ID, Company, Name, Title, Industry, Email, Employees | Record ID, Company, City, State, Industry |
| Reference Solutions | Company Name, IUSA Number, Primary SIC Description, Primary NAICS Description, Location Employee Size Actual, Location Employee Size Range, Phone Number Combined, Executive First Name, Executive Last Name, Executive Title | Company Name, City, State, Primary SIC Description |

- **Signatures** only recognise the layout. Each is a header the other layout doesn't have (checked against `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`), so a file missing a required column is still recognised and gets the "Missing required columns" message instead of "couldn't recognize". `City` and `State` are in both layouts, so they are never signatures. `Industry` is both a signature and required for Synthetic: without it the other six still recognise the layout.
- **Required** headers feed company, city, state and industry (and the Synthetic `Record ID`). Missing ones are listed in the order above, by their real column names. A required header that appears twice stops the import.
- **Optional** mapped headers may be missing. Their values are unknown (`null`): a missing half of a joined name gives just the other half, a missing `Executive Title` falls back to `Professional Title`, absent executive slots are skipped, and without `IUSA Number` every row gets a generated `ROW-0001` style ID. Missing optional headers are listed on the Preview step: "Not in this file: Email. These will show as unknown." Numbered executive slot headers are not listed.
- An optional or unmapped header that appears twice is allowed; the first one is used.

## Two input layouts, one set of fields

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

- Fields are grouped as core (`recordId`, `company`, `city`, `state`, `industry`, `employees`, `title`), contact (`name`, `email`, `phone`, `website`, `address`, `zip`) and extra info (`naicsDescription`, `employeeRange`, `otherExecutives`). Code: `src/features/translator/import/` (`fields.ts`, `mappings/`, `map-row.ts`).
- Mapped values are the raw cell text, or `null` when blank. Cleaning and parsing happen afterwards ([Cleaning values](#cleaning-values)).
- One shortlist row per business.
- Required to run: company, city, state, industry. The columns behind them, per layout, are in [Signature and required headers](#signature-and-required-headers).
- Ignore unknown columns and blank headers (real exports end with an unnamed column). Headers are matched after trimming the ends and ignoring case, but inner spacing must match exactly: `Advertising  Expenses` has two spaces.
- Generated IDs use the 1-based data row position: the first row after the header is `ROW-0001` (wider past 9999, e.g. `ROW-12345`). Skipped empty rows still count, so the ID always points at the same spreadsheet row.
- Executive slots are skipped only when first name, last name and title are all blank. The main contact is kept separate from slot 1, even when slot 1 repeats it.

## Cleaning values

Right after a workbook is parsed, every row's record is normalized in the browser (TR-10). Code: `normalizeRecord()` in `src/features/translator/normalize/normalize.ts`, shapes in `normalize/types.ts`. Each row then holds `sourceRow`, `sourceValues` and `record` exactly as parsed, plus `normalized`.

**Three versions of each value:**

| Version | What it is | Used for |
|---|---|---|
| `original` | The mapped value, untouched | Export (TR-25) |
| `value` | Trimmed, inner whitespace (including non-breaking spaces) collapsed to one space | Display |
| `key` | `matchKey(value)`; only city, state, industry and title have one | Matching. Never shown |

`matchKey()` (`normalize/match-key.ts`) applies Unicode NFKC, trims, collapses inner whitespace and lower-cases (not locale-based). So `" phoenix "` and `"Phoenix"` both have the key `phoenix`. SearchBrief values must go through the same function when they are compared (TR-17). The key is deliberately conservative: punctuation is kept (`St. Louis` and `St Louis` differ), abbreviations aren't expanded (`Arizona` is not `AZ`) and words aren't stemmed ([KNOWN-ISSUES.md](../KNOWN-ISSUES.md#correctness-risks)).

**Unknown values.** A value that is `null`, empty or only spaces is unknown: `{ known: false, reason: "blank", original }`, never `null` or `""`. The original (`null`, or the spaces) is kept for export. A blank cell already reaches this step as `null`, because the parser maps blank and space-only cells to `null`. An employee count that can't be read is unknown with reason `invalid`, so TR-11 can flag it without reading the cells again. Ranking treats unknown as described below: a missing value is not a match, fails a must-have and scores 0.

**Other fields.** `recordId` is trimmed and never unknown. Other executives have their name and title trimmed; an executive with neither is dropped.

**Employees:**

1. The `employees` value with commas and spaces removed must be digits only. `"25"`, `"1,200"` and `" 40 "` give 25, 1200 and 40 (`source: "actual"`). `"25.5"`, `"-3"`, `"about 20"` and `"N/A"` are unknown (`invalid`); blank is unknown (`blank`).
2. Only when that is unknown and `employeeRange` has a value, the range is read instead (`source: "range"`, with `min` and `max`). Accepted: `"10 to 19"`, `"10-19"`, `"10 - 19"`, `"1,000 to 4,999"`, and open ranges `"10,000+"` and `"10,000 or more"` (`max` is infinity). Anything else (for example `"Unknown"`, or a min above the max) leaves the count unknown with the reason from step 1. **Unverified:** these formats are a guess. The Reference Solutions headers workbook has no data rows, so the exact range wording in real exports hasn't been seen.
3. A range that is read replaces an `invalid` actual count, and the `invalid` reason is not kept.

`employeeRange` is also kept as its own text field for display.

**Range fit rule** (applied by ranking, TR-17 and TR-18, not by this step): a range-sourced count matches a user range only when the whole range fits inside it (`min >= userMin` and `max <= userMax`). An open range only matches an open user range. So `10 to 19` matches 10 to 99, but `10 to 199` doesn't.

**In the synthetic workbook** all 500 rows have known company, city, state and industry. Title is blank in 125 rows, email in 125 and employees in 124; those values are unknown (`blank`). No row has an invalid employee count, and the file has no range column.

## Row checks

After cleaning, every row is checked for problems (TR-11). Code: `validateRows()` in `src/features/translator/normalize/validate-rows.ts`. It returns `kept` (rows that go forward), `excluded` (rows left out) and `issues`. Every later step (duplicate grouping, ranking, pin and omit, export) uses only `kept`.

Each issue is `{ sourceRow, recordId, code, severity, reason }`. `severity` is `warning` (the row is kept) or `excluded` (the row is left out). Issues are sorted by row number, then code, so the same file always gives the same list. A row can have more than one issue.

| Code | When | Severity | Reason shown |
|---|---|---|---|
| `invalid-employees` | The employees cell has text that isn't a whole number (`25.5`, `-3`, `N/A`). Blank cells are not flagged | `warning` | Employees value "25.5" isn't a whole number, so company size is treated as unknown. When a size range was read instead, it ends: Using the size range 10 to 19 instead. |
| `duplicate-id` | The Record ID was already used on an earlier row. IDs are compared with `matchKey()`, so `SYN-0007` and ` syn-0007 ` are the same | `excluded` | Record ID SYN-0007 is also used on row 5. Row 5 is used and this row is left out. |
| `generated-id` | The ID cell was blank, so the row was given a `ROW-0001` style ID | `warning` | Record ID is blank, so this row was given the ID ROW-0016. (The Reference Solutions layout names its column: IUSA Number is blank, ...) |

Cell values quoted in a reason are trimmed and cut to 40 characters. They are shown on screen but never logged.

**Keep or exclude:**

- **Invalid employee count: kept, with a warning.** Employees is optional. An unknown size already scores 0 on the employees preference and fails an employees must-have ([Ranking](#ranking)), so dropping the whole business over one bad cell would lose more than it protects.
- **Duplicate Record ID: the first row (lowest row number) is kept; every later one is excluded.** Pin, omit, the Record ID tiebreak in sorting and export all identify a row by its Record ID ([Ranking](#ranking) rules 4 and 5), so two rows with one ID would break all four. After this step every Record ID in `kept` is unique, ignoring case and spacing.
- **Generated ID: kept, with a warning.** For the Reference Solutions layout, when no row has an IUSA Number (the column is optional), there is one summary issue for the whole file instead of one per row. It has no row number (`sourceRow` and `recordId` are null) and reads: No row has an IUSA Number, so every row was given an ID from its row number (row 2 is ROW-0001).

**"Invalid rows"** in the counts summary (TR-23) means `excluded.length`. Warnings are shown but don't reduce the count. These excluded rows are not the same as rows removed by an exclusion criterion during ranking.

**Not checked here:** the same business under two different IDs (SYN-0500 repeats SYN-0001). That is [duplicate grouping](#duplicate-grouping) (TR-12).

**Preview** (placeholder until the full Preview step, TR-13): when there are issues it shows "N rows need attention" and lists up to 20 as "Row 17: reason" (a whole-file issue as "All rows: reason"), then "and N more".

**The synthetic sample has 0 issues:** 500 kept, 0 excluded. Its 124 blank employee counts are not flagged, and its Record IDs are all filled and unique.

## Duplicate grouping

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

**Preview** (placeholder until TR-13) shows the counts: "500 rows, 1 duplicate grouped, 499 unique records".

**In the synthetic sample:** SYN-0500 (row 501) is an exact duplicate of SYN-0001 (row 2), so SYN-0001 has `duplicateIds` `["SYN-0500"]` and `duplicateRows` `[501]`. That gives 499 records, `duplicateCount` 1 and 0 possible duplicates.

## Ranking

1. Apply exclusions (a missing value is not a match).
2. Apply must-haves (a missing value fails). Count rows that failed because of missing data.
3. Score 0 to 100 from preferences. Default weights: industry 35, geography 30, title 25, employees 10. Full weight for a match in a dimension, 0 if missing. Only active dimensions count, scaled to 100. No preferences = 0. If the user orders preferences, use weights 4, 3, 2, 1.
4. Sort by unrounded score descending, then Record ID ascending. Default list size 40 (1 to 100).
5. Pinned rows first (labelled, keep their score). Omitted rows removed. Excluded rows cannot be pinned.
6. Every result lists its reasons from its own values.

## Expected results

| Scenario | Expected |
|---|---|
| Phoenix, AZ must-have; prefer Fabrication, Owner, 10 to 99; 40 rows | 500 in, 1 duplicate (SYN-0500 under SYN-0001), 499 unique, 100 eligible, 40 out, SYN-0001 first at 100 |
| Same, title Owner changed to Operations Manager | SYN-0006 first at 100 |
| Tempe, AZ; prefer Logistics, Operations Manager, 10 to 99; 30 rows | 100 eligible, 30 out, SYN-0002 first at 100 |
| City not in the workbook | Empty list with a filter-specific explanation |
| Required title Operations Manager | Rows with unknown title fail that filter |
| Altered copy of the workbook | Rejected by the file gate |

## Phase 1 rules

- **Synthetic data only.** No Data Axle connection. Never upload, copy, paste or commit real Data Axle or Reference Solutions records, not even one row.
- **Browser only.** Parsing, cleaning, ranking and export all run in the browser. Rows are never sent to the server, stored (Supabase, localStorage, cookies) or logged.
- **Independent modules.** Code lives in `src/features/translator/`: `import/`, `normalize/`, `criteria/`, `ranking/`, `export/` (no React) and `ui/`.
- **Two input layouts, one set of fields.** The 9-column synthetic workbook and the 396-column Reference Solutions export are read through mapping configs (see the table above).
- **One row per business.** Record ID is the IUSA Number, or `ROW-0001` style when blank. Industry is the Primary SIC Description. Real exports have no email; phone and website are the contact fallbacks.
- **One criteria object.** The form fills a `SearchBrief`; the Phase 2 AI will fill the same object.
- **Deterministic ranking, no AI.** The same file and the same brief always give the same order and reasons.
