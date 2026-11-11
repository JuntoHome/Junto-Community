# Troubleshooting

Symptoms, causes and fixes. Causes come from reading the code; entries marked **Reproduced** were seen and confirmed.

## Where to look first

| Symptom | Look at |
|---|---|
| A write fails with a generic message | Server logs for the prefix: `[profiles]`, `[subscribe]`, `[login]`, `[reset]`, `[set-password]`, `[keep-alive]`. Locally that is the `npm run dev` terminal; in production, Vercel → Project → Logs |
| Admin page shows "Something went wrong" | The thrown error in the same logs; usually Supabase unreachable or a missing variable |
| A database refusal | Supabase → Logs, and compare the live schema with `supabase/migrations/` |
| An email didn't arrive | `[reset]` or `[subscribe]` log, then Supabase Auth logs, then Resend's dashboard |

## Local development

| Symptom | Cause | Fix |
|---|---|---|
| `npm run build` fails with "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" while exporting `/admin` (**Reproduced** Nov 11, 2026) | No `.env.local`, or those two variables are empty. The build pre-renders `/admin`, which creates a Supabase client | Fill them in. To check only that the code compiles, set placeholder values for the build: `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.invalid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=placeholder npm run build` |
| `npm run test` says the script is missing | Vitest is added in TR-29 | Run `typecheck`, `lint` and `build` until then |
| Lint warning about `<img>` in `opengraph-image.tsx` | Expected: `next/image` can't be used in image generation | Ignore |
| Logos don't show | `NEXT_PUBLIC_SUPABASE_URL` missing at build or dev start, so `next.config.ts` has no allowed image host | Set it and restart |
| Changes to `.env.local` have no effect | The dev server reads variables at start | Restart `npm run dev` |

## Admin login and passwords

| Symptom | Likely cause |
|---|---|
| "This account doesn't have admin access" | The user exists in Auth but not in `admins` ([add them](guides/ADMIN-OPERATIONS.md#add-an-admin)) |
| Login works, then bounces back to login | Cookies not being set: check both public Supabase variables and that the request passes through `proxy.ts` |
| Redirected to login repeatedly | Is the user in `admins`? Are the two public Supabase variables set? |
| "Too many attempts" | 5 attempts per 10 minutes per IP and action; wait, or restart the local server |
| "This link has expired or was already used" | Links are single-use and time-limited; request a new one and use it within the hour |
| Invite or reset link opens the live site from a test | Links use Supabase's Site URL |
| Email looks like Supabase's default | The template wasn't pasted into the dashboard ([how](guides/ADMIN-OPERATIONS.md#update-the-invite-and-reset-emails)) |
| Reset says "sent" but nothing arrives | By design the response doesn't reveal failures. Check `[reset]` in the logs, Supabase SMTP settings and Resend; also check `admins.email` matches the Auth email |

## Profiles in the admin

| Symptom | Likely cause | Check |
|---|---|---|
| "Another profile already uses this address" | `profiles_slug_key` | A live profile with that slug; deleted ones don't count |
| "Needed while the profile is published" on Save | A required field was emptied on a published profile | Fill it, or Hide first |
| "The profile couldn't be saved" | Unexpected database error | `[profiles] update failed` in the logs |
| "The logo couldn't be uploaded" | Storage policy or bucket limits | `[profiles] logo upload failed`; is the session still valid? |
| A large logo fails before reaching the server | Body over the 3 MB Server Action limit | `next.config.ts` `bodySizeLimit` |
| Form shows old values after save | The `key` on `ProfileForm` was removed or changed | `[id]/page.tsx` |
| Order looks wrong after an interrupted move | Reordering is not atomic | Move any profile once; the numbers are repaired |

## Public profile pages

| Symptom | Likely cause |
|---|---|
| A published profile returns 404 | Slug mismatch, or `deleted_at` is set |
| Change not visible | Up to 30 seconds of cache if it was changed outside the admin |
| Section heading is wrong | Headings come from `content/who-can-help.ts`, not the database |
| A link shows as plain text | Its scheme isn't http(s), mailto or tel |
| Bullets run together as a paragraph | No space after the dash |
| Restoring a deleted profile fails on `profiles_slug_key` | Another live profile took the address; give the restored one a new slug ([how](guides/ADMIN-OPERATIONS.md#restore-a-deleted-profile)) |

## Mailing list

| Symptom | Likely cause |
|---|---|
| "Something went wrong on our end" | `SUPABASE_SERVICE_ROLE_KEY` missing or wrong; `[subscribe]` in the logs |
| Signups saved but no email | `RESEND_API_KEY` missing, or the sender domain isn't verified in Resend |
| "Too many attempts" for a real visitor | Several people behind one IP; 5 per 10 minutes |
| Success shown but no row | The honeypot field was filled (a browser extension or autofill can do this) |

## Keep-alive and the database

| Symptom | Cause |
|---|---|
| 500 "Not configured" | `CRON_SECRET` missing in Vercel |
| 401 | The secret differs between Vercel and the caller |
| `mode: "read"` in the response | The `keep_alive` table is missing; apply its migration |
| Profiles, login and signups all fail at once | The Supabase project may be paused; check the dashboard and the cron history |

## Deployment

| Symptom | Cause |
|---|---|
| A preview or production build fails on `/admin` | The public Supabase variables are not set for that Vercel environment |
| A new variable has no effect after setting it | Vercel applies variables to new deployments; redeploy |
| A merged change isn't on the live site | It was merged to `translator`, not `main`; production deploys only from `main` |
