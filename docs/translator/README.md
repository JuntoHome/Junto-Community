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
- **Layout:** row 1 must contain every detection header of a mapping (matched like all headers: trimmed, ignoring case). Synthetic: `Record ID` and `Company`. Reference Solutions: `Company Name`, `City`, `State` and `Primary SIC Description`. Extra, unknown and blank header cells are ignored. The layout comes from the headers, never from the allowlist entry. The Preview step shows the layout, sheet name and row count.
- **Rows:** each data row keeps `sourceRow` (its spreadsheet row number; the header is row 1), `sourceValues` (its cells in column order) and `record` (the mapped `TranslatorRecord`). Rows where every cell is blank or only spaces are skipped. A generated ID still follows the spreadsheet row (row 10 is `ROW-0009`), so skipped rows don't shift it.
- **Cell values:** text, numbers and true/false stay as they are; rich text and links become their text, formulas their last calculated result, errors their code (`#N/A`) and dates ISO text (`2026-01-02`).
- **Limit:** at most 1,000 data rows (empty rows don't count).
- **Files from other writers:** some tools (for example the .NET Open XML SDK, which wrote `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx`) write namespace-prefixed XML and absolute part paths, which ExcelJS can't open on its own. `makeExcelJsCompatible()` in `import/xlsx-compat.ts` rewrites just those two things in the browser first; files saved by Excel are untouched.

| Problem | Message |
|---|---|
| Not a workbook, or damaged | This file couldn't be opened as an Excel workbook. It may be damaged. Open it in Excel, save it as .xlsx and try again. |
| No sheet in a known layout | We couldn't recognize this file. It should be a Data Axle Reference Solutions export. |
| Known layout, no data rows | This file has no contact rows below the header row. Choose a workbook that contains contacts. |
| More than 1,000 data rows | This file has more than 1,000 contact rows. Remove rows in Excel (or split the file) so it has 1,000 or fewer, then upload it again. |

During Phase 1 the file gate runs first, so in the app these messages can only appear for an approved file. The parser itself accepts any workbook, ready for when the gate is lifted.

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
| `employeeRange` | none | Location Employee Size Range (display only; the normalize step uses it when `employees` is blank) |

- Fields are grouped as core (`recordId`, `company`, `city`, `state`, `industry`, `employees`, `title`), contact (`name`, `email`, `phone`, `website`, `address`, `zip`) and extra info (`naicsDescription`, `employeeRange`, `otherExecutives`). Code: `src/features/translator/import/` (`fields.ts`, `mappings/`, `map-row.ts`).
- Mapped values are the raw cell text, or `null` when blank. Cleaning and parsing happen in the normalize step.
- One shortlist row per business.
- Required to run: company, city, state, industry.
- Ignore unknown columns and blank headers (real exports end with an unnamed column). Headers are matched after trimming the ends and ignoring case, but inner spacing must match exactly: `Advertising  Expenses` has two spaces.
- Generated IDs use the 1-based data row position: the first row after the header is `ROW-0001` (wider past 9999, e.g. `ROW-12345`). Skipped empty rows still count, so the ID always points at the same spreadsheet row.
- Executive slots are skipped only when first name, last name and title are all blank. The main contact is kept separate from slot 1, even when slot 1 repeats it.

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
