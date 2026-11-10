-- SysLab: server-verified scores. The leaderboard and public profiles count only results graded on the server
-- (POST /api/grade), so editing your own progress in the browser can't raise your rank.
-- Run once in the Supabase SQL editor after 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Verified scores: one row per user and problem, written only by the server.
-- ---------------------------------------------------------------------------
create table if not exists public.verified_scores (
  user_id uuid not null references auth.users (id) on delete cascade,
  problem_id text not null check (char_length(problem_id) <= 100),
  best_score int not null check (best_score between 0 and 100),
  passed boolean not null default false,
  attempts int not null default 1,
  first_passed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, problem_id)
);

alter table public.verified_scores enable row level security;

-- Users can read their own rows. There are deliberately no insert/update/delete policies:
-- only the server (service role, which bypasses row-level security) writes here.
drop policy if exists "verified_scores: owner reads" on public.verified_scores;
create policy "verified_scores: owner reads" on public.verified_scores
  for select using (auth.uid() = user_id);

-- Keep the best score, remember a pass forever, count attempts. Called by /api/grade only.
create or replace function public.record_verified_score(p_user uuid, p_problem text, p_score int, p_passed boolean)
returns void
language sql security definer set search_path = public as $$
  insert into public.verified_scores as v (user_id, problem_id, best_score, passed, first_passed_at)
  values (p_user, p_problem, least(greatest(p_score, 0), 100), p_passed, case when p_passed then now() end)
  on conflict (user_id, problem_id) do update set
    best_score = greatest(v.best_score, excluded.best_score),
    passed = v.passed or excluded.passed,
    first_passed_at = coalesce(v.first_passed_at, excluded.first_passed_at),
    attempts = v.attempts + 1,
    updated_at = now();
$$;

revoke all on function public.record_verified_score(uuid, text, int, boolean) from public, anon, authenticated;
grant execute on function public.record_verified_score(uuid, text, int, boolean) to service_role;

-- XP from verified results, using the app's rule: best score + 50 for a pass.
create or replace function public.verified_stats(p_user uuid)
returns table (xp int, solved int, solved_ids text[])
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(v.best_score + case when v.passed then 50 else 0 end), 0)::int,
    coalesce(count(*) filter (where v.passed), 0)::int,
    coalesce(array_agg(v.problem_id order by v.problem_id) filter (where v.passed), '{}')
  from public.verified_scores v
  where v.user_id = p_user
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard and public profiles now use verified XP and solves.
-- Active days (the streak) still come from the user's own activity log.
-- ---------------------------------------------------------------------------
create or replace function public.leaderboard(limit_count int default 50)
returns table (username text, display_name text, avatar_url text, xp int, solved int, active_days int)
language sql stable security definer set search_path = public as $$
  select pr.username, pr.display_name, pr.avatar_url, vs.xp, vs.solved, coalesce(s.active_days, 0)
  from public.profiles pr
  cross join lateral public.verified_stats(pr.id) vs
  left join public.user_data d on d.user_id = pr.id and d.key = 'progress'
  left join lateral public.progress_stats(d.value) s on true
  where pr.is_public and vs.xp > 0
  order by vs.xp desc, vs.solved desc, pr.created_at asc
  limit least(greatest(limit_count, 1), 200)
$$;

create or replace function public.public_profile(p_username text)
returns table (
  username text, display_name text, avatar_url text, created_at timestamptz,
  xp int, solved int, active_days int, solved_ids text[], days text[]
)
language sql stable security definer set search_path = public as $$
  select pr.username, pr.display_name, pr.avatar_url, pr.created_at,
    vs.xp, vs.solved, coalesce(s.active_days, 0), vs.solved_ids,
    coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(d.value -> 'activeDays', '[]'::jsonb)) x), '{}')
  from public.profiles pr
  cross join lateral public.verified_stats(pr.id) vs
  left join public.user_data d on d.user_id = pr.id and d.key = 'progress'
  left join lateral public.progress_stats(d.value) s on true
  where pr.username = lower(p_username) and pr.is_public
$$;

revoke all on function public.verified_stats(uuid) from public, anon, authenticated;
grant execute on function public.leaderboard(int) to anon, authenticated;
grant execute on function public.public_profile(text) to anon, authenticated;
