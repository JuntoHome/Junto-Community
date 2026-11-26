# Known issues and technical debt

A review as of November 2026. Nothing here has been fixed unless it says so. Items marked "by design" are trade-offs the code comments acknowledge. When you fix one, remove it and add a line to [CHANGELOG.md](CHANGELOG.md).

## Fix or decide soon

| Issue | Evidence | Impact |
|---|---|---|
| Dependencies with published advisories | `npm audit` (Nov 2026): `next` 16.3.6 critical; `zod`, `sharp`, `source-map-js` high. `next` is pinned, so the fix (16.4.6) needs a deliberate upgrade. Several Next.js advisories concern self-hosting or `use cache`, which this project doesn't use | Exposure varies by advisory; needs assessing |
| The workshop is over but the site still promotes it | BI101 was Oct 21, 2026. The announcement bar, "Upcoming workshop" labels, Register buttons and Event JSON-LD have no date logic | Visitors are invited to register for a past event |
| One database for everything | No local or staging Supabase project | Local, preview and staging testing changes production data |
| Few automated tests, no CI | Vitest tests cover only the Translator's import and cleaning (TR-29), the three spec ranking walkthroughs (TR-30), the Reference Solutions sample (TR-35) and the spec edge cases (TR-31); no workflow config | The Translator's screens, the export file's layout and styling, the admin area and public pages are verified by hand; nothing runs the tests automatically; `main` deploys directly |

## Incomplete features

- Only profiles are editable in the admin; all other content needs a deploy.
- Four planned admin modules are not started; the Translator is in progress.
- BI101's online platform is still `PENDING`.
- "Who Can Help?" wording is still marked as a draft.
- No admin screens for subscribers, for managing admins, or for restoring deleted profiles; all three are manual SQL.
- No unsubscribe or deletion path for subscribers.
- The admin guide for Paul (CMS-28) is not in the repo.
- No workshop archive or generic `/workshops/[slug]` route.

## Correctness risks

