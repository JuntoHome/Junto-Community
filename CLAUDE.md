# CLAUDE.md

Junto Community Alliance (JCA) website: juntocommunity.org. Documentation lives in `docs/`: start with `docs/README.md` (the index) and `docs/ARCHITECTURE.md` for the overall architecture.

## Stack and commands

Next.js 16 (App Router, TypeScript), React 19, Tailwind CSS 4, zod, Supabase, Vercel.

```bash
npm run dev        # http://localhost:3000
npm run build      # production build (also type-checks)
npm run typecheck
npm run lint
npm run test       # Vitest (added in TR-29)
```

Before every commit or PR: `build`, `typecheck`, `lint` and `test` must pass.

## Git

- Never push to `main`. `main` is the live site.
- Translator work: branch off `translator` (`tr-08-parse-workbook`), PR back into `translator`.
- Put `Closes #<issue>` in the PR description.

## Admin area (CMS, already built)

- Admin pages live in `src/app/admin/(protected)/`. Every admin page and every admin Server Action calls `await requireAdmin()` first (`src/lib/auth.ts`).
- Add a sidebar item in `src/components/admin/modules.ts`.
- Use `src/lib/supabase/server.ts` in admin code (row level security applies). Never use the service-role client (`admin.ts`) for admin features.

## Data Axle Translator (current project)

Tasks are GitHub issues TR-01 to TR-35 (milestone "Data Axle Translator Phase 1") and, from TR-38, the Phase 2 issues (milestone "Data Axle Translator Phase 2": Chat with AI). Each has steps and acceptance criteria. Follow them; ask before going beyond scope. Background, field mapping, ranking rules and expected results: `docs/translator/README.md`. Every Phase 2 ticket also follows `docs/translator/PHASE2-CODE-GUIDE.md`.

**Hard rules**

1. **Synthetic data only.** Never upload, copy, paste or commit real Data Axle / Reference Solutions records, even one row. Use `docs/translator/JCA_Synthetic_Contacts.xlsx` or the synthetic real-layout file from TR-35.
2. **Browser only, with two Phase 2 exceptions.** Workbooks are parsed, ranked and exported in the browser. Only two things may leave the browser, and only to our own server route `/api/translator/ai`: the **file summary** (TR-40), for the interview, and the **intro fields** of one chosen business (TR-48), for the intro draft. The user's own typed chat messages and goal travel with them. Never send full rows. Never store anything in Supabase, localStorage or cookies. Never log rows, summaries, chat text or AI replies (`console.log` included).
3. **One criteria object.** The form produces a `SearchBrief` (`src/features/translator/criteria/schema.ts`). Phase 2's AI will produce the same object. Do not create a second shape.
4. **Ranking is plain, deterministic code.** The AI never ranks, scores, filters or sorts. It only proposes a `SearchBrief` and drafts intro text. Same file + same brief = same order and reasons.
5. **Keep modules pure.** `import/`, `normalize/`, `criteria/`, `ranking/`, `export/` contain no React. UI lives in `ui/`.
6. Page: `/admin/translator` (`src/app/admin/(protected)/translator/page.tsx`). Not in the public menu or sitemap.
7. **The OpenAI API key is server env only.** It lives only in server environment variables. Never in client code, never `NEXT_PUBLIC_`.
8. **The file gate and synthetic-only data stay in force in Phase 2.** Real exports remain out of scope.

**Code layout:** `src/features/translator/{import,normalize,criteria,ranking,export,ui}/`. Phase 2 adds `ai/` and `ui/chat/`: layout, layers and patterns are in `docs/translator/PHASE2-CODE-GUIDE.md`.

**Expected results (tests must lock these in):**

| Scenario | Expected |
|---|---|
| Phoenix, AZ must-have; prefer Fabrication, Owner, 10 to 99 employees; 40 rows | 500 in, 499 unique, 100 eligible, 40 out, SYN-0001 first at 100 |
| Same, role preference changed to Operations Manager | SYN-0006 first at 100 |
| Tempe, AZ; prefer Logistics, Operations Manager, 10 to 99; 30 rows | 100 eligible, 30 out, SYN-0002 first at 100 |

## Style

- Match existing patterns (`src/features/profiles/` is the best reference).
- Plain-language user messages that say what went wrong and how to fix it.
- Small, focused PRs: one issue per PR.
