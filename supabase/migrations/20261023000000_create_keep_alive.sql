-- One row per keep-alive run (/api/cron/keep-alive), so every daily ping is a
-- real write and leaves a dated record. Rows older than 30 days are pruned by the route.
create table if not exists public.keep_alive (
  id bigint generated always as identity primary key,
  source text not null default 'vercel-cron',
  pinged_at timestamptz not null default now()
);

alter table public.keep_alive enable row level security;
-- No public policies: only the server (service role key) reads or writes.

-- From Oct 30, 2026 Supabase no longer grants Data API access to new tables
-- automatically, so grant the server role explicitly. anon/authenticated get nothing.
grant select, insert, delete on public.keep_alive to service_role;
