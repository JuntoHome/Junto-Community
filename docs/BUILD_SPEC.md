# JCA Website: Phase 1 Build Spec

Build the Phase 1 site for **Junto Community Alliance (JCA)** at **juntocommunity.org**.
Goal: a credible front door and a frictionless path from a flyer, QR code, email or LinkedIn post to **Eventbrite registration** for the Business Insights 101 workshop on **Oct 21, 2026**.

Do not build the full JCA vision yet. Keep it simple, fast and mobile-first.

---

## 1. What's in this bundle

| Path | What it is |
|---|---|
| `BUILD_SPEC.md` | This file. The source of truth |
| `design/*.dc.html` | Approved mockups (desktop + mobile). Use them for layout, spacing, colors and copy. They use a custom `<x-dc>` wrapper; ignore that and read the inline styles |
| `public/jca-logo-wide.png` | Primary logo (header). 1774x887 |
| `public/jca-logo-stacked.png` | Stacked logo with "Alliance" (hero on About, OG image). 1254x1254 |

---

## 2. Stack

| Item | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS |
| Fonts | `next/font/google`: **Fraunces** (headings, weights 500/700) and **Public Sans** (body, 400/500/600/700) |
| Database | Supabase (project ref `oucrmhhqlkmgkynyvzzw`), subscribers only |
| Hosting | Vercel project `junto-community`, auto-deploys from `main` of GitHub repo `JuntoHome/Junto-Community` |
| Analytics | `@vercel/analytics` |
| Domain | juntocommunity.org (GoDaddy DNS already points to Vercel; apex redirects to `www`) |

Registration is **not** built here. Eventbrite handles registration, attendee data, confirmations, reminders and exports.

---

## 3. Routes

| Route | Page | Notes |
|---|---|---|
| `/` | Homepage | See section 6 |
| `/BI101` | Business Insights 101 | **This URL is printed on flyers as a QR code. It must never change or break** |
| `/bi101` and any casing | Redirect to `/BI101` | Next.js routes are case-sensitive; add a permanent redirect (middleware or `next.config` redirects) so `/bi101`, `/Bi101` etc. all work |
| `/about` | About JCA | Content is a placeholder until Paul's GoDaddy About text arrives |
| `/api/subscribe` (or a Server Action) | Subscribe handler | See section 8 |
| `404` | Friendly not found | Link back to `/` and `/BI101` |

---

## 4. Design tokens

| Token | Value | Use |
|---|---|---|
| `navy` | `#0E2F56` | Primary, headings, buttons, dark bands |
| `navy-deep` | `#0A2342` | Footer, text on gold |
| `green` | `#3F6B3E` | Eyebrows, icons, Join button |
| `green-dark` | `#2F5230` | Headings on green tint |
| `gold` | `#E0960E` | Register buttons, badges (navy text on gold) |
| `gold-text` | `#B4740A` | Gold used as text on light backgrounds |
| `gold-light` | `#F2D9A6` | Headline accent on navy |
| `ivory` | `#FBF8F1` | Page background |
| `sand` | `#E7E1D3` | Borders, dividers |
| `ink` | `#14233A` | Body text |
| `slate` | `#3A4659` | Paragraph text |
| `muted` | `#4B5563` | Secondary text |

- Radius: buttons 8 to 10px, cards 14 to 20px, badges fully rounded.
- Max content width about 1280px, side padding 80px desktop and 20px mobile.
- Touch targets at least 44px. Text contrast at least 4.5:1.
- No emoji. Icons are simple inline stroke SVGs (calendar, pin, monitor, clock, ticket).

---

## 5. Shared constants

```ts
export const EVENTBRITE_URL =
  "https://www.eventbrite.com/e/business-insights-101-tickets-2002318498530?aff=jcawebsite";

export const EVENT = {
  name: "Business Insights 101",
  date: "Wednesday, October 21, 2026",
  dateShort: "Wed, Oct 21, 2026",
  time: "12:00 to 2:00 PM MST",
  venue: "Peoria Public Library",
  address: "8463 W Monroe St, Peoria, AZ 85345",
  presenter: "Darryl T. Anderson",
  presenterOrg: "Tr33 LLC",
  presenterBook: "The Culture Architect",
};

export const CONTACT_EMAIL = "paul@juntocommunity.org";
export const TAGLINE = "Learn Something. Meet Someone. At the Library.";
export const CTA_JOIN = "Are you ready to join the Junto?";
```

