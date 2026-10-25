-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists public.guestbook (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  message text check (char_length(message) <= 140),
  drawing text not null check (drawing like 'data:image/%' and char_length(drawing) < 250000),
  created_at timestamptz not null default now()
);

alter table public.guestbook enable row level security;

-- Anyone can read the wall.
create policy "guestbook is public to read"
  on public.guestbook for select
  to anon using (true);

-- Anyone can add a drawing, but nobody can edit or delete through the site.
-- You can still delete entries yourself from the Supabase dashboard.
create policy "anyone can post to guestbook"
  on public.guestbook for insert
  to anon with check (true);

-- Send new drawings to everyone's screen in real time.
alter publication supabase_realtime add table public.guestbook;
