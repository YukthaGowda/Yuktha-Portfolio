-- Leaderboard (all three arcade games) and global bug counter.
-- Safe to run more than once. Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 24),
  game text not null default 'maze' check (game in ('maze', 'facts', 'inject')),
  ms integer check (ms is null or ms between 15000 and 3600000),
  points integer check (points is null or points between 0 and 5000),
  created_at timestamptz not null default now(),
  constraint scores_value_check check (
    (game = 'maze' and ms is not null) or (game <> 'maze' and points is not null)
  )
);
alter table public.scores enable row level security;
drop policy if exists "scores are public to read" on public.scores;
create policy "scores are public to read" on public.scores for select to anon using (true);
drop policy if exists "anyone can submit a score" on public.scores;
create policy "anyone can submit a score" on public.scores for insert to anon with check (true);
create index if not exists scores_game_idx on public.scores (game);

create table if not exists public.stats (id text primary key, value bigint not null default 0);
alter table public.stats enable row level security;
drop policy if exists "stats are public to read" on public.stats;
create policy "stats are public to read" on public.stats for select to anon using (true);
insert into public.stats (id, value) values ('bugs_squashed', 0) on conflict (id) do nothing;

create or replace function public.squash_bug()
returns bigint language sql security definer set search_path = public
as $$ update public.stats set value = value + 1 where id = 'bugs_squashed' returning value; $$;
revoke all on function public.squash_bug() from public;
grant execute on function public.squash_bug() to anon;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'scores') then
    alter publication supabase_realtime add table public.scores;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'stats') then
    alter publication supabase_realtime add table public.stats;
  end if;
end $$;
