-- Run this once, after supabase-v2.sql. Lets the leaderboard hold scores for all three arcade games.
-- Supabase: SQL Editor > New query > paste > Run.

alter table public.scores add column if not exists game text not null default 'maze';
alter table public.scores add column if not exists points integer;
alter table public.scores alter column ms drop not null;

alter table public.scores drop constraint if exists scores_game_check;
alter table public.scores add constraint scores_game_check
  check (game in ('maze', 'facts', 'inject'));

alter table public.scores drop constraint if exists scores_points_check;
alter table public.scores add constraint scores_points_check
  check (points is null or points between 0 and 5000);

-- Maze scores are times, the other games are points.
alter table public.scores drop constraint if exists scores_value_check;
alter table public.scores add constraint scores_value_check
  check ((game = 'maze' and ms is not null) or (game <> 'maze' and points is not null));

create index if not exists scores_game_idx on public.scores (game);
