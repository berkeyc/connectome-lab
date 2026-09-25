-- Accounts for Connectome Lab: profiles, saved training runs and community
-- experiments. Every table has row level security; the browser only ever
-- holds the public anon key.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by everyone"
  on public.profiles for select using (true);
create policy "users edit their own profile"
  on public.profiles for update using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- create a profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(split_part(coalesce(new.email, 'user'), '@', 1), 60));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Training runs: the readout, optimiser state and learning curve of one run.

create table if not exists public.training_runs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id text not null check (char_length(task_id) <= 80),
  variant text not null check (variant in ('real', 'degree', 'random', 'silenced')),
  name text not null default '' check (char_length(name) <= 120),
  generations integer not null default 0 check (generations between 0 and 2000),
  held_out double precision,
  is_public boolean not null default false,
  payload jsonb not null check (pg_column_size(payload) < 400000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_runs_user_task on public.training_runs (user_id, task_id, updated_at desc);
create index if not exists training_runs_public on public.training_runs (task_id, held_out desc) where is_public;

alter table public.training_runs enable row level security;

create policy "read own or public runs"
  on public.training_runs for select using (is_public or (select auth.uid()) = user_id);
create policy "insert own runs"
  on public.training_runs for insert with check ((select auth.uid()) = user_id);
create policy "update own runs"
  on public.training_runs for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own runs"
  on public.training_runs for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Community experiments: declarative task specs (JSON only, never code).
-- New uploads are 'pending' until a maintainer publishes them with the
-- service role; users cannot publish their own.

create table if not exists public.community_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  summary text not null default '' check (char_length(summary) <= 600),
  spec jsonb not null check (pg_column_size(spec) < 20000),
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_experiments_published on public.community_experiments (created_at desc) where status = 'published';

alter table public.community_experiments enable row level security;

create policy "read published or own experiments"
  on public.community_experiments for select using (status = 'published' or (select auth.uid()) = user_id);
create policy "submit own experiments as pending"
  on public.community_experiments for insert with check ((select auth.uid()) = user_id and status = 'pending');
create policy "edit own pending experiments"
  on public.community_experiments for update
  using ((select auth.uid()) = user_id and status = 'pending')
  with check ((select auth.uid()) = user_id and status = 'pending');
create policy "delete own experiments"
  on public.community_experiments for delete using ((select auth.uid()) = user_id);

-- keep updated_at honest
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger training_runs_touch before update on public.training_runs
  for each row execute function public.touch_updated_at();
create trigger community_experiments_touch before update on public.community_experiments
  for each row execute function public.touch_updated_at();

create index if not exists community_experiments_user on public.community_experiments (user_id);

-- the signup trigger function must not be callable through the API
revoke execute on function public.handle_new_user() from anon, authenticated, public;
