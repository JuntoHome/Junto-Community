-- "Join the Junto" subscribers (docs/BUILD_SPEC.md section 8).
create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (char_length(first_name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  zip text not null check (zip ~ '^[0-9]{5}$'),
  source text default 'website',
  created_at timestamptz not null default now()
);

create unique index if not exists subscribers_email_key on public.subscribers (lower(email));

alter table public.subscribers enable row level security;
-- No public policies: all writes go through the server with the service role key.
