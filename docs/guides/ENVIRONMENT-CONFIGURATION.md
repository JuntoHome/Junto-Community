# Environment configuration

Every setting the app depends on: environment variables, and the settings that exist only in dashboards. The template is [.env.example](../../.env.example). Never commit real values.

## Environment variables

| Variable | In the browser | Required | Needed for | Where the value comes from |
|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes, for `build` and anything Supabase | All Supabase access; the allowed image host in `next.config.ts` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Yes, for `build` and admin | Public profile reads, admin login (`sb_publishable_...`) | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | **Never** | For subscribe, reset, cron | Subscribe insert, password-reset lookup, keep-alive | Supabase → Project Settings → API Keys |
| `RESEND_API_KEY` | No | Optional | Email to the team on each signup. Without it, signups still save | Resend dashboard |
| `SUBSCRIBE_NOTIFY_EMAIL` | No | Optional | Recipients of that email, comma-separated. Defaults to the site contact email | |
| `RESEND_FROM_EMAIL` | No | Optional | Sender on a domain verified in Resend. Defaults to `notifications@juntocommunity.org` | |
| `CRON_SECRET` | No | In Vercel, yes | Protects `/api/cron/keep-alive`. Any long random string; any string locally | Generate one |
| `GOOGLE_SITE_VERIFICATION` | No | Optional | Google Search Console HTML-tag verification (the `content` value only) | Search Console |
| `OPENAI_API_KEY` | **Never** | Optional | Translator Phase 2: the key for the AI calls made by `/api/translator/ai`. Without it, Chat with AI is not shown and the form works as before | OpenAI dashboard → API keys |
| `OPENAI_MODEL` | No | Optional | Translator Phase 2: the model to use. Defaults to `gpt-4o-mini` when empty. Check the model is current before release (**Unverified**) | An OpenAI model name |
| `TRANSLATOR_AI` | No | Optional | Translator Phase 2: set to `off` to hide Chat with AI even when the key is set. Any other value, or empty, leaves it on | `off`, or leave empty |

`BUILT_AT` is set by `next.config.ts` at build time; don't set it yourself.

The Translator's Phase 1 uses no environment variables. The three Phase 2 variables were added in TR-38. Since TR-39 they are read only in `src/features/translator/ai/client.ts`, by the AI route `/api/translator/ai` ([translator/PHASE2-CODE-GUIDE.md](../translator/PHASE2-CODE-GUIDE.md)). Chat with AI shows only when `OPENAI_API_KEY` is set and `TRANSLATOR_AI` is not `"off"`.

### What happens when one is missing

| Missing | Effect |
|---|---|
| Both public Supabase variables | `npm run dev` serves static pages; profiles show the empty message; the subscribe form shows a friendly error. `npm run build` fails on `/admin` |
| `SUPABASE_SERVICE_ROLE_KEY` | Subscribe shows "Something went wrong on our end"; reset requests silently send nothing; cron returns 500 |
| `RESEND_API_KEY` | Signups save; no notification email |
| `CRON_SECRET` | Cron returns 500 "Not configured" |
| `OPENAI_API_KEY` | `/api/translator/ai` answers `503` ("The AI assistant is not available right now. Use the form instead."). Once the chat UI is built, Chat with AI is not shown and the form works as before |

## Per environment

| Environment | Where variables are set | Database it reaches |
|---|---|---|
| Local | `.env.local` (git-ignored) | Whatever `.env.local` points at; production with the shared keys |
| Preview and staging | Vercel → Settings → Environment Variables → Preview | Production |
| Production | Vercel → Settings → Environment Variables → Production | Production |

Set every variable for **both** Production and Preview. Vercel applies changes to new deployments only; redeploy after changing one.

The three Translator Phase 2 variables (`OPENAI_API_KEY`, `OPENAI_MODEL`, `TRANSLATOR_AI`) are server only and go in both Production and Preview. Keep `TRANSLATOR_AI=off` in Production until Phase 2 is approved.

## Rules

- `SUPABASE_SERVICE_ROLE_KEY` is server-only. It is read only in `src/lib/supabase/admin.ts`, which starts with `import "server-only"`. Never prefix it with `NEXT_PUBLIC_`.
- `OPENAI_API_KEY` is server-only. It is read only in `src/features/translator/ai/client.ts`, which starts with `import "server-only"`. Never put it in client code and never prefix it, `OPENAI_MODEL` or `TRANSLATOR_AI` with `NEXT_PUBLIC_`.
- Anything prefixed `NEXT_PUBLIC_` is bundled into the browser. Only the Supabase URL and publishable key belong there.
- Secrets live only in `.env.local` and Vercel, never in the repo, issues, pull requests or emails.

### Adding a variable

1. Read it on the server unless it must reach the browser.
2. Add it to `.env.example` with an empty value and a comment saying what it is for.
3. Set it in Vercel Production and Preview.
4. Add it to the table above.

## Settings outside environment variables

These change behaviour but live only in dashboards. **Unverified** from the repository.

| Setting | Where | Expected value |
|---|---|---|
| Sign-up | Supabase → Authentication → Sign In / Providers | Disabled |
| SMTP | Supabase → Authentication → Emails → SMTP Settings | Resend |
| Site URL | Supabase → Authentication → URL Configuration | The production domain; used in every invite and reset link |
| Email templates | Supabase → Authentication → Emails → Templates | Pasted from `supabase/templates/` |
| Password rules and Auth rate limits | Supabase → Authentication | Supabase defaults unless changed |
| Cron Jobs | Vercel → Settings → Cron Jobs | Read from `vercel.json`; needs `CRON_SECRET` |
| Domains and staging alias | Vercel → Settings → Domains | Production domain; `translator` branch alias pending (TR-01) |
| Resend sender domain | Resend → Domains | `juntocommunity.org` verified |
