# JCA CMS: Requirements, Workflows and Tickets

**Project:** Junto Community Alliance (JCA) website, juntocommunity.org
**Scope:** Option B, approved by Paul on Oct 26, 2026
**First feature:** "Who Can Help?" organization profiles (first profile: SCORE Greater Phoenix)
**Prepared by:** Jeel Kakadiya
**Date:** Oct 27, 2026
**Status:** Draft for internal review

---

## 1. Goal

Build a private content management system (CMS) for the JCA website. Paul and the JCA team can log in and manage website content themselves, without a developer for every change.

The first content type is **Profiles**. A profile is a short, independently researched page about one Valley organization that helps small businesses (for example SCORE, Maricopa SBDC, Arizona Commerce Authority, Local First Arizona). Paul writes the content. The CMS lets him add, edit, publish and hide profiles. Visitors read the published profiles on the public site.

The CMS is the foundation for later modules: Library Profiles, Meeting Space Concierge, Library Intelligence, Events and registration.

### Success criteria

- Paul can log in on his own.
- Paul can create a new profile, save it as a draft, preview it and publish it without help.
- A published profile appears on the public site right away. A draft or hidden profile never does.
- Nobody except invited admins can get into the admin area or change content.
- The SCORE profile is live as the first example.

---

## 2. Out of scope (for this build)

