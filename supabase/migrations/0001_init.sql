-- SysLab: per-user storage, public profiles, leaderboard and shareable designs.
-- Run once in the Supabase SQL editor (or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Profiles: one per auth user, created automatically on sign-up.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: public read" on public.profiles;
create policy "profiles: public read" on public.profiles
  for select using (is_public or auth.uid() = id);

drop policy if exists "profiles: owner update" on public.profiles;
create policy "profiles: owner update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Username from metadata or the email prefix, made unique with a short suffix if needed.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'user_name', split_part(new.email, '@', 1), 'user'), '[^a-z0-9_]', '', 'g'));
  candidate text;
begin
  if char_length(base) < 3 then base := base || 'user'; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    candidate,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', candidate), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- User data: the app's key-value store (designs, progress, drafts), private to each user.
-- ---------------------------------------------------------------------------
create table if not exists public.user_data (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) <= 200),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_data enable row level security;

drop policy if exists "user_data: owner all" on public.user_data;
create policy "user_data: owner all" on public.user_data
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Shared designs: read-only snapshots anyone with the link can open.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_designs (
  id text primary key default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  design jsonb not null,
  challenge_id text,
  created_at timestamptz not null default now()
);

alter table public.shared_designs enable row level security;

drop policy if exists "shared_designs: anyone reads" on public.shared_designs;
create policy "shared_designs: anyone reads" on public.shared_designs for select using (true);

drop policy if exists "shared_designs: owner writes" on public.shared_designs;
create policy "shared_designs: owner writes" on public.shared_designs
  for insert with check (auth.uid() = owner_id);

drop policy if exists "shared_designs: owner deletes" on public.shared_designs;
create policy "shared_designs: owner deletes" on public.shared_designs
  for delete using (auth.uid() = owner_id);

-- ---------------------------------------------------------------------------
-- Public stats: computed from each public user's progress, exposing only totals.
-- These functions run as their owner so they can read progress rows, and return nothing private.
-- ---------------------------------------------------------------------------
create or replace function public.progress_stats(p jsonb)
returns table (xp int, solved int, active_days int)
language sql immutable as $$
  select
    coalesce((p ->> 'xp')::int, 0),
    coalesce((select count(*)::int from jsonb_each(coalesce(p -> 'challenges', '{}'::jsonb)) c where (c.value ->> 'passed')::boolean), 0),
    coalesce(jsonb_array_length(coalesce(p -> 'activeDays', '[]'::jsonb)), 0)
$$;

create or replace function public.leaderboard(limit_count int default 50)
returns table (username text, display_name text, avatar_url text, xp int, solved int, active_days int)
language sql stable security definer set search_path = public as $$
  select pr.username, pr.display_name, pr.avatar_url, s.xp, s.solved, s.active_days
  from public.profiles pr
  join public.user_data d on d.user_id = pr.id and d.key = 'progress'
  cross join lateral public.progress_stats(d.value) s
  where pr.is_public and s.xp > 0
  order by s.xp desc, s.solved desc, pr.created_at asc
  limit least(greatest(limit_count, 1), 200)
$$;

create or replace function public.public_profile(p_username text)
returns table (
  username text, display_name text, avatar_url text, created_at timestamptz,
  xp int, solved int, active_days int, solved_ids text[], days text[]
)
language sql stable security definer set search_path = public as $$
  select pr.username, pr.display_name, pr.avatar_url, pr.created_at,
    coalesce(s.xp, 0), coalesce(s.solved, 0), coalesce(s.active_days, 0),
    coalesce((select array_agg(c.key order by c.key) from jsonb_each(coalesce(d.value -> 'challenges', '{}'::jsonb)) c where (c.value ->> 'passed')::boolean), '{}'),
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(d.value -> 'activeDays', '[]'::jsonb)) x), '{}')
  from public.profiles pr
  left join public.user_data d on d.user_id = pr.id and d.key = 'progress'
  left join lateral public.progress_stats(d.value) s on true
  where pr.username = lower(p_username) and pr.is_public
$$;

grant execute on function public.leaderboard(int) to anon, authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;
