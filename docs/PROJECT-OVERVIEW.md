# Project overview

## Purpose

Junto Community Alliance (JCA) helps small-business owners in the Phoenix area find and use community resources, with the public library at the centre. Every program is free. The tagline is "Learn Something. Meet Someone. At the Library."

This repository is JCA's website, [juntocommunity.org](https://www.juntocommunity.org), and the tools the JCA team uses behind it.

## Business objectives

| Objective | Source | Served by |
|---|---|---|
| Give JCA a credible front door online | [BUILD_SPEC.md](BUILD_SPEC.md) | Homepage, About, shared layout |
| A short path from a flyer QR code to Eventbrite registration for the Business Insights 101 workshop (Oct 21, 2026) | [BUILD_SPEC.md](BUILD_SPEC.md) | `/BI101`, Register buttons, announcement bar |
| Grow a mailing list of interested people | [BUILD_SPEC.md](BUILD_SPEC.md) | "Join the Junto" form |
| Let the JCA team publish content without a developer | [JCA_CMS_Plan.md](JCA_CMS_Plan.md) | Admin area, "Who Can Help?" profiles |
| Turn a business contacts spreadsheet into a ranked, explained shortlist | [translator/README.md](translator/README.md) | Data Axle Translator (in progress) |
| Run on free tiers: no new paid services | [JCA_CMS_Plan.md](JCA_CMS_Plan.md) | Supabase free plan, Vercel |

## Problems it solves

- Small-business owners don't know which local organizations can help them. "Who Can Help?" profiles are independently researched pages about organizations such as SCORE Greater Phoenix. They are not sponsored listings.
- Workshop promotion runs on printed flyers. The `/BI101` page gets someone from a QR code to registration in one step.
- Content changes used to need a developer. The admin area lets the team draft, preview, publish, hide, delete and reorder profiles themselves.
- Business contact exports (Data Axle / Reference Solutions) are hard to work with. The Translator ranks them against a plain description of the target and explains each match.

## Target users

| User | What they want |
|---|---|
| Small-business owners and leaders in the Phoenix area | Workshops, local organizations that can help, community |
| Job seekers and business owners using library business data | A shortlist of employers or customers from a contacts export (Translator) |
| The JCA team, led by Paul (client and content author) | To publish and maintain content themselves |

## User roles

There are two roles. There is no public sign-up and there are no customer accounts.

| Role | Who | Can do |
|---|---|---|
| Visitor | Anyone | Read public pages and published profiles, follow the link to Eventbrite, join the mailing list |
| Admin | Paul, Jeel, anyone invited | Log in; create, edit, preview, publish, hide, delete and reorder profiles; upload logos; use the Translator once it is built |

All admins have equal rights. An account in Supabase Auth that is not in the `admins` table has no access. Permissions in detail: [REQUIREMENTS.md](REQUIREMENTS.md#user-roles-and-permissions).

**Unverified:** who the current admins are. That is in the live database, not the repository.

## Main workflows

**Visitor registers for a workshop**

```
Flyer QR code ─▶ /BI101 (any casing redirects here) ─▶ "Register Free" ─▶ Eventbrite
```

Registration, confirmations and reminders happen on Eventbrite. The site holds no attendee data.

**Visitor joins the mailing list**

```
"Join the Junto" form (first name, email, ZIP) ─▶ saved in Supabase ─▶ email to the JCA team
```

**Visitor reads a profile**

```
Menu "Who Can Help?" ─▶ /who-can-help (published profiles in admin order) ─▶ /who-can-help/<slug>
```

**Admin publishes a profile**

```
/admin/login ─▶ Profiles ─▶ New ─▶ Save draft ─▶ Preview ─▶ Publish ─▶ live within a minute
```

**Admin uses the Translator** (Phase 1, being built)

```
/admin/translator ─▶ upload workbook ─▶ preview ─▶ criteria form ─▶ ranked results ─▶ Excel export
```

Everything in the Translator happens in the browser; no rows reach the server.

The detailed version of each workflow is in [FEATURES.md](FEATURES.md).

## How the project got here

| Stage | Dates | Result |
|---|---|---|
| Phase 1 site | From Sept 26, 2026 | Static site, `/BI101`, "Join the Junto" form, keep-alive cron |
| CMS build | Oct 28 to Nov 7, 2026 | Admin area with "Who Can Help?" profiles (tickets CMS-01 to CMS-30) |
| Data Axle Translator Phase 1 | From Nov 10, 2026 | Spec, test data and 35 tickets on the `translator` branch |

The commit-level history is in [CHANGELOG.md](CHANGELOG.md).

## People

| Person | Role in the project |
|---|---|
| Paul | Client, content author, decision maker for wording and scope |
| Jeel Kakadiya | Developer; invites admins; prepared the CMS plan |
| Darryl T. Anderson (Tr33 LLC) | Presenter of the Business Insights 101 workshop |
