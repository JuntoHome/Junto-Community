# Phase 1 review with Paul

The decisions and notes from the Phase 1 walkthrough with Paul (TR-34, [issue #34](https://github.com/JuntoHome/Junto-Community/issues/34)). The demo itself is in [DEMO-SCRIPT.md](DEMO-SCRIPT.md).

**Status: Not yet confirmed.** The walkthrough hasn't happened. Paul's answers, verdict and feedback are filled in only from the meeting notes; anything the notes don't cover stays empty or "Not yet confirmed".

## Decisions for Paul

Each question describes what the tool does today and the realistic options. The ticket in brackets is where the current behaviour was built. Each agreed change becomes its own follow-up issue, linked in the last column.

| # | Question (plain language) | Current behaviour | Options | Paul's answer | Follow-up issue |
|---|---|---|---|---|---|
| 1 | Do the walkthrough results match what JCA intended? | As shown: business owner, SYN-0001 first at 100 of 100 matches, 40 listed; with operations manager preferred, SYN-0006 first; job seeker in Tempe, SYN-0002 first, 30 listed (TR-30) | Yes / Yes, with changes (which) / No (what's wrong) | | |
| 2 | Should users be able to *prefer* a city, not just require one? | Not in the form: city and state can only be required. The ranking already supports a city preference, ready for Phase 2 (TR-15) | Keep for Phase 1 / Add "prefer a city" to the form now / Leave it to the Phase 2 conversation | | |
| 3 | Should a pinned row take one of the list's places, or be added on top of the list? | Within: a list of 40 with 2 pins shows the 2 pins and the best 38 others (TR-21) | Within (keep) / On top (40 plus the pins) | | |
| 4 | Should rows the user omitted be listed only on the Criteria sheet of the download? | Yes: they aren't on the Shortlist sheet, and the Criteria sheet lists each with its score (TR-25, TR-26) | Keep / Also show them on the Shortlist sheet, marked omitted / Leave them out of the file entirely | | |
| 5 | The reasons also list what didn't match, such as "Title: General Manager (not preferred)": helpful or noisy? | Shown for every preference, matched or not (TR-20) | Keep all lines / Show only the matches / Show matches and unknowns only | | |
| 6 | Should a row whose employee count can't be read stay in the list, with a warning? | Kept with a warning, and its company size counts as unknown (TR-11) | Keep with a warning / Leave the row out | | |
| 7 | When two rows share the same record ID, should we keep the first one? | The first row is kept and the later one left out; the Preview step names both (TR-11) | Keep the first / Keep the most complete one / Refuse the file | | |
| 8 | Should a company's size range have to fit completely inside the user's range to count? | Strict: "10 to 249" doesn't count for 10 to 99, even though the company might have 50 people. Only affects real exports, which give ranges (TR-17) | Strict (keep) / Count any overlap / Count an overlap for fewer points | | |
| 9 | Is it OK that city and state are separate filters, so "Springfield" with "IL" and "MO" keeps every Springfield in either state? | Yes, they are independent (TR-14) | Keep / Let users pick a city and state as a pair | | |
| 10 | Is it right that a re-saved copy of our own sample file is refused? | Yes: only the two fictional files we issued are accepted, exactly as issued (TR-07) | Keep for Phase 1 / Relax it | | |
| 11 | Should every download carry the "synthetic demonstration" note and the "Synthetic_Demo" file name? | Yes, on both sheets, in the file name and in the file's properties (TR-28) | Keep / Change the wording | | |
| 12 | Who should use the tool: JCA admins only for now, and patrons later? | Admins only, behind the admin login (TR-02) | Admins only / Add other JCA staff / Plan for patrons (needs a public page and the Phase 3 review) | | |
| 13 | Can we get the exact wording real Reference Solutions exports use for employee ranges (just the wording, no records)? | Guessed ("10 to 19", "10-19", "10,000+"), **Unverified** (TR-10) | Paul or Jeel sends the list of range values as they appear / Leave as guessed for now | | |
| 14 | Phase 2: may the AI step go through our server, as long as no rows or contact details are ever sent, only the list of choices and the user's own words? | Open. In Phase 1 nothing is sent to the server (TR-33 guide) | Yes, on those terms / No, keep everything in the browser / Decide after the counsel review | | |
| 15 | Phase 2 and later: when and how could real exports be allowed, given privacy and the licence? | Not allowed (Phase 1 rule). The spec puts a counsel review (Phase 3) before any use of real records | Wait for the counsel review / Name who decides and when / Other | | |
| 16 | Is it OK that values must be spelled as in the file, ignoring only capitals and spaces, so "Arizona" doesn't match "AZ"? | By design; users pick values from lists taken from the file (TR-10) | Keep / Treat common variants as the same | | |
| 17 | Is it OK that "50 or more employees" has to be entered as 50 to a large number? | Both From and To are required (TR-15) | Keep / Allow "or more" | | |
| 18 | Should users be able to leave out a state or a company size, not only an industry, title or city? | Not in the form (TR-15) | Keep / Add | | |
| 19 | The spec's optional short introduction draft (for example, a request for an informational conversation): does it belong in Phase 2? | Not built; the spec lists it under Phase 2 | Phase 2 / Later / Drop it | | |
| 20 | Are a 2 MB and 1,000-row limit enough for the files patrons will bring? | 2 MB and 1,000 rows; the spec called both "proposed". We haven't seen a real file's size, so it's **Unverified** whether 1,000 rows of the real layout fit in 2 MB (TR-06, TR-08) | Keep / Raise one or both / Decide once we've seen a real file's size | | |
| 21 | Would Paul like his own access to try the tool on staging after this call? | He can't yet: his admin account is unconfirmed (CMS-08) and staging is behind a Vercel login | Yes (arrange both) / No, demos are enough for now | | |
| 22 | Is the results screen readable enough on a laptop, given that the Why, Missing and Actions columns need scrolling sideways? | 10 columns, wider than the admin page; the table scrolls inside its own box (TR-22) | Fine as is / Show fewer columns and move the rest into Details | | |

## Meeting notes

Filled in from the meeting notes after the call. Leave a field empty rather than guessing.

| Item | Notes |
|---|---|
| Date | |
| Attendees | |
| Where it was shown | (staging, localhost or screenshots) |
| Staging commit | (the `translator` commit staging was running) |
| What was shown | (the parts of [DEMO-SCRIPT.md](DEMO-SCRIPT.md) that were shown, and anything skipped) |
| Paul's overall verdict | |

### Feedback

| # | What Paul said | Related question | Follow-up |
|---|---|---|---|
| | | | |

### Agreed changes

| # | Change | Phase 1 or Phase 2 | Follow-up issue |
|---|---|---|---|
| | | | |

### Issue #34 acceptance criteria

| Criterion | Status |
|---|---|
| Paul confirms Phase 1 produces the intended results | Not yet confirmed |
| Follow-up items are captured as issues | Not yet |
