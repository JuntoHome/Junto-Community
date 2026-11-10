# Data Axle Translator

A tool in the JCA admin area that turns a business contact spreadsheet into a ranked, explained shortlist in Excel. Users are business owners looking for customers and job seekers looking for employers.

**Phase 1:** upload, preview, criteria form, deterministic ranking, results, Excel export. Synthetic data only, no AI. Page: `/admin/translator`. Work is tracked in GitHub issues TR-01 to TR-35.

## Files in this folder

| File | What it is |
|---|---|
| `JCA_Data_Axle_Translator_Specification.docx` | Full spec: workflow, ranking rules, walkthroughs, edge cases |
| `JCA_Synthetic_Contacts.xlsx` | 500 fictional records, 9 columns, sheet `Contacts`. Used for the spec walkthroughs. SHA-256: `67a510867ed6c7273cfebabea5c6895e43bd2cae2c98395acd09146ba6ed580b` |
| `JCA_Reference_Solutions_Exact_Headers_Jeel.xlsx` | Headers only (no records) of a real Reference Solutions export: 396 columns in order, a numbered inventory, and source notes |
| `JCA_Synthetic_RS_Layout.xlsx` | Added in TR-35: fictional records in the real 396-column layout |

## Two input layouts, one set of fields

| Internal field | Synthetic file | Reference Solutions export |
|---|---|---|
| `recordId` | Record ID | IUSA Number; if blank, generate `ROW-0001` style |
| `company` | Company | Company Name |
| `name` | Name | Executive First Name + Executive Last Name |
| `title` | Title | Executive Title, else Professional Title |
| `city` / `state` | City / State | City / State |
| `industry` | Industry | Primary SIC Description |
| `employees` | Employees | Location Employee Size Actual (Location Employee Size Range as fallback) |
| `email` | Email | none (real exports have no email column) |
| `phone` / `website` | none | Phone Number Combined / Website |
| `otherExecutives` | none | Executive 1 to 50 first, last, title (display only) |
| `naicsDescription` | none | Primary NAICS Description (display only) |

- One shortlist row per business.
- Required to run: company, city, state, industry.
- Ignore unknown columns and blank headers (real exports end with an unnamed column). Header names must match exactly; some contain double spaces.

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

## Rules

- Synthetic data only. Never commit or upload real Data Axle records.
- All processing in the browser. Nothing stored on the server or logged.
- The form fills a `SearchBrief`; the Phase 2 AI will fill the same object.
