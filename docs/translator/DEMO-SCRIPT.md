# Phase 1 demo script

A 25-minute walkthrough of the Data Axle Translator for Paul (TR-34, [issue #34](https://github.com/JuntoHome/Junto-Community/issues/34)). One person drives and shares their screen; Paul watches and answers the questions in [PHASE1-REVIEW.md](PHASE1-REVIEW.md). Everything shown uses the fictional sample files. The numbers below are the ones the automated tests lock in ([README.md, Expected results](README.md#expected-results)), so if the screen shows something else, note it as a bug instead of explaining it away.

Each part lists what to **click**, what to **say** (plain language, adapt freely) and what **Paul should see**.

## Running order

| # | Part | Time | Why it's in this order |
|---|---|---|---|
| 1 | [Intro](#1-intro-2-min) | 2 min | |
| 2 | [Business owner walkthrough](#2-business-owner-walkthrough-7-min) | 7 min | |
| 3 | [Controls: pin and omit](#3-controls-pin-and-omit-3-min) | 3 min | Pin SYN-0496 and omit SYN-0001 only work with the Phoenix criteria, so they come before the criteria change |
| 4 | [Role change](#4-role-change-3-min) | 3 min | |
| 5 | [Export](#5-export-3-min) | 3 min | Exports the role-change list, which is the export the spec asks to check (revised role, SYN-0011's blanks) |
| 6 | [Job seeker walkthrough](#6-job-seeker-walkthrough-4-min) | 4 min | Starts with Start over, the last of the controls |
| 7 | [Real export layout](#7-real-export-layout-optional-2-min) (optional) | 2 min | Skip if short on time or if the button wasn't checked on staging |
| 8 | [Safety](#8-safety-1-min) | 1 min | Last, because loading another file clears the session |
| 9 | [Decisions and next steps](#9-decisions-and-next-steps) | the rest | |

The demo parts take 23 minutes (25 with part 7). The decision list is long: ask the starred questions in part 9 on the call and send the rest in writing afterwards.

## Before the call

Do this the day before, and again 15 minutes before the call.

1. **Open staging** in the browser you will share: `https://junto-community-git-translator-junto-community-alliance.vercel.app/admin/translator`. It is behind a Vercel login (only Vercel team members can open it) and then the JCA admin login. If you can't get past either, use the [fallback](#fallback-if-staging-is-down).
2. **Run parts 2 to 6 once**, start to finish, and check the numbers match this script.
3. **Click both sample buttons** on the Upload step: "Load sample (500 fictional records)" and "Load Reference Solutions sample (100 fictional rows)". If the second one fails, drop part 7.
4. **Make the refused file for part 8:** copy `JCA_Synthetic_Contacts.xlsx` (from `docs/translator/`) to your desktop as `Sample_resaved.xlsx`, open the copy in Excel, change nothing, save and close. Keep it on the desktop. It is still fictional data, just a different file now.
5. **Prepare the fallback material:** download the business owner and role change exports, and take screenshots of the Preview step, the top of the Results step, SYN-0001's Details row, the Export step and both sheets of the download. Fictional data only: make sure nothing else is visible in the screenshots.
6. **Tidy the screen you will share:** close email, chat and other tabs, and turn off notifications. Staging is logged in to the live admin area.
7. **Width:** the results table has 10 columns and is wider than the admin page, so the Why, Missing and Actions columns are reached by scrolling inside the table. A wide window, or browser zoom at 80 to 90%, keeps the Why column in view.

> **Staging uses the live database.** The Translator itself saves nothing, but the rest of the admin area on staging is live. Don't open profile editing, and don't use the subscribe form, during the demo.

## Known before the demo

Mention these if they come up; none of them is a surprise.

**Open bugs from QA (TR-32):** none recorded. TR-32 (manual QA on staging) hasn't been done yet: no checklist or results are posted on [issue #32](https://github.com/JuntoHome/Junto-Community/issues/32), so staging hasn't been checked on Safari or a phone. The automated tests pass, and the walkthrough numbers in this script are locked in by them.

**Not yet checked on staging:**

- Paul's own login. His admin account (CMS-08) is unconfirmed, and staging also needs a Vercel login he doesn't have. This demo assumes you drive; Paul trying it himself is a follow-up (question 21).
- The "Load Reference Solutions sample" button (TR-35 was checked locally only).

**By design, worth saying out loud:**

- Everything is fictional, and the tool refuses any other file, including a re-saved copy of the sample (part 8).
- Nothing leaves the browser: no upload, nothing saved. Start over, a refresh or closing the tab clears it.
- Location is a must-have only. The form can't *prefer* a city (question 2).
- Values must match the file's spelling, ignoring only capitals and spaces: "Arizona" isn't "AZ". The pickers only offer values found in the file, so this rarely shows (question 16).
- "50 or more employees" has to be typed as 50 to a large number (question 17).
- Pinned rows take places within the list size (question 3).
- No AI and no drafted introduction in Phase 1. Both are Phase 2 (questions 14 and 19).
- Files are limited to 2 MB and 1,000 rows (question 20).

## 1. Intro (2 min)

**Click:** nothing yet. Have the admin home page open.

**Say:**

- "This is the Data Axle Translator. A library patron brings a spreadsheet of business contacts, tells us what they're looking for, and gets back a ranked shortlist in Excel, with the reasons for every row."
- "Two typical users: a business owner looking for customers or partners, and a job seeker looking for employers."
- "Everything today is fictional. The companies and people in this file are invented, because we don't have permission to use real Data Axle records yet. The tool only accepts the fictional files we made."
- "Nothing leaves this browser. The file is read, ranked and turned into Excel right here on my computer. It isn't uploaded to our website or saved anywhere, and when I close the tab, it's gone."
- "In Phase 1 the JCA team runs it from the admin area, with a simple form. Phase 2 would add a conversation, with AI filling in that same form. Today I'll show Phase 1 and then ask you some decisions."

## 2. Business owner walkthrough (7 min)

The scenario: a business owner in Phoenix wants fabrication companies, ideally reaching the owner, ideally 10 to 99 employees, 40 names.

1. **Click** "Data Axle Translator" in the admin sidebar.
   **Paul should see:** the banner "Synthetic demonstration. All companies and people are fictional." and five steps: Upload, Preview, Criteria, Results, Export.
   **Say:** "That banner stays on every step, and every download carries the same note."
2. **Click** "Load sample (500 fictional records)".
   **Paul should see** on the Preview step: File name `JCA_Synthetic_Contacts.xlsx`, Layout Synthetic, Sheet Contacts. Rows read **500**, Duplicates grouped **1**, Unique records **499**, Rows left out 0, Rows with warnings 0. Under Duplicate groups: "SYN-0001 also appears as SYN-0500 (row 501)". Under Issues: "No problems found."
   **Say:** "Before anything else it checks the file. 500 rows, and one business is listed twice, so it folds the two together: 499 unique businesses. It tells us which row was the copy, so nothing disappears silently."
3. **Click** "Continue to criteria". Choose the goal "Find prospective customers or partners". Under City tick **Phoenix (100)**; under State tick **AZ (499)**.
   **Say:** "These are must-haves: anyone outside Phoenix, Arizona is removed. The choices and counts come from the file itself, so you can't pick a city that isn't there."
4. Under Preferences: Industry, **Prefer**, tick **Fabrication**. Title, **Prefer**, tick **Owner**. Company size, **Prefer**, From **10** To **99**. Leave "Rank my preferences by importance" unticked. List size: **40**.
   **Say:** "Preferences don't remove anyone. They only change the order: the more preferences a business matches, the higher it goes."
5. **Click** "Continue".
   **Paul should see** "Your criteria": "Goal: find prospective customers or partners.", "Must be in Phoenix, AZ.", "Prefer Fabrication, Owner, 10 to 99 employees.", "Show 40.", "No assumptions."
   **Say:** "Before anything is ranked, it reads back what I asked for, in plain English. I can change any single line here. Nothing is ranked until I confirm."
6. **Click** "Confirm and rank".
   **Paul should see** "From your file to your shortlist": 500 rows read from your file, 0 rows left out because of problems in the file, 1 duplicate grouped, 499 unique records, 0 removed by your Leave out rules, 399 didn't meet your must-haves (0 only because a value was blank), **100 match your criteria**, 60 more matches not shown (list size 40), **40 in your shortlist and export**.
   **Say:** "Every row is accounted for, from the 500 in the file to the 40 on the list. 100 businesses are in Phoenix; we show the best 40."
7. **Point at row 1** of the table (scroll the table sideways for the Why column).
   **Paul should see:** rank 1, **SYN-0001**, Synthetic Company 0001, Phoenix, AZ, score **100**, Missing "None", and four reasons: "Location: Phoenix, AZ (required)", "Industry: Fabrication (preferred)", "Title: Owner (preferred)", "Company size: 25 employees (preferred)".
   **Say:** "It's first because it matches everything we asked for, and it says so in its own words. Rows 2 to 5 score 86: they match fabrication and owner but not the company size, and their reasons show that. The score is plain arithmetic, not AI: the same file and the same choices always give the same list."
8. **Click** "Details" on SYN-0001.
   **Paul should see:** "Row 2 in your file" and "Also in your file as SYN-0500 (row 501)".
   **Say:** "That's the duplicate from the Preview step. We keep one row and show where the other copy was."

## 3. Controls: pin and omit (3 min)

Still on the business owner list.

1. In "Pin by Record ID" above the table, **type** `SYN-0496` and **click** "Pin record".
   **Paul should see:** SYN-0496 at rank 1 with a "Pinned by user" badge, score **0**, "Pinned by user" as its first reason and Missing "Company size". SYN-0001 is now rank 2. The list is still 40 rows (the old 40th row, SYN-0441, has dropped off).
   **Say:** "Sometimes the patron knows a business they want on the list anyway. Pinning puts it at the top, clearly labelled, and it keeps its real score, so nobody is misled. It takes one of the 40 places." (Question 3.)
2. **Click** "Unpin" on SYN-0496. SYN-0001 is back at rank 1.
3. **Click** "Omit" on SYN-0001.
   **Paul should see:** SYN-0101 (score 86) is now first. Under the table, "Omitted by you (1)" with a Restore button. The counts now include "1 omitted by you" and "59 more matches not shown (list size 40)", and still "40 in your shortlist and export". SYN-0461 has come in at rank 40.
   **Say:** "Omit takes a row out, and the next best one moves up, so the list stays at 40. The download records what was omitted, on its second sheet." (Question 4.)
4. **Click** "Restore". SYN-0001 is back at rank 1.

## 4. Role change (3 min)

1. **Click** "Edit criteria" above the table, then on the Preferences line **click** "Change title". Untick **Owner**, tick **Operations Manager**, and **click** "Save".
   **Say:** "The patron changes their mind: they'd rather reach operations managers than owners. I change just that one thing."
2. **Paul should see:** "Updated. Results refreshed." The Preferences line now reads "Prefer Fabrication, Operations Manager, 10 to 99 employees." **SYN-0006** is first at **100**, with "Title: Operations Manager (preferred)" in its reasons. Ranks 1 to 6 are all 100 (SYN-0006, 0026, 0126, 0226, 0326, 0426). SYN-0001 is rank 7 at 64, now with "Title: Owner (not preferred)". SYN-0011 is rank 8 at 64, with Title "Unknown", Contact "Unknown", Missing "Title, Contact" and the reason "Title unknown".
   **Say:**
   - "One change and the list reorders, and the reasons change with it. SYN-0006 now says operations manager is preferred. SYN-0001 says owner is *not* preferred, which is why it moved down." (Question 5 is about those "not preferred" lines.)
   - "Six businesses tie at 100. When scores tie, they're ordered by their ID, so the order is always the same."
   - "SYN-0011 has no title or email in the file. It still qualifies, and the list says exactly what's missing rather than guessing."

## 5. Export (3 min)

1. **Click** "Continue to export".
   **Paul should see:** "40 records will be exported.", the "Download Excel" button and "This file is a synthetic demonstration. All companies and people are fictional."
2. **Click** "Download Excel" and open the file in Excel. It is named `JCA_Shortlist_Synthetic_Demo_` plus today's date. (If Excel opens it in Protected View, that's normal for downloads; reading it doesn't need editing turned on.)
3. **Sheet Shortlist. Paul should see:**
   - Row 1: "Synthetic demonstration. All companies and people are fictional." The headings are on row 3 and the list starts on row 4.
   - SYN-0006 first, score 100, and a Reasons column with exactly the reasons from the screen.
   - SYN-0001 (rank 7) with "SYN-0500" under Duplicate IDs.
   - SYN-0011 (rank 8): the Title and Email cells are empty, and Missing says "Title, Contact".
   **Say:** "The same list, the same order and the same reasons as the screen. Blanks stay blank: nothing is filled in or guessed."
4. **Sheet Criteria. Paul should see:** "JCA Data Axle Translator: how this list was made", the synthetic note, the date and time, the source file's name and layout, the criteria lines including "Prefer Fabrication, Operations Manager, 10 to 99 employees.", scoring version 1.0 with the weights (Industry 35 (50%), Title 25 (35.7%), Company size 10 (14.3%)), the same counts as the screen, and Pinned "None", Omitted "None".
   **Say:** "This sheet is the record of how the list was made: which file, which choices, which rules. The file is identified by a fingerprint, and the last row is a technical copy of the choices, so we could repeat this exact run later and get the same list. If someone asks in six months why this list looks the way it does, this sheet answers it."

## 6. Job seeker walkthrough (4 min)

The scenario: a job seeker in Tempe looking for logistics employers, ideally reaching operations managers, 30 names.

1. Back in the browser, **click** "Start over".
   **Paul should see:** "Start over?" and "This clears your file, criteria and shortlist. Download your file first if you need it." **Click** "Clear everything". The Upload step is back, with nothing loaded.
   **Say:** "Start over throws everything away. Nothing was saved, so there's nothing left behind to clean up."
2. **Click** "Load sample (500 fictional records)", then "Continue to criteria".
3. Goal: **"Find potential employers"**. City **Tempe**, State **AZ**. Industry, Prefer, **Logistics**. Title, Prefer, **Operations Manager**. Company size, Prefer, **10** to **99**. List size **30**. **Click** "Continue", then "Confirm and rank".
4. **Paul should see:** "Goal: find potential employers.", "Must be in Tempe, AZ.", "Prefer Logistics, Operations Manager, 10 to 99 employees.", "Show 30." Counts: **100 match your criteria**, 70 more matches not shown (list size 30), **30 in your shortlist and export**. **SYN-0002** first at **100**, tied with six others (SYN-0007, 0027, 0127, 0227, 0327, 0427), then SYN-0012 at 64.
   **Say:** "Same tool, same rules, different person." Then: "In the spec, this is where the tool would also draft a short note asking for an informational conversation. That is planned for Phase 2, not built yet." (Question 19.)

## 7. Real export layout (optional, 2 min)

Only if "Load Reference Solutions sample" worked when you checked it before the call.

1. **Click** "Upload" in the step row, then "Load Reference Solutions sample (100 fictional rows)". (This starts a fresh session, like Start over.)
   **Paul should see:** Layout Reference Solutions, sheet "Synthetic Detail Export", Rows read 100, Duplicates grouped 1, Unique records 99, Rows with warnings 10.
   **Say:** "Real Data Axle exports from Reference Solutions have 396 columns. This is a fictional file built in exactly that shape, to prove the tool reads it. The 10 warnings are rows with no ID number, so the tool gave them a stand-in ID such as ROW-0007 and says so."
2. Run the business owner criteria from part 2 (Phoenix, AZ; Fabrication, Owner, 10 to 99; 40).
   **Paul should see:** 25 match, 25 in the shortlist, ID 900000001 first at 100. The Contact column shows a phone number and a website.
   **Say:** "Real exports have no email column, so the list shows phone and website instead. One thing we couldn't check without real data is how real exports word employee ranges." (Question 13.)

## 8. Safety (1 min)

1. **Click** "Upload" in the step row, then "Choose a workbook", and pick `Sample_resaved.xlsx` from the desktop.
   **Paul should see:** "Only the JCA synthetic demo workbook can be used in this prototype. Use the Load sample button to try it."
   **Say:** "During Phase 1 it only accepts the two fictional files we made, exactly as we made them. Opening our own sample in Excel and saving it, with no changes, makes it a different file, so it's refused. It's a guard against anyone loading real contact data by accident." (Question 10.)

## 9. Decisions and next steps

Open [PHASE1-REVIEW.md](PHASE1-REVIEW.md) (or a copy of its table) and go through the questions. Suggested for the call, in this order (starred):

- ★ 1: do the results match what JCA intended?
- ★ 12: who should use it, now and later?
- ★ 14 and ★ 15: the Phase 2 AI route, and when real exports could be allowed.
- ★ 3, ★ 5 and ★ 2: pins, the "not preferred" lines, and preferring a city.
- ★ 21: does Paul want his own access to try it?

Send the rest in writing after the call. Close with next steps: you'll record his answers, open one issue per agreed change, and post a summary on issue #34.

**Likely questions from Paul, with short answers:**

| Question | Answer |
|---|---|
| Is the score AI? | No. It's fixed arithmetic: points for each preference matched, out of 100. The same file and choices always give the same list. |
| Where does the data go? | Nowhere. It stays in this browser tab and is gone when the tab closes or you press Start over. |
| Can patrons use it today? | No. Only JCA admins, behind the admin login, and only with the fictional files. |
| Could we load a real export? | Not in Phase 1. The tool reads the real layout, but refuses any file we didn't issue. Allowing real data needs a privacy and licence decision first (question 15). |
| What happens to businesses with missing details? | They stay in, the list says what's missing, and a missing value never counts as a match. |

## Fallback if staging is down

If staging won't load, or you can't get past the Vercel or admin login:

1. **Run it locally** from the same `translator` commit: `npm run dev`, then open `http://localhost:3000/admin/translator` and log in. Use `localhost`, not a network address, or the file check refuses every file. The steps and numbers are identical. The local site uses the same live database, so the same rule applies: no profile editing, no subscribe form.
2. **If that fails too,** walk through the screenshots and the downloaded exports you prepared in [Before the call](#before-the-call), in the same order. TR-32's screenshots and sample export don't exist yet (QA hasn't run), so your own are the only fallback material.
3. Say plainly that staging is down, and offer Paul a second, short live run once it's back.
