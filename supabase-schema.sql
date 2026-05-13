create table if not exists public.snake_scores (
  username text primary key,
  score integer not null default 0,
  difficulty text not null default 'normal',
  mode text not null default 'wall',
  updated_at timestamptz not null default now()
);

alter table public.snake_scores enable row level security;

grant select, insert, update on table public.snake_scores to anon;

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