All Register buttons open `EVENTBRITE_URL` in the same tab. Put a small note under the main Register button: "You'll finish registering on Eventbrite."

---

## 6. Homepage `/`

Paul's direction: the homepage should create curiosity, introduce the workshop and make it easy to register. The About page carries the full story.

**Header:** wide logo (links to `/`), nav: Workshops (`/BI101`), About (`/about`), Join the Junto (`/#join`), button "Register for BI101". Mobile: logo + hamburger menu.

**Hero (two columns desktop, stacked mobile)**

Left, use this copy verbatim:
- Badge: "Free workshop" + "Business Insights 101 · Wed, Oct 21"
- H1: **Have you ever worked in, or inadvertently created, a toxic work environment?**
- Gold line: **Then this workshop is for you.**
- Paragraph: "Whether you have a hundred employees or none at all, Business Insights 101 will help demystify the science behind creating a culture that translates return on experience (ROE) into return on investment (ROI)."
- Paragraph: "Seating at the Peoria Public Library is limited. But those who cannot attend in person can join us online for free."
- Buttons: "Register now" (Eventbrite) and "Workshop details" (`/BI101`)

Right, "Save the date" card:
- Business Insights 101
- Wednesday, October 21, 2026 · 12:00 to 2:00 PM
- Peoria Public Library · In person, limited seating
- Or join online · Free for everyone
- Gold button "Register Free" + Eventbrite note

**Join the Junto (navy band, id `join`)**
- Paragraph: "Junto Community brings together people who are passionate about learning, entrepreneurship, and community. There's nothing to buy, and all you need to get started is a library card."
- H2 (gold-light): **Are you ready to join the Junto?**
- Link: "Read our story" (`/about`)
- Subscribe form (section 8), button label **Join the Junto**

**Watch us grow strip:** "**Watch us grow.** This site is new, and more workshops and libraries are on the way."

**Footer:** "Junto Community Alliance", tagline, links About / Workshops, `mailto:` contact, "© 2026 Junto Community Alliance".

---

## 7. `/BI101` page

**Hero (navy band)**
- Badge "Free workshop" + "Presented by Junto Community Alliance"
- H1: **Business Insights 101**
- Lead (Fraunces, gold-light): "Every business owner has blind spots. The challenge is recognizing them before they limit growth, consume time, or create unnecessary stress."
- "Seating at the Peoria Public Library is limited. Can't attend in person? Join us online for free."
- "With **Darryl T. Anderson**, Tr33 LLC, author of *The Culture Architect*"

**Details card (white, beside hero on desktop, below on mobile)**
- Date: Wednesday, October 21, 2026
- Time: 12:00 to 2:00 PM MST
- Location: Peoria Public Library, 8463 W Monroe St, Peoria, AZ 85345 · In person, limited seating
- Online: Join free online · `[ONLINE PLATFORM: pending from Paul]`
- Cost: Free
- Button "Register Free" + Eventbrite note

**About the workshop**
- Emphasized: "Whether you have a hundred employees or none at all, Business Insights 101 will help demystify the science behind creating a culture that translates return on experience (ROE) into return on investment (ROI)."
- "Business Insights 101 is an interactive workshop for established small-business owners and leaders who want to step outside the day-to-day demands of running a business and take a closer look at what may be holding it back."
- "Participants will leave with practical ideas they can apply to their own businesses, and an opportunity to learn alongside other local business owners and problem solvers."
- Side card "What we'll explore":
  - The stages of business growth
  - How people, time and change relate
  - How stronger leadership and organizational awareness improve both the experience and the results

**Presenter**
- Photo placeholder (circle) until Darryl's photo arrives
- "Your presenter" / **Darryl T. Anderson** / "Business owner, consultant and author of *The Culture Architect* · Tr33 LLC"
- "Through Tr33 LLC, Darryl's work focuses on leadership, organizational culture and helping businesses navigate change more intentionally. His approach challenges owners and leaders to look beyond immediate operational problems and consider how people, leadership and culture influence performance."
- "*The Culture Architect* explores the leader's role in intentionally shaping the environment in which people work, respond to change and contribute to an organization's success."

