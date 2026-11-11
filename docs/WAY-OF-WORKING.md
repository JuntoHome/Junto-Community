# Way of working

How changes get from an idea to the live site. Code conventions are in [guides/CODING-STANDARDS.md](guides/CODING-STANDARDS.md).

## Branches

| Branch | Role | Rules |
|---|---|---|
| `main` | The live site. Every push deploys to production | Never push or commit to it directly. Nothing reaches it except a deliberate merge of finished work |
| `translator` | **Current base branch** for all work | Branch from it; open pull requests against it |
| `dev` | Unused; identical to `main` | Don't branch from it |
| Feature branches | One per ticket | Short-lived; deleted after merge |

```bash
git fetch origin
git switch translator
git pull
git switch -c <branch-name>
```

### Branch names

| Work | Pattern | Example |
|---|---|---|
| Translator ticket | `tr-<two-digit number>-<short-description>` | `tr-08-parse-workbook`, `tr-01-staging-docs` |
| Work without a ticket | Not yet defined. Use a short kebab-case description | `docs-structure` |

## Tickets

- Work is tracked as GitHub issues. Current milestone: **Data Axle Translator Phase 1** (TR-01 to TR-35, label `translator-phase-1`). Status summary: [TASKS.md](TASKS.md).
- The earlier CMS tickets (CMS-01 to CMS-30) are in [JCA_CMS_Plan.md](JCA_CMS_Plan.md), not GitHub.
- Each issue has steps and acceptance criteria. Follow them, and **ask before going beyond the issue's scope**.
- One issue per branch and per pull request.

### Implementing a ticket

1. Read the issue, [../CLAUDE.md](../CLAUDE.md), and for Translator work [translator/README.md](translator/README.md).
2. Branch from an up-to-date `translator`.
3. Make the change. Keep it small and focused on the issue.
4. Run the checks below.
5. Push and check the change on the branch's Vercel preview (it uses the live database).
6. Open a pull request against `translator`.

## Commit messages

- A short imperative sentence describing the visible change, with the ticket in parentheses.
- Examples from the history:
  - `Add the admins table and is_admin() access check (CMS-02)`
  - `Publish and hide profiles, with publish-time checks (CMS-19, CMS-20)`
  - `Add Translator docs README (TR-01)`
- No em-dashes.

## Pull requests

- Base branch: `translator`. Never `main` or `dev`.
- Include `Closes #<issue>` in the description so the issue closes on merge.
- Say what changed, why, and how it was checked.
- All checks pass (below).
- One issue per pull request.

### Code review

The repository has no formal review rules (no CODEOWNERS, no branch protection in the repo, no CI). Current practice from the TR ticket instructions: the author opens the pull request and the project lead reviews and merges it; authors don't merge their own. **Unverified** whether branch protection is configured on GitHub.

Reviewers check at least:

- The change matches the issue's acceptance criteria and nothing more.
- Admin pages and actions call `requireAdmin()` first; admin code uses the server client.
- Translator code keeps data in the browser and React out of the pure modules.
- No secrets, no real Data Axle data, no em-dashes in copy.

## Testing

Run before every commit and pull request:

```bash
npm run typecheck
npm run lint
npm run build
npm run test      # once TR-29 adds Vitest; the script does not exist yet
```

- There are no automated tests yet and no CI. Today every change is also checked by hand on the preview.
- Translator tests must lock in the expected results in [translator/README.md](translator/README.md#expected-results) and [../CLAUDE.md](../CLAUDE.md).
- `npm run build` needs the Supabase variables (see [TROUBLESHOOTING.md](TROUBLESHOOTING.md#local-development)).

## Deploying

Merging to `translator` updates its preview. Releasing to production means merging into `main`, which deploys immediately. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Database changes

New migration file, never edit an applied one, apply before deploying code that uses it. Full procedure: [guides/DATABASE-MIGRATIONS.md](guides/DATABASE-MIGRATIONS.md).

## Rules

1. Never push to `main`.
2. `/BI101` is printed on flyers. Never rename or remove it.
3. No em-dashes in site copy.
4. No new paid services. Ask before adding a dependency.
5. Never commit secrets. Never prefix the service-role key with `NEXT_PUBLIC_`.
6. Every admin page and admin action calls `await requireAdmin()` first.
7. Translator: synthetic data only; processing only in the browser; one `SearchBrief`; deterministic ranking; no React outside `ui/`.
8. Remember that local and preview environments write to the production database.
9. User messages are plain language: say what went wrong and how to fix it.

## Checklist for a change

- New admin page or action: `requireAdmin()` first.
- New table: RLS on, policies, explicit grants.
- New profile field: every file in [the recipe](ARCHITECTURE.md#recipe-add-a-field-to-profiles).
- New admin module: sidebar entry in `src/components/admin/modules.ts`.
- New public page: add it to `src/app/sitemap.ts`.
- New gated or redirected URL: add it to the `proxy.ts` matcher.
- New variable: `.env.example`, Vercel Production and Preview, [guides/ENVIRONMENT-CONFIGURATION.md](guides/ENVIRONMENT-CONFIGURATION.md).
- Behaviour change: update the owning document (see [README.md](README.md#keeping-these-documents-current)).
