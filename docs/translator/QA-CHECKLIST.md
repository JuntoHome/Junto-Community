# Translator manual QA checklist

The hands-on check of the Data Axle Translator on staging (TR-32, [issue #32](https://github.com/JuntoHome/Junto-Community/issues/32)). A person works through it on desktop Chrome, desktop Safari and a phone, then posts the results on the issue and opens any bugs as new issues.

Use it again before each release of the Translator. The automated tests (`npm run test`) cover the logic; this list covers what only a person can see: the real site, real browsers, the downloaded files and how the screens behave.

**Fictional data only.** Use the two sample buttons or the files named below. Never upload a real Data Axle or Reference Solutions file, even to see it refused.

## Before you start

1. **Access.** You need a Vercel team login (staging is behind Vercel Authentication) and a JCA admin account. The staging address and the login steps are in [DEMO-SCRIPT.md](DEMO-SCRIPT.md#before-the-call).
2. **Which code you are testing.** Note the latest commit on `translator` (`git log -1 origin/translator`, or the commit list on GitHub). Write it in your results.
3. **Files for the edge cases.** On your computer, copy `docs/translator/JCA_Synthetic_Contacts.xlsx` and make:
   - `Sample_resaved.xlsx`: open the copy in Excel, change nothing, save, close.
   - `Sample_edited.xlsx`: open another copy, change one cell (for example a company name), save, close.
   - `Not_a_workbook.txt`: any small text file.
   - `Big.xlsx`: any `.xlsx` larger than 2 MB with fictional or no data (for example the sample with a large picture pasted in).
4. **Devices.** Desktop Chrome, desktop Safari (a Mac) and one phone (Safari on iPhone or Chrome on Android). Write down the browser versions and the phone model.

## How to record results

Work through each section in the browsers its **Where** line names ("All" means Chrome, Safari and the phone). Record the results in the comment template in [Posting the results](#posting-the-results): each section **Pass**, **Fail** or **Skip** per browser, and under Notes the number of any check that failed (for example "3.5") with its bug's issue number. For every Fail, open a bug (see [Reporting bugs](#reporting-bugs)).

## 1. Access and page

Where: Chrome.

| # | Do | Expected |
|---|---|---|
| 1.1 | In a private window, not logged in, open `/admin/translator` on staging (after the Vercel login) | You are sent to the admin login, not shown the Translator |
| 1.2 | Log in as an admin | The admin sidebar has "Data Axle Translator"; clicking it opens the Translator |
| 1.3 | Look at the page | The banner "Synthetic demonstration. All companies and people are fictional." and a 5-step row: Upload, Preview, Criteria, Results, Export |
| 1.4 | Open the public home page and its menu | No link to the Translator |
| 1.5 | Open `/sitemap.xml` | No `/admin/translator` entry |

## 2. Upload and file checks

Where: Chrome. Each refused file stays on the Upload step and shows the message.

| # | Do | Expected |
|---|---|---|
| 2.1 | Choose `Not_a_workbook.txt` | "Only .xlsx files are supported. If your file is .xls or .csv, open it in Excel and save it as .xlsx." |
| 2.2 | Rename `Not_a_workbook.txt` to `Fake.xlsx` and choose it | "This file isn't a valid .xlsx workbook. Open it in Excel and save it as .xlsx again." |
| 2.3 | Choose `Big.xlsx` | "This file is larger than 2 MB. Please upload a smaller .xlsx file." |
| 2.4 | Choose `Sample_edited.xlsx` (altered file) | "Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it." |
| 2.5 | Choose `Sample_resaved.xlsx` (no edits, saved again) | Same message as 2.4: the file gate accepts only the exact approved file |
| 2.6 | Drag `JCA_Synthetic_Contacts.xlsx` (the original) onto the drop zone | Accepted; moves to Preview |

## 3. Business owner walkthrough

Where: All.

| # | Do | Expected |
|---|---|---|
| 3.1 | Upload: click "Load sample (500 fictional records)" | Preview: Layout Synthetic, sheet Contacts. Rows read 500, Duplicates grouped 1, Unique records 499, Rows left out 0, Rows with warnings 0. "SYN-0001 also appears as SYN-0500 (row 501)". Issues: "No problems found." |
| 3.2 | Continue to criteria. Click Continue without choosing a goal | "Choose what you're trying to do." shown inline and in a summary at the top |
| 3.3 | Goal "Find prospective customers or partners"; City Phoenix; State AZ. Preferences: Industry Prefer Fabrication, Title Prefer Owner, Company size Prefer 10 to 99. List size 40. Continue | Results step opens with "Your criteria": Must be in Phoenix, AZ. Prefer Fabrication, Owner, 10 to 99 employees. Show 40. |
| 3.4 | Confirm and rank | Counts: 500 read, 1 duplicate, 499 unique, 399 didn't meet the must-haves, 100 match, 60 not shown, 40 in your shortlist and export |
| 3.5 | Read the table | SYN-0001 first at 100; then SYN-0101, SYN-0201, SYN-0301, SYN-0401 at 86. Row 40 is SYN-0441 at 36. SYN-0500 is not listed |
| 3.6 | Open Details on SYN-0001 | "Row 2 in your file" and "Also in your file as SYN-0500 (row 501)" |
| 3.7 | Read SYN-0001's Why | Its own values, for example "Location: Phoenix, AZ (required)", "Industry: Fabrication (preferred)" |

## 4. Role change

Where: All.

| # | Do | Expected |
|---|---|---|
| 4.1 | In "Your criteria", click "Change title preference", untick Owner, tick Operations Manager, Save | "Updated. Results refreshed." The criteria line reads "Prefer Fabrication, Operations Manager, 10 to 99 employees." |
| 4.2 | Read the table | SYN-0006 first at 100. SYN-0011 is 8th with "Title unknown". Row 40 is SYN-0476 at 50 |
| 4.3 | Click Cancel in an open editor instead of Save | Nothing changes |

## 5. Pin and omit

Where: Chrome and the phone. Start from the business owner results (section 3).

| # | Do | Expected |
|---|---|---|
| 5.1 | Click Omit on SYN-0001 | SYN-0001 leaves the list, SYN-0461 comes in, still 40 rows. "Omitted by you (1)" lists SYN-0001 |
| 5.2 | Click Restore on SYN-0001 | SYN-0001 is back first |
| 5.3 | Pin by Record ID: type `SYN-0496`, click "Pin record" | SYN-0496 is first with "Pinned by user" and score 0; SYN-0441 leaves the list; still 40 rows |
| 5.4 | Pin by Record ID: `SYN-0500` | "SYN-0500 is a duplicate of SYN-0001. Pin SYN-0001 instead." |
| 5.5 | Pin by Record ID: `SYN-9999` | "No record with ID SYN-9999 in this file." |
| 5.6 | Click Unpin on SYN-0496 | Back to the list from 3.5 |

## 6. Business owner export

Where: Chrome and Safari.

| # | Do | Expected |
|---|---|---|
| 6.1 | Run section 3 again (or Restore everything), click "Continue to export" | "40 records will be exported." and the synthetic note next to Download |
| 6.2 | Click "Download Excel" | A file named `JCA_Shortlist_Synthetic_Demo_YYYY-MM-DD.xlsx` (today's date) downloads |
| 6.3 | Open it in Excel | Opens with no repair message. Sheets Shortlist and Criteria. Shortlist row 1: "Synthetic demonstration. All companies and people are fictional."; header on row 3, bold and frozen, with a filter; 40 data rows, SYN-0001 first at 100 |
| 6.4 | Open it in Google Sheets (upload to your Drive; it's fictional data; delete it afterwards) | Same sheets and rows as 6.3 |
| 6.5 | In the Criteria sheet | How the list was made: Created, Source file, the criteria lines (Prefer Fabrication, Owner, 10 to 99 employees.), Scoring version 1.0, the counts, Overrides None, and the brief as JSON |
| 6.6 | Click a Record ID and a phone-like cell | Shown as text, not turned into numbers or dates; no cell holds a formula |

## 7. Job seeker walkthrough and export

Where: All for 7.1 to 7.3; Chrome and Safari for 7.4.

| # | Do | Expected |
|---|---|---|
| 7.1 | Start over (Clear everything), load the sample, Continue to criteria | Upload step shows "Everything was cleared." first; the criteria form is empty |
| 7.2 | Goal "Find potential employers"; City Tempe; State AZ. Prefer Logistics, Operations Manager, 10 to 99. List size 30. Continue, Confirm and rank | 100 match, 30 in your shortlist and export |
| 7.3 | Read the table | SYN-0002 first at 100. Row 30 is SYN-0347 at 50 |
| 7.4 | Export and open the file in Excel and Google Sheets | 30 data rows, SYN-0002 first; Criteria sheet shows Prefer Logistics, Operations Manager, 10 to 99 employees. |

## 8. Unknown city and empty results

Where: Chrome.

| # | Do | Expected |
|---|---|---|
| 8.1 | On Criteria, type `Flagstaff` in the City filter | 'No values match "Flagstaff".' The pickers only offer cities in the file, so an unknown city can't be chosen |
| 8.2 | City Phoenix, and under Leave out tick all five industries. Continue, Confirm and rank | "No matches for these criteria" and "Your Leave out rule for Industry removed 100 records." with an Edit button; no Continue to export |
| 8.3 | Click that Edit button | The Leave out industries editor opens |
| 8.4 | New criteria: City Phoenix; must-haves Industry Fabrication and Title Owner (no preferences). Rank, then Omit every row (5) | "You omitted every match. Restore some below." |
| 8.5 | Set List size to 0 and Continue | "List size: Choose a whole number from 1 to 100." |

## 9. Reference Solutions layout

Where: Chrome.

| # | Do | Expected |
|---|---|---|
| 9.1 | Upload: "Load Reference Solutions sample (100 fictional rows)" | Layout Reference Solutions, sheet "Synthetic Detail Export". Rows read 100, Duplicates grouped 1 (900000100 under 900000001), Unique records 99, Rows with warnings 10 |
| 9.2 | Read the Issues table | 10 lines "IUSA Number is blank, so this row was given the ID ROW-...", rows 8, 17, 26, 35, 44, 53, 62, 71, 80, 89 |
| 9.3 | Run the business owner criteria from 3.3 | 25 match, 25 in the shortlist, 900000001 first at 100. Contact shows phone and website (this layout has no email) |
| 9.4 | Export and open in Excel | Other executives are listed; Email is empty |

## 10. Session, privacy and refresh

Where: Chrome, with developer tools open.

| # | Do | Expected |
|---|---|---|
| 10.1 | Network tab open, load the sample and run section 3 | After the sample file itself, no request sends workbook data (no uploads, no POST with rows) |
| 10.2 | Console tab during sections 2 to 9 | No errors. Any Translator message is only `[translator] <code>`, never a company, name or email |
| 10.3 | Application tab: Local Storage, Session Storage, Cookies | No Translator data (only the admin login cookies) |
| 10.4 | With results on screen, refresh the page | Back to an empty Upload step; nothing is remembered |
| 10.5 | With results on screen, click Start over | It asks first ("This clears your file, criteria and shortlist. ..."); Cancel keeps everything, Clear everything empties it |
| 10.6 | Load the sample, then load the Reference Solutions sample without Start over | The new file starts a fresh session: no pins or omits carry over |

## 11. Phone and accessibility

Where: the phone for 11.1 to 11.3; Chrome for 11.4 and 11.5.

| # | Do | Expected |
|---|---|---|
| 11.1 | Run section 3 on the phone | Results show as cards, not a table; the page doesn't scroll sideways |
| 11.2 | Open Details on a card; Pin and Omit from a card | They work as in sections 3 and 5 |
| 11.3 | Download the export on the phone | The file downloads (opening it is optional) |
| 11.4 | Keyboard only (Tab, Shift+Tab, Space, Enter): load the sample, fill the form, rank, omit a row, export | Everything can be reached and used; the focus outline is visible |
| 11.5 | Zoom the browser to 200% on Results | Text stays readable; the table scrolls inside its own box |

## Reporting bugs

Open one GitHub issue per bug, in milestone "Data Axle Translator Phase 1", with:

- **Title:** what is wrong, in one line.
- **Where:** staging, browser and version, or phone model; the `translator` commit.
- **Steps:** numbered, from the start (for example "Load sample, then ...").
- **Expected** and **Actual:** quote the message exactly.
- **Screenshot:** fictional data only, nothing else on screen.

## Posting the results

Post one comment on [issue #32](https://github.com/JuntoHome/Junto-Community/issues/32):

```
Manual QA on staging, <date>, translator commit <hash>.
Tested by <name> on Chrome <version>, Safari <version>, <phone and browser>.

| Section | Chrome | Safari | Phone | Notes |
|---|---|---|---|---|
| 1 Access and page | | n/a | n/a | |
| 2 Upload and file checks | | n/a | n/a | |
| 3 Business owner | | | | |
| 4 Role change | | | | |
| 5 Pin and omit | | n/a | | |
| 6 Business owner export (Excel, Sheets) | | | n/a | |
| 7 Job seeker and export | | | | |
| 8 Unknown city and empty results | | n/a | n/a | |
| 9 Reference Solutions layout | | n/a | n/a | |
| 10 Session, privacy, refresh | | n/a | n/a | |
| 11 Phone and accessibility | | n/a | | |

Bugs opened: #<n>, #<n> (or "none").
Skipped and why: ...
```
