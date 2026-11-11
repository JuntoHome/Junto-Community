# Database migrations

How to change the database schema safely. What the schema contains: [DATABASE.md](../DATABASE.md).

## Rules

1. Every change is a new file in [supabase/migrations/](../../supabase/migrations/). **Never edit a migration that has been applied.**
2. Name it `YYYYMMDDHHMMSS_what_it_does.sql`, for example `20261103010000_profiles_follow_paul_structure.sql`.
3. Make it safe to re-run: `create table if not exists`, `create or replace function`, `drop ... if exists` before `add constraint` or `create policy`.
4. Wrap multi-step changes in `begin; ... commit;` so a failure changes nothing.
5. Every new table gets RLS turned on, policies, and **explicit grants**. Supabase stopped granting API access to new tables automatically from Oct 30, 2026.
6. Admin-only rules use `(select private.is_admin())`, as the existing policies do.
7. If a change tightens a rule, check existing rows first and stop with a clear message.
8. Start the file with a comment: what it does, why, and which migration it must run after.

## Template

```sql
-- What this does and why (ticket).
-- Run after <previous migration>. All or nothing: if it stops, nothing changed.

begin;

create table if not exists public.things (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table public.things enable row level security;

grant select on public.things to authenticated;
grant select, insert, update, delete on public.things to service_role;

drop policy if exists "Admins can read things" on public.things;
create policy "Admins can read things" on public.things
  for select to authenticated
  using ((select private.is_admin()));

commit;
```

## Tightening a rule

Check before you constrain, as `20261103010000_profiles_follow_paul_structure.sql` does:

```sql
do $$
begin
  if exists (select 1 from public.profiles where status = 'published' and coalesce(btrim(history), '') = '') then
    raise exception 'Some published profiles have no Getting started text. Add it in the admin (or hide them), then run this again.';
  end if;
end;
$$;
```

## Applying a migration

There is no automated migration runner and no record of what has been applied.

1. Review the SQL in the pull request.
2. Apply it in Supabase → SQL Editor (paste and run), or with `supabase db push` if you use the CLI.
3. Check the result in Table Editor or with a query.
4. Note in the pull request that it has been applied.

Remember there is one Supabase project: applying a migration changes production immediately.

## Order relative to code

| Change | Order |
|---|---|
| Adds a table, column or function | Apply the migration **first**, then deploy the code that uses it |
| Removes or renames something | Deploy code that no longer uses it **first**, then apply the migration |
| Tightens a constraint | Fix existing rows, apply, then deploy code that enforces the same rule |

## Keeping code in step

A schema change usually means code changes too:

- Length limits and publish rules are duplicated in the feature's `schema.ts` (for profiles, also `PUBLISH_FIELDS`).
- Row types are hand-written; update `COLUMNS`, row types and mapping functions in `queries.ts`, `admin-queries.ts` and `repository.ts`.
- Profile column names differ from their labels ([DATABASE.md](../DATABASE.md#profiles)).
- Update [DATABASE.md](../DATABASE.md), including its migrations table.

## Rebuilding on a fresh project

Apply every file in filename order. Known caveat: `20260926000000_create_subscribers.sql` has no explicit grants and may need `grant select, insert on public.subscribers to service_role;` on a project created after Oct 30, 2026. Then add an admin ([ADMIN-OPERATIONS.md](ADMIN-OPERATIONS.md#add-an-admin)) and paste the email templates. There is no seed data.
