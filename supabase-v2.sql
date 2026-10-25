-- Run this once, after supabase.sql. Adds the game leaderboard and the global bug counter.
-- Supabase: SQL Editor > New query > paste > Run.

-- Leaderboard
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 24),
  ms integer not null check (ms between 15000 and 3600000),
  created_at timestamptz not null default now()
);
alter table public.scores enable row level security;
create policy "scores are public to read" on public.scores for select to anon using (true);
create policy "anyone can submit a score" on public.scores for insert to anon with check (true);

-- Global counters
create table if not exists public.stats (
  id text primary key,
  value bigint not null default 0
);
alter table public.stats enable row level security;
create policy "stats are public to read" on public.stats for select to anon using (true);
insert into public.stats (id, value) values ('bugs_squashed', 0) on conflict (id) do nothing;

-- Visitors can only add 1 to the counter, never set it to anything else.
create or replace function public.squash_bug()
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.stats set value = value + 1 where id = 'bugs_squashed' returning value;
$$;
revoke all on function public.squash_bug() from public;
grant execute on function public.squash_bug() to anon;

-- Live updates
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.stats;