- Library Profiles, Meeting Space Concierge, Data Axle Translator (Paul's three new ideas)
- Library Intelligence management
- Events management and own event registration (replacing Eventbrite)
- Public user accounts or public sign-up
- Multiple admin roles or permission levels (all admins have equal access in this build)
- Comments, ratings or reviews on profiles
- Search and filtering on the public profiles page (only needed once there are many profiles)

---

## 3. Users and roles

| Role | Who | Access |
|---|---|---|
| **Admin** | Paul, Jeel, anyone Paul approves later | Logs in to the admin area. Can create, edit, publish, hide and delete profiles. |
| **Visitor** | Anyone on the public website | No login. Can read published profiles only. |

Rules:
- There is **no public sign-up**. Admins are invited manually by Jeel.
- An account that is not on the admin list cannot reach the admin area even if it exists in the auth system.

---

## 4. Workflows

### 4.1 Admin login

1. Admin goes to the admin address.
2. If not logged in, the system sends them to the login step.
3. Admin enters email and password.
4. System checks the credentials and confirms the email is on the admin list.
5. On success, admin lands on the admin home. On failure, a clear error is shown and they stay on login.
6. The session stays active until the admin logs out or the session expires.

### 4.2 Forgot password

1. Admin chooses "forgot password" and enters their email.
2. System sends a reset email (only if the email belongs to an admin; the response is the same either way so it does not reveal who is an admin).
3. Admin sets a new password from the link and logs in.

### 4.3 Inviting a new admin

1. Paul asks Jeel to add someone.
2. Jeel invites the email from Supabase and adds it to the admin list.
3. The new admin receives an invite email, sets a password and logs in.

### 4.4 Creating a profile

1. Admin opens Profiles and chooses to add a new profile.
2. Admin fills in the profile fields (see section 6).
3. The page address (slug) is generated from the name. Admin can change it before first publish.
4. Admin can **save as draft** at any time. Drafts are never public.
5. Admin can **preview** the profile exactly as visitors will see it.
6. Admin **publishes**. The profile becomes visible on the public site.

### 4.5 Editing a profile

1. Admin opens an existing profile.
2. Admin changes any field and saves.
3. If the profile is published, changes go live on save.
4. The "last updated" date and the admin who made the change are recorded.

### 4.6 Hiding and deleting a profile

1. **Hide (unpublish):** profile goes back to draft. It disappears from the public site but is kept.
2. **Delete:** profile is removed. Requires a confirmation step inside the system. Suggested: soft delete (kept in the database, marked deleted) so it can be restored if needed.

### 4.7 Reordering profiles

1. Admin sets the display order of published profiles.
2. The public overview shows profiles in that order.

### 4.8 Visitor reading profiles

1. Visitor follows the "Who Can Help?" link in the site menu.
2. Visitor sees a list of all published profiles (name, tagline, link).
3. Visitor opens one profile and reads the full content.
4. Visitor can go to the organization's own website from the profile, or go back to the list.
5. If a visitor opens an address for a profile that does not exist or is not published, they see a "not found" page.

### 4.9 Logout

1. Admin logs out.
2. Session ends. Going back to an admin page sends them to login.

---

## 5. Functional requirements

### 5.1 Authentication and access

| ID | Requirement |
|---|---|
| AUTH-1 | Admins log in with email and password. |
| AUTH-2 | No public sign-up. New admins are invited only. |
| AUTH-3 | Every admin page and admin action requires a valid session. |
| AUTH-4 | Only emails on the admin list can access admin pages or change data, checked on the server and in the database. |
| AUTH-5 | Forgot password and reset password flows work by email. |
| AUTH-6 | Logout ends the session. |
| AUTH-7 | Failed logins show a clear, non-revealing error. |

### 5.2 Admin home

| ID | Requirement |
|---|---|
| HOME-1 | After login, admin lands on an admin home. |
| HOME-2 | Admin home shows a simple summary: number of published and draft profiles, and the most recently updated profile. |
| HOME-3 | Navigation lists Profiles now and has room for future modules. |

### 5.3 Profile management

| ID | Requirement |
|---|---|
| PROF-1 | Admin can see a list of all profiles with name, status and last updated date. |
| PROF-2 | Admin can create a profile. |
| PROF-3 | Admin can edit any profile. |
| PROF-4 | Admin can save as draft. |
| PROF-5 | Admin can publish a draft. |
| PROF-6 | Admin can hide (unpublish) a published profile. |
| PROF-7 | Admin can delete a profile after confirming. Soft delete. |
| PROF-8 | Admin can preview a profile before publishing. |
| PROF-9 | Slug is generated from the name, must be unique and URL-safe. Admin can edit it. |
| PROF-10 | Required fields are validated before publish. Drafts may be incomplete. |
| PROF-11 | Website URL is validated as a proper link. Contact email is validated if entered. |
| PROF-12 | Admin can upload an optional logo (image only, size limit). |
| PROF-13 | Admin can set the display order of profiles. |
| PROF-14 | System records created date, updated date, and which admin last edited. |
| PROF-15 | Long text fields support basic formatting (paragraphs, bold, bullet lists, links). |

### 5.4 Public profiles

| ID | Requirement |
|---|---|
| PUB-1 | Public overview page lists all published profiles in display order. |
| PUB-2 | Each published profile has its own page at its slug. |
| PUB-3 | Draft, hidden and deleted profiles are never shown, even by direct address. |
| PUB-4 | Each profile page shows the "independently researched, not a sponsored listing" note. |
| PUB-5 | The organization's website link opens in a new tab. |
| PUB-6 | The site menu links to the overview page. |
| PUB-7 | Each page has its own title and description for search engines and link previews. |
| PUB-8 | Published changes appear on the public site within a minute. |
| PUB-9 | Unknown or unpublished slugs return a proper "not found" response. |

---

## 6. Profile content (fields)

Based on Paul's SCORE draft and his original request.

| Field | Required to publish | Notes |
|---|---|---|
| Name | Yes | e.g. SCORE Greater Phoenix |
| Slug | Yes | Auto from name, unique, editable |
| Tagline | Yes | One line |
| Intro | Yes | Short paragraph(s) |
| How they can help | Yes | Formatted text |
| Who should explore | Yes | Formatted text |
| History / background | No | Paul's original request mentioned history; optional field |
| Contact name | No | Point of contact |
| Contact role | No | |
| Contact email | No | Validated if present |
| Contact phone | No | |
| Website URL | Yes | Validated link ("Where to begin") |
| Logo | No | Only with the organization's permission |
| Status | Yes | Draft or Published |
| Display order | Auto | Editable |
| Created at / Updated at / Updated by | Auto | System fields |
| Deleted at | Auto | Set on soft delete |

---

## 7. Data and security

### 7.1 Tables

**admins**
- user id (links to the auth user)
- email
- created at

**profiles**
- id
- name, slug (unique), tagline, intro, how_they_help, who_should_explore, history
- contact_name, contact_role, contact_email, contact_phone
- website_url, logo_path
- status (draft / published)
- display_order
- created_at, updated_at, updated_by, deleted_at

### 7.2 Storage

- One storage bucket for profile logos. Public read, admin-only write.

### 7.3 Security rules (row level security)

| Who | profiles | admins | logos |
|---|---|---|---|
| Visitor (anonymous) | Read only where status is published and not deleted | No access | Read |
| Logged-in non-admin | Same as visitor | No access | Read |
| Admin | Full read and write | Read | Read and write |

### 7.4 Supabase notes

- The Oct 30, 2026 Supabase change means new tables need API access granted explicitly. Every new table in this build must include those grants in its setup script.
- Free plan pausing is handled by the existing hourly keep-alive job. Revisit the Pro plan when traffic grows.
- All database changes are written as migration scripts and kept in the repo.

---

## 8. Non-functional requirements

| Area | Requirement |
|---|---|
| Ownership | All accounts and data stay in JCA's name. |
| Security | Secrets live only in environment variables, never in the repo or emails. |
| Reliability | Admin actions show clear success or error messages. Nothing fails silently. |
| Performance | Public profile pages load fast and are cached, refreshed when content changes. |
| Mobile | Admin area and public pages work on phone and desktop. |
| Accessibility | Keyboard usable, readable contrast, labeled form fields. |
| Maintainability | Built so new content types (library profiles, events) can reuse the same patterns. |
| Cost | No new paid services for this build. |

---

## 9. Build phases

| Phase | Outcome | Est. hours |
|---|---|---|
| 1. Foundation and login | Admins can log in to a protected, empty admin area | 4 to 5 |
| 2. Profiles data and public pages | SCORE profile live on the public site | 5 to 6 |
| 3. Profile manager | Paul can manage profiles himself | 5 to 7 |
| 4. Testing and hand-off | Verified, documented, Paul trained | 2 to 3 |
| **Total** | | **16 to 21** |

Hours are planning estimates, not quotes. Actual hours are billed.

---

## 10. Tickets

Format: **ID, title**, description, acceptance criteria, estimate, depends on.

### Phase 1: Foundation and login

**CMS-01: Project setup for the admin area**
Set up the admin section of the site, environment variables and Supabase client for server and browser use.
- Admin route group exists and builds without errors.
- Supabase keys are read from environment variables in local and Vercel.
- No secrets committed.
Estimate: 0.5 hr. Depends on: none.

**CMS-02: Admins table and access rules**
Create the `admins` table, row level security, and API grants. Add Paul and Jeel.
- Migration script creates the table, rules and grants.
- Only admins can read the table.
- Paul and Jeel are listed.
Estimate: 0.5 hr. Depends on: CMS-01.

**CMS-03: Login**
Email and password login using Supabase Auth.
- Correct credentials for an admin log in and go to admin home.
- Wrong credentials show a clear error.
- Non-admin account is refused.
- No sign-up option anywhere.
Estimate: 1 hr. Depends on: CMS-02.

**CMS-04: Protect admin routes**
Server-side check on every admin page and action.
- Logged-out users are sent to login.
- Logged-in non-admins are refused.
- Direct links to admin pages are also protected.
Estimate: 1 hr. Depends on: CMS-03.

**CMS-05: Logout**
- Logout ends the session and returns to login.
- Back button does not reopen admin pages.
Estimate: 0.25 hr. Depends on: CMS-03.

**CMS-06: Forgot and reset password**
- Reset email is sent for admin emails.
- Response does not reveal whether an email is an admin.
- New password works for login.
Estimate: 0.75 hr. Depends on: CMS-03.

**CMS-07: Admin home shell and navigation**
Empty admin home with navigation for Profiles and placeholders for future modules.
- Admin home loads after login.
- Navigation works on phone and desktop.
Estimate: 0.75 hr. Depends on: CMS-04.

**CMS-08: Invite Paul**
Invite Paul through Supabase and confirm he can log in.
- Paul receives the invite, sets a password, and logs in.
Estimate: 0.25 hr. Depends on: CMS-03, CMS-06.

### Phase 2: Profiles data and public pages

**CMS-09: Profiles table, rules and grants**
Create the `profiles` table with all fields in section 7.1, unique slug, rules from 7.3 and API grants.
- Visitors can read only published, non-deleted rows.
- Admins can read and write all rows.
- Migration is in the repo.
Estimate: 1 hr. Depends on: CMS-02.

**CMS-10: Logo storage bucket**
- Bucket created with public read and admin-only write.
- File type and size limits set.
Estimate: 0.5 hr. Depends on: CMS-02.

**CMS-11: Seed the SCORE profile**
Add SCORE Greater Phoenix from Paul's draft as the first published profile.
- All required fields filled with Paul's exact text.
- Profile is published.
Estimate: 0.25 hr. Depends on: CMS-09.

**CMS-12: Public overview page**
Lists published profiles in display order.
- Shows only published profiles.
- Each item links to its profile page.
- Handles zero profiles gracefully.
Estimate: 1.5 hr. Depends on: CMS-09.

**CMS-13: Public profile page**
One page per published profile at its slug.
- Shows all filled fields; empty optional fields are left out.
- Website link opens in a new tab.
- Shows the "independently researched, not a sponsored listing" note.
- Unpublished or unknown slugs return "not found".
Estimate: 1.5 hr. Depends on: CMS-09.

**CMS-14: Search engine and link-preview tags**
- Each public page has its own title and description.
- Overview and profiles appear in the sitemap.
Estimate: 0.5 hr. Depends on: CMS-12, CMS-13.

**CMS-15: Menu link and refresh on publish**
- "Who Can Help?" (or the name Paul picks) is in the site menu.
- Published changes show on the public site within a minute.
Estimate: 0.5 hr. Depends on: CMS-12.

### Phase 3: Profile manager

**CMS-16: Profiles list in admin**
- Shows all non-deleted profiles with name, status and last updated.
- Links to create and edit.
Estimate: 1 hr. Depends on: CMS-07, CMS-09.

**CMS-17: Create profile with draft save**
- All fields from section 6 available.
- Slug auto-generated from name, unique, editable.
- Saving as draft works with incomplete content.
Estimate: 1.5 hr. Depends on: CMS-16.

**CMS-18: Edit profile**
- All fields editable.
- Updated date and editor recorded on save.
- Changes to a published profile go live on save.
Estimate: 0.75 hr. Depends on: CMS-17.

**CMS-19: Validation**
- Required fields enforced on publish only.
- Website URL and contact email checked.
- Duplicate slug blocked with a clear message.
Estimate: 0.5 hr. Depends on: CMS-17.

**CMS-20: Publish and hide**
- Publish makes a draft public.
- Hide returns a profile to draft and removes it from the public site.
Estimate: 0.5 hr. Depends on: CMS-18, CMS-19.

**CMS-21: Preview**
- Admin can see a draft exactly as visitors would, without publishing it.
Estimate: 0.75 hr. Depends on: CMS-13, CMS-17.

**CMS-22: Delete with confirmation (soft delete)**
- Delete asks for confirmation inside the page.
- Deleted profiles disappear from admin list and public site.
- Data is kept and can be restored by Jeel.
Estimate: 0.5 hr. Depends on: CMS-18.

**CMS-23: Logo upload**
- Admin can upload, replace or remove a logo.
- Only images within the size limit are accepted.
Estimate: 0.75 hr. Depends on: CMS-10, CMS-18.

**CMS-24: Display order**
- Admin can change the order of profiles.
- Public overview follows the order.
Estimate: 0.5 hr. Depends on: CMS-16.

**CMS-25: Admin home summary**
- Shows counts of published and draft profiles and the latest updated profile.
Estimate: 0.25 hr. Depends on: CMS-16.

### Phase 4: Testing and hand-off

**CMS-26: Security testing**
- Logged out, non-admin and admin cases tested on every admin page and action.
- Direct database requests as a visitor cannot read drafts or write anything.
Estimate: 0.75 hr. Depends on: Phase 3.

**CMS-27: Functional and device testing**
- Full create, edit, publish, hide, delete flow tested.
- Phone and desktop checked for admin and public pages.
Estimate: 0.75 hr. Depends on: Phase 3.

**CMS-28: Admin guide for Paul**
One short document: how to log in, add, edit, publish, hide and reset a password.
Estimate: 0.5 hr. Depends on: Phase 3.

**CMS-29: Walkthrough with Paul**
Short call to show Paul the CMS and have him publish a test profile.
- Paul publishes and hides a profile on his own.
Estimate: 0.5 hr. Depends on: CMS-28.

**CMS-30: Production release and backup check**
- Deployed to the live site.
- Database backup confirmed before and after release.
Estimate: 0.5 hr. Depends on: CMS-26, CMS-27.

### Ticket summary

| Phase | Tickets | Est. hours |
|---|---|---|
| 1. Foundation and login | CMS-01 to CMS-08 | 5 |
| 2. Profiles data and public pages | CMS-09 to CMS-15 | 5.75 |
| 3. Profile manager | CMS-16 to CMS-25 | 7 |
| 4. Testing and hand-off | CMS-26 to CMS-30 | 3 |
| **Total** | **30 tickets** | **~20.75** |

---

## 11. Open questions for Paul

1. **Section name:** "Who Can Help?" or another name? It sets the public page address.
2. **Contact person:** show a named contact on each profile, or only the organization's website?
3. **History field:** include a history/background section, as in his original request, or keep to the SCORE draft structure?
4. **Logos:** include organization logos? Requires permission from each organization.
5. **Admin access:** only Paul and Jeel at launch, or anyone else?
6. **Remaining three profiles:** when will content for Maricopa SBDC, Arizona Commerce Authority and Local First Arizona be ready?

---

## 12. Future modules on this foundation

| Module | Reuses |
|---|---|
| Library Profiles | Profile system with library-specific fields |
| Meeting Space Concierge | Library profiles plus room data and search filters |
| Library Intelligence | Admin area plus a new content type |
| Events and own registration | Admin area plus events and registrations tables (replaces Eventbrite) |
| Data Axle Translator | Separate tool; needs research on library data terms first |