**Save your seat (gold band)**
- H2 "Save your seat"
- "Wednesday, October 21 · 12:00 to 2:00 PM · Peoria Public Library or online · Free"
- "In-person seating is limited."
- Navy button "Register Free"
- Below: "Not ready yet? Join the Junto to hear about future workshops." (link to `/#join`)

Footer as on the homepage.

---

## 8. Subscribe / Join the Junto

**Fields:** First name, Email, ZIP code. Nothing else (Paul decided against a long intake form).

**Supabase table**

```sql
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  source text default 'website',
  created_at timestamptz not null default now()
);

create unique index subscribers_email_key on public.subscribers (lower(email));

alter table public.subscribers enable row level security;
-- No public policies: all writes go through the server with the service role key.
```

**Handler (Server Action or `/api/subscribe`)**
- Validate on the server (zod): name required, valid email, 5-digit ZIP.
- Honeypot hidden field; reject if filled. Basic rate limit per IP if easy.
- Insert with the **service role key on the server only**. Never expose it to the browser.
- Duplicate email: treat as success ("You're already on the list").
- UI states: idle, submitting (button disabled), success ("Welcome to the Junto! We'll be in touch about upcoming workshops."), error (inline, friendly).
- Real `<label>` elements, correct input types (`email`, `inputmode="numeric"` for ZIP), `autocomplete` attributes.

**Environment variables (set in Vercel, never commit)**

```
NEXT_PUBLIC_SUPABASE_URL=https://oucrmhhqlkmgkynyvzzw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Include a `.env.example` with these names and empty values.

---

## 9. About `/about`

- Eyebrow "Our story", H1 "About Junto Community Alliance", tagline, stacked logo.
- Body: placeholder block `[ABOUT TEXT: from the current GoDaddy About page]`. Keep the content in one easy-to-edit file (e.g. `content/about.md` or a TS constant) so it can be dropped in later.
- Navy CTA band: "Are you ready to join the Junto?" + "There's nothing to buy, and all you need to get started is a library card." + button to `/#join`.

---

## 10. SEO and sharing

| Page | Title | Description |
|---|---|---|
| `/` | Junto Community Alliance · Learn Something. Meet Someone. At the Library. | Free small-business workshops at your public library. Business Insights 101, Oct 21 at Peoria Public Library or online. |
| `/BI101` | Business Insights 101 · Free Workshop, Oct 21 · Junto Community Alliance | Free interactive workshop with Darryl T. Anderson. Wed, Oct 21, 12 to 2 PM at Peoria Public Library or online. |
| `/about` | About · Junto Community Alliance | Junto Community Alliance helps small-business owners access resources through their public libraries. |

- Open Graph and Twitter card tags on every page; OG image from the stacked logo on ivory (1200x630).
- Favicon from the logo mark.
- `sitemap.xml` and `robots.txt`.
- Schema.org `Event` JSON-LD on `/BI101` (name, startDate `2026-10-21T12:00:00-07:00`, endDate `2026-10-21T14:00:00-07:00`, `eventAttendanceMode: MixedEventAttendanceMode`, location Peoria Public Library with address, offers price 0 with the Eventbrite URL, organizer Junto Community Alliance).

---

## 11. Placeholders still pending (keep clearly marked, easy to replace)

| Item | Where | From |
|---|---|---|
| About page text | `/about` | Paul (old GoDaddy About section) |
| Darryl's photo | `/BI101` presenter | Paul / Darryl |
| Online platform (Zoom, Teams, YouTube) | `/BI101` details card | Paul |

---

## 12. Acceptance checklist

- [ ] `https://juntocommunity.org/BI101` loads on phone and desktop
- [ ] `/bi101` and other casings redirect to `/BI101`
- [ ] Every Register button opens the Eventbrite event with `?aff=jcawebsite`
- [ ] Subscribe form saves a row in Supabase; duplicates and bad input handled gracefully
- [ ] Service role key is not in the client bundle or the repo
- [ ] Layout checked at 390px, 768px and 1440px wide
- [ ] Lighthouse: Performance, Accessibility, SEO all 90+
- [ ] All links tested, no console errors
- [ ] Page titles, descriptions, OG tags present
- [ ] Vercel Analytics recording page views
- [ ] No em-dashes in site copy (client preference)

## Out of scope for Phase 1

Admin panel, Find Your Library, library database, local authors, stakeholder pages, workshop archives, Eventbrite-to-Supabase sync. These are Phase 2.
