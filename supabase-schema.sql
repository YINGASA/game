create table if not exists public.snake_profiles (
  player_id text primary key,
  username text not null unique,
  username_changed_on date,
  updated_at timestamptz not null default now()
);

create table if not exists public.snake_scores (
  player_id text,
  username text not null,
  score integer not null default 0,
  difficulty text not null default 'normal',
  mode text not null default 'wall',
  updated_at timestamptz not null default now()
);

alter table public.snake_scores add column if not exists player_id text;
alter table public.snake_scores add column if not exists difficulty text not null default 'normal';
alter table public.snake_scores add column if not exists mode text not null default 'wall';
alter table public.snake_scores add column if not exists updated_at timestamptz not null default now();

update public.snake_scores
set player_id = username
where player_id is null;

alter table public.snake_scores alter column player_id set not null;

alter table public.snake_scores drop constraint if exists snake_scores_pkey;
alter table public.snake_scores
  add constraint snake_scores_pkey primary key (player_id, difficulty, mode);

create index if not exists snake_scores_scope_rank_idx
on public.snake_scores (difficulty, mode, score desc);

alter table public.snake_profiles enable row level security;
alter table public.snake_scores enable row level security;

grant select, insert, update on table public.snake_profiles to anon;
grant select, insert, update on table public.snake_scores to anon;

drop policy if exists "Anyone can read snake profiles" on public.snake_profiles;
drop policy if exists "Anyone can create snake profiles" on public.snake_profiles;
drop policy if exists "Anyone can update snake profiles" on public.snake_profiles;
drop policy if exists "Anyone can read snake scores" on public.snake_scores;
drop policy if exists "Anyone can submit snake scores" on public.snake_scores;
drop policy if exists "Anyone can update snake scores" on public.snake_scores;

create policy "Anyone can read snake profiles"
on public.snake_profiles
for select
to anon
using (true);

create policy "Anyone can create snake profiles"
on public.snake_profiles
for insert
to anon
with check (char_length(username) between 1 and 16);

create policy "Anyone can update snake profiles"
on public.snake_profiles
for update
to anon
using (true)
with check (char_length(username) between 1 and 16);

create policy "Anyone can read snake scores"
on public.snake_scores
for select
to anon
using (true);

create policy "Anyone can submit snake scores"
on public.snake_scores
for insert
to anon
with check (char_length(username) between 1 and 16 and score >= 0);

create policy "Anyone can update snake scores"
on public.snake_scores
for update
to anon
using (true)
with check (char_length(username) between 1 and 16 and score >= 0);
