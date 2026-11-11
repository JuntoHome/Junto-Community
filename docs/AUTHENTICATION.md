# Authentication and authorization

Only admins authenticate. Visitors never log in.

| Topic | In this project |
|---|---|
| Public registration | None. Accounts are created by invitation from the Supabase dashboard |
| Customer accounts | None |
| Admin login | Email and password through Supabase Auth |
| One-time codes | Only inside invite and reset-password emails; verified with Supabase `verifyOtp`. There is no SMS or login OTP |
| Multi-factor authentication | None (see [KNOWN-ISSUES.md](KNOWN-ISSUES.md#security)) |

## Who does what

| Concern | Handled by |
|---|---|
| Password storage and hashing | Supabase Auth; the app never sees a hash |
| Sessions and tokens | Supabase Auth, held in cookies by `@supabase/ssr` |
| One-time codes for invite and reset | Supabase Auth generates them and emails them through Resend SMTP |
| "Is this user an admin?" | The `admins` table, checked by `getAdmin()` in the app and `private.is_admin()` in the database |

## Flows

### Login

`login()` in [src/features/admin-auth/actions.ts](../src/features/admin-auth/actions.ts): validate → rate limit → `signInWithPassword` → look up own row in `admins` → if absent, sign out and refuse → redirect to `/admin`.

### Session

A short-lived access token (JWT) plus a refresh token, in cookies. `proxy.ts` calls `refreshSession()` on `/admin` and `/preview` requests to renew an expired token before the page renders, because Server Components can't write cookies. Public pages never touch auth.

### Access check on every request

`requireAdmin()` → `getAdmin()` in [src/lib/auth.ts](../src/lib/auth.ts):

1. `supabase.auth.getUser()` asks Supabase Auth over the network, so a logged-out session is rejected at once. (`getClaims()` would only check the token's signature.)
2. Select the user's own row from `admins`. RLS shows that table to admins only, so finding the row is the check.

`getAdmin` is wrapped in React `cache()`, so the layout, page and metadata share one check per request.

### Invite

1. Someone with dashboard access invites the email in Supabase and adds a row to `admins` by SQL ([guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md#add-an-admin)).
2. The email links to `/admin/set-password?token_hash=...&type=invite`.
3. The new admin sets a password and lands on `/admin`.

### Forgot password

`requestPasswordReset()`: a service-role lookup of the email in `admins`; only if found, `resetPasswordForEmail`. The response is the same either way, so it doesn't reveal who is an admin.

### Set password

`setPassword()`: the one-time code is verified only when the form is submitted, never when the page opens, so email link scanners can't use it up. After `verifyOtp` the admin check runs again. If the code was consumed but the password was rejected, the form retries using the new session (`codeUsed`). The page sets `referrer: no-referrer` because its URL holds the code. Passwords are 10 to 72 characters.

### Logout

`signOut({ scope: "local" })` ends the session on this device only. Because `is_admin()` requires the session to exist, a copied token stops working against the Supabase API at the same moment (CMS-26).

### Removing an admin

Deleting their `admins` row takes effect on their next request, even if they are still logged in.

## Emails

| Email | Sent by | Through | Template |
|---|---|---|---|
| Invite | Supabase Auth | Resend SMTP (set in the Supabase dashboard) | [supabase/templates/invite.html](../supabase/templates/invite.html) |
| Reset password | Supabase Auth | Resend SMTP | [supabase/templates/recovery.html](../supabase/templates/recovery.html) |
| New subscriber (to the team) | The app (`features/subscribe/notify.ts`) | Resend HTTP API | Built in code |

The templates must be pasted into the Supabase dashboard; editing the files alone changes nothing ([guides/ADMIN-OPERATIONS.md](guides/ADMIN-OPERATIONS.md#update-the-invite-and-reset-emails)).

Invite and reset links are built from Supabase's **Site URL**, so they always open the production site, even when triggered from a preview or local environment.

## Authorization layers

| Layer | Where | Stops |
|---|---|---|
| Route layout | `admin/(protected)/layout.tsx` | Direct links while logged out |
| Page and action | `requireAdmin()` at the top of each | Client-side navigation and direct action calls |
| Database | RLS with `private.is_admin()` | Anyone calling the Supabase API directly |
| Build | `import "server-only"` | Server code or the service key reaching the browser |

Rules for new code:

- Every admin page and every admin Server Action calls `await requireAdmin()` first.
- Admin code uses `src/lib/supabase/server.ts` so RLS applies. Never use the service-role client (`admin.ts`) for admin features.
- `SUPABASE_SERVICE_ROLE_KEY` is never prefixed with `NEXT_PUBLIC_`.

## What is done well

- Access is enforced in the database, not only in the app.
- Uniform responses on login and reset don't reveal who is an admin.
- The service-role key is used in three narrow places and guarded by `server-only`.
- Uploads are checked by file signature; SVG is refused; filenames are random.
- Admin-typed text is rendered as React elements with a link-scheme allow-list; JSON-LD is escaped.
- Website and link fields reject non-http schemes and embedded credentials.
- `/admin` and `/preview` are excluded from search engines and analytics.

Security concerns and gaps are listed in [KNOWN-ISSUES.md](KNOWN-ISSUES.md#security).

## Settings that live only in the Supabase dashboard

**Unverified** from the repository; check them in the dashboard:

- Sign-up disabled (Authentication → Sign In / Providers).
- SMTP through Resend (Authentication → Emails → SMTP Settings).
- Site URL set to the production domain.
- Invite and recovery templates pasted from `supabase/templates/`.
- Password rules and Auth rate limits.

Even with sign-up enabled, a new account would not be an admin without a row in `admins`.