| Risk | Where | Note |
|---|---|---|
| Reordering is not atomic | `repository.ts` `moveInOrder()` | Several updates, no transaction. By design: ties are repaired on the next move. Two admins reordering at once can still interleave |
| Last write wins | `updateProfileFields()` | Two admins editing the same profile overwrite each other silently |
| Changing a published profile's address breaks its old URL | `profile-form.tsx` | The address stops following the name once published, but can still be edited by hand, and no redirect is kept |
| Orphaned logo files | `actions.ts` | A failure between upload and save leaves a file behind. By design |
| `subscribers` migration has no grants | `20260926000000_create_subscribers.sql` | May fail on a fresh Supabase project ([DATABASE.md](DATABASE.md#things-to-be-aware-of)) |
| No error page for the public site | `src/app/(site)/` has no `error.tsx` | A failed profile query on a cache miss shows the framework's default error |
| The Translator's match key ignores only spacing and case | `matchKey()` in `src/features/translator/normalize/match-key.ts` (TR-10) | By design for Phase 1. Punctuation is kept (`St. Louis` doesn't match `St Louis`), state names aren't mapped to codes (`Arizona` doesn't match `AZ`) and there is no stemming (`Fabricator` doesn't match `Fabrication`), so such rows don't match a criterion |
| The Translator's employee range formats are guessed | `normalizeEmployees()` in `src/features/translator/normalize/normalize.ts` (TR-10) | **Unverified.** No real Reference Solutions range values have been seen. If the wording differs from "10 to 19", "10-19" or "10,000+", those counts stay unknown and don't match employee criteria |
| The Translator keeps the first row of a repeated Record ID, not the most complete one | `validateRows()` in `src/features/translator/normalize/validate-rows.ts` (TR-11) | By design for Phase 1. The row with the lowest row number is kept and the later ones are excluded, even when a later row has more filled-in values. The Preview step names both rows so the user can fix the file |
| The Translator's duplicate checks only catch near-exact matches | `groupDuplicates()` in `src/features/translator/normalize/duplicates.ts` (TR-12) | By design for Phase 1. Exact duplicates must match on every field except the Record ID after `matchKey()`, so one extra space is ignored but a different spelling is not. Possible duplicates need the same company, city and state keys, so `Acme Fab` and `Acme Fabrication`, or a row with a blank city, are never flagged. Grouping keeps the earliest row, not the most complete one |
| The Translator's city and state must-haves are independent | `toBrief()` in `src/features/translator/criteria/from-form.ts` (TR-14) | By design for Phase 1. Each picker becomes its own must-have, so "Springfield" with "IL" and "MO" means city in [Springfield] and state in [IL, MO]. A row is kept for any of those city and state pairs, even one the user didn't mean. There is no way to pick a city in one particular state |
| The Translator's company size preference needs both ends | `toBrief()` in `src/features/translator/criteria/from-form.ts` (TR-15) | By design for Phase 1. The schema's range is `{ min, max }`, so the form asks for both From and To. "50 or more" has to be entered as a large To, for example 50 to 100000. There is also no employee or state exclusion in the form |
| A Save in the Translator's criteria summary replaces unsaved changes on the Criteria step | `CriteriaSummary` in `src/features/translator/ui/criteria-summary.tsx` (TR-16) | By design for Phase 1. The summary's editors start from the form that produced the current brief, so a Save changes only its own item. If the user changed the Criteria step without pressing Continue and then saved an item in the summary, those Criteria changes are replaced by the saved form. Pressing Continue first keeps them |
| A Translator employee size range that only partly fits never matches | `matchCriterion()` in `src/features/translator/ranking/match.ts` (TR-17) | By design for Phase 1. A count read from a size range matches an employees criterion only when the whole range fits inside it, so "10 to 249" fails a 10 to 99 must-have even though the business may have 50 people, and an open range such as "10,000+" never matches any range. These rows count as a real mismatch, not as "only because of missing data". The synthetic sample has no size ranges, so this only affects the Reference Solutions layout |
| The Translator sorts all-digit Record IDs before every other ID | `compareRecordIds()` in `src/features/translator/ranking/compare-ids.ts` (TR-19) | By design for Phase 1. Found while building TR-19: comparing digit IDs by length but comparing them with other IDs as text has no consistent order (`9` before `10` by length, `10` before `1A` and `1A` before `9` as text), which would let input order change the list. So digit IDs (IUSA Numbers) go first as a group. This only differs from text order for an ID that mixes digits with other characters and starts with a digit or a symbol, such as `1A` or `#12`. A digit ID with leading zeros sorts by length, so `0012` comes after `12` and after `999` |
| Some Translator no-results hints have no Edit button | `NoResults` in `src/features/translator/ui/no-results.tsx` (TR-24) | By design for Phase 1. A hint about a company size must-have, a state Leave out rule or a company size Leave out rule names the filter but has no Edit button, because the criteria summary has no editor for those items (the form can't produce them; only a Phase 2 brief can). Edit criteria still moves to the summary |
| The Translator's AI can't propose a city or state preference, an employees must-have, or a state or employees exclusion | `buildInterviewInstructions()` in `src/features/translator/ai/instructions.ts` (TR-41) | By design while the criteria form and summary can't edit them: a brief the user couldn't change would be a dead end. The schema and ranking support all of them. If the user asks for one, the AI explains and offers the closest allowed option (for example a city must-have). `parseInterviewReply()` (`ai/validate.ts`, TR-42) enforces the same limits in code. Lift both together if the form gains these controls |
| A dropped AI proposal is thrown away whole | `parseInterviewReply()` in `src/features/translator/ai/validate.ts` (TR-42) | By design. If any part of the AI's proposed brief fails (one value not in the file, a part the form can't edit, or parts that don't fit together), the whole proposal is dropped and the user sees a note, even when only one value was wrong. A partly applied brief would surprise the user more than a note does. The user can ask again or use the form. Only a difference in case and spaces is fixed (`phoenix` to `Phoenix`); anything else is never changed |
| Long Translator chats hit the 30-message limit and must start over | `limitReached()` in `src/features/translator/ai/chat-session.ts` (TR-44) | Until TR-51. Every request carries the whole chat, and the route takes at most 30 messages (`MAX_MESSAGES`). After the greeting and 14 exchanges, the 15th message is the last; then Send is off and the panel says "This chat is getting long. Start over chat to keep going, or use the form." Start over chat clears the conversation and the AI's last brief, so the user has to describe the search again, or use the form |
| The Translator chat needs at least one criterion before ranking; the form doesn't | `hasAnyCriterion()` in `src/features/translator/criteria/chips.ts`, `ProposalCard` (TR-45) | By design. On the AI's proposal card, Confirm and rank is disabled when no must-have or preference is left ("Add at least one must-have or preference, or use the form."), because an empty AI brief is almost always a mistake. The Phase 1 form still ranks a brief with none, as before, and gives every eligible row a score of 0 |
| An AI brief's assumptions stay after the criteria are edited by hand | `CriteriaForm.assumptions` in `src/features/translator/criteria/from-form.ts` (TR-45) | By design for TR-45. Assumptions ride along in the form state so Edit in form and a Save in the criteria summary don't drop them, but nothing rewrites them, so one can go stale ("Phoenix taken as a must-have." after Phoenix is removed in the form). The user can remove an assumption chip on the card; the summary and the export show what is left |
| The AI often makes company size a must-have, and the proposal is dropped | `buildInterviewInstructions()` (TR-41), `parseInterviewReply()` (TR-42) | Found in the TR-45 live check (2026-11-26): for "owners in Phoenix, fabrication, 10 to 99 employees, 40 results", three of four single calls proposed an employees must-have, which the form can't hold, so the check dropped the proposal with the "can't edit" note. The user can answer and get a usable proposal, but the prompt could steer harder. Not changed in TR-45 (prompt changes bump `PROMPT_VERSION`) |
| Leaving the Translator chat clears it | `ChatPanel` and `useChatSession()` in `src/features/translator/ui/chat/` (TR-44) | By design for TR-44. The chat's state lives in the panel, and the request is aborted when the panel unmounts. Switching to the form, or leaving the Criteria step, therefore clears the conversation and the AI's last brief; coming back starts again from the greeting. The Results step's chat for changes (TR-46) is cleared the same way when leaving Results. The form keeps its values as before (TR-43). Keeping the chat across a switch would mean moving its state up to the wizard |

## Security

| # | Concern | Detail |
|---|---|---|
| 1 | Outdated dependencies with advisories | See the first table |
| 2 | Rate limiting is best effort | In-memory per serverless instance; keyed on `x-forwarded-for`. Real brute-force protection depends on Supabase Auth's own limits. The Translator's AI route (`/api/translator/ai`, TR-39) uses the same limiter, 30 requests per 10 minutes per admin user id: also per instance, so an admin whose calls reach several instances can make more. It is a cost guard, not a hard cap |
| 3 | No multi-factor authentication | A single password protects the ability to publish to the public site |
| 4 | No security headers | `next.config.ts` sets no Content-Security-Policy or frame-ancestors rule, so the admin could be framed by another site |
| 5 | Session cookies may be readable by scripts | `server.ts` passes no cookie options, and `@supabase/ssr` does not default to `HttpOnly`. Check in browser dev tools. No script-injection path was found, which limits the risk |
| 6 | Logout is per device | There is no "log out everywhere"; a lost device stays logged in until its session is revoked in Supabase |
| 7 | Silent reset failures | By design, a broken email setup looks like success to the user |
| 8 | `admins.email` is a copy | If an auth email changes, the reset lookup no longer matches |
| 9 | No audit trail | Only the last editor of a profile is recorded; logins and deletions are not logged |
| 10 | Subscriber form has no captcha | Honeypot and the best-effort rate limit only |
| 11 | Security-relevant settings live only in dashboards | Sign-up disabled, password rules, SMTP, Site URL. Even with sign-up enabled, a new account would not be an admin |
| 12 | The Translator's file gate is client-side only | By design for Phase 1 (TR-07). The SHA-256 allowlist check runs in the browser, so someone determined could bypass it (for example by editing the page's code in dev tools). It is a guardrail against using real data by accident, not a security control. The page is also behind the admin login |

## Performance

Nothing is slow at the current scale. Things to watch:

- **Large source images.** `public/images/home/hero.png` is 1.7 MB and each logo PNG is about 1 MB. `next/image` resizes them for visitors, but the logo is also used for the Open Graph image.
- **`getAdmin()` makes two network calls** (Auth, then `admins`) on every admin request.
- **Reordering loads every profile** and writes rows one by one. Fine for tens of profiles.
- **No pagination** on the public overview or the admin list.
- **`unstable_cache`** is not a stable Next.js API and may change on upgrade.

## Duplication and structure

| What | Where |
|---|---|
| Column-to-field mapping, written three times | `repository.ts`, `queries.ts`, `admin-queries.ts` |
| Database column names that no longer match their meaning | `how_they_help`, `who_should_explore`, `history` |
| Limits and publish rules in both TypeScript and SQL | `schema.ts` and the migrations |
| The slug pattern, in four places | `slug.ts`, the profile page, the `proxy.ts` matcher, the migration |
| The link pattern, twice | `links.ts` and `rich-text.tsx` |
| Two near-identical queries | `getProfileForAdmin` and `getProfilePreview` |
| Two similar mobile menus | `layout/mobile-menu.tsx` and `admin/admin-menu.tsx` |
| A 650-line form component | `profile-form.tsx` |
| A content abstraction the CMS bypasses | `lib/content` `ContentSource` has one implementation; profiles don't use it |
| Hand-written row types cast with `as` | No generated Supabase types, so a schema change is not caught by the compiler |

## Configuration and operations

- Migrations and email templates are applied by hand; nothing records what the live project has.
- Important settings exist only in the Supabase and Vercel dashboards.
- No error tracking or uptime monitoring; failures are found by reading logs.
- The site depends on an hourly cron to stop the free Supabase project pausing.
- Backups are whatever the Supabase plan provides; the release ticket that checks them (CMS-30) is unconfirmed.
- The `dev` branch is unused and identical to `main`.
- Soft-deleted profiles and their logos are never purged.
- `npm run build` fails without the two public Supabase variables, because `/admin` is pre-rendered ([TROUBLESHOOTING.md](TROUBLESHOOTING.md#local-development)).

## Documentation

- [BUILD_SPEC.md](BUILD_SPEC.md) predates the admin area and the homepage redesign; kept as a historical record.
- [JCA_CMS_Plan.md](JCA_CMS_Plan.md) lists the original profile fields, not the current ones ([REQUIREMENTS.md](REQUIREMENTS.md#changes-since-the-cms-plan)).
- `site.copyright` is a fixed "© 2026".
- One lint warning: an `<img>` in `src/app/opengraph-image.tsx` (expected there; `next/image` can't be used in image generation).
