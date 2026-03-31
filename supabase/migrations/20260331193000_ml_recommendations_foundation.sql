create extension if not exists vector;

alter table public.events
  drop constraint if exists events_event_type_check,
  add constraint events_event_type_check
    check (
      event_type in (
        'view',
        'click',
        'follow',
        'unfollow',
        'apply',
        'native_apply',
        'search',
        'filter',
        'recommendation_impression'
      )
    );

alter table public.clubs
  add column if not exists target_years text[] not null default '{}',
  add column if not exists embedding vector(384);

comment on column public.clubs.target_years is
  'Student years this club most actively recruits. Uses the same labels as profiles.year.';

comment on column public.clubs.embedding is
  '384-dimensional recommendation embedding generated from public club metadata.';

create index if not exists clubs_target_years_gin_idx
  on public.clubs using gin (target_years);

create index if not exists clubs_embedding_hnsw_idx
  on public.clubs using hnsw (embedding vector_cosine_ops);

revoke select (embedding) on public.clubs from anon, authenticated;

create table if not exists public.user_recommendation_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  embedding vector(384),
  profile_embedding vector(384),
  behavior_embedding vector(384),
  interaction_weight_total numeric not null default 0,
  strategy text not null default 'fallback_popular',
  computed_at timestamptz not null default timezone('utc', now()),
  last_event_at timestamptz
);

create index if not exists user_recommendation_profiles_computed_at_idx
  on public.user_recommendation_profiles (computed_at desc);

create table if not exists public.club_recommendation_stats (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  views_30d integer not null default 0,
  clicks_30d integer not null default 0,
  follows_30d integer not null default 0,
  applications_30d integer not null default 0,
  native_applications_30d integer not null default 0,
  next_deadline_at timestamptz,
  active_deadline_count integer not null default 0,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists club_recommendation_stats_updated_at_idx
  on public.club_recommendation_stats (updated_at desc);

create table if not exists public.ml_model_versions (
  version text primary key,
  embedding_model text not null,
  ranker_version text not null,
  training_window_start timestamptz not null,
  training_window_end timestamptz not null,
  status text not null default 'draft',
  artifact_manifest_url text not null,
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  activated_at timestamptz,
  check (status in ('draft', 'training', 'ready', 'active', 'failed', 'archived'))
);

create unique index if not exists ml_model_versions_active_uidx
  on public.ml_model_versions (status)
  where status = 'active';

alter table public.user_recommendation_profiles enable row level security;
alter table public.club_recommendation_stats enable row level security;
alter table public.ml_model_versions enable row level security;

drop policy if exists "Users can view their own recommendation profile" on public.user_recommendation_profiles;
create policy "Users can view their own recommendation profile"
on public.user_recommendation_profiles
for select
using (auth.uid() = user_id);

create or replace function public.refresh_club_recommendation_stats()
returns bigint
language sql
security definer
set search_path = public
as $$
  with event_counts as (
    select
      club_id,
      count(*) filter (
        where event_type = 'view' and created_at >= timezone('utc', now()) - interval '30 days'
      )::integer as views_30d,
      count(*) filter (
        where event_type = 'click' and created_at >= timezone('utc', now()) - interval '30 days'
      )::integer as clicks_30d,
      count(*) filter (
        where event_type = 'follow' and created_at >= timezone('utc', now()) - interval '30 days'
      )::integer as follows_30d
    from public.events
    where club_id is not null
      and created_at >= timezone('utc', now()) - interval '30 days'
    group by club_id
  ),
  application_counts as (
    select
      club_id,
      count(*) filter (
        where applied_at is not null
          and applied_at >= timezone('utc', now()) - interval '30 days'
      )::integer as applications_30d,
      count(*) filter (
        where applied_at is not null
          and applied_at >= timezone('utc', now()) - interval '30 days'
          and application_source = 'native'
      )::integer as native_applications_30d
    from public.user_applications
    group by club_id
  ),
  deadline_counts as (
    select
      club_id,
      min(deadline_at) filter (
        where is_active and deadline_at >= timezone('utc', now())
      ) as next_deadline_at,
      count(*) filter (
        where is_active and deadline_at >= timezone('utc', now())
      )::integer as active_deadline_count
    from public.club_deadlines
    group by club_id
  ),
  prepared as (
    select
      c.id as club_id,
      coalesce(e.views_30d, 0) as views_30d,
      coalesce(e.clicks_30d, 0) as clicks_30d,
      coalesce(e.follows_30d, 0) as follows_30d,
      coalesce(a.applications_30d, 0) as applications_30d,
      coalesce(a.native_applications_30d, 0) as native_applications_30d,
      d.next_deadline_at,
      coalesce(d.active_deadline_count, 0) as active_deadline_count,
      timezone('utc', now()) as updated_at
    from public.clubs c
    left join event_counts e on e.club_id = c.id
    left join application_counts a on a.club_id = c.id
    left join deadline_counts d on d.club_id = c.id
  ),
  upserted as (
    insert into public.club_recommendation_stats (
      club_id,
      views_30d,
      clicks_30d,
      follows_30d,
      applications_30d,
      native_applications_30d,
      next_deadline_at,
      active_deadline_count,
      updated_at
    )
    select
      club_id,
      views_30d,
      clicks_30d,
      follows_30d,
      applications_30d,
      native_applications_30d,
      next_deadline_at,
      active_deadline_count,
      updated_at
    from prepared
    on conflict (club_id) do update
    set
      views_30d = excluded.views_30d,
      clicks_30d = excluded.clicks_30d,
      follows_30d = excluded.follows_30d,
      applications_30d = excluded.applications_30d,
      native_applications_30d = excluded.native_applications_30d,
      next_deadline_at = excluded.next_deadline_at,
      active_deadline_count = excluded.active_deadline_count,
      updated_at = excluded.updated_at
    returning 1
  )
  select count(*) from upserted;
$$;

create or replace function public.match_clubs_by_embedding(
  query_embedding_text text,
  match_count integer default 50,
  excluded_club_ids uuid[] default '{}'
)
returns table (
  club_id uuid,
  similarity double precision
)
language sql
security definer
set search_path = public
as $$
  select
    c.id as club_id,
    1 - (c.embedding <=> query_embedding_text::vector(384)) as similarity
  from public.clubs c
  where c.embedding is not null
    and c.recruiting_status in ('open', 'rolling', 'unknown')
    and not (c.id = any(coalesce(excluded_club_ids, '{}'::uuid[])))
  order by c.embedding <=> query_embedding_text::vector(384)
  limit greatest(1, least(match_count, 200));
$$;

create or replace function public.get_popular_recommendation_clubs(
  p_user_id uuid,
  p_limit integer default 20
)
returns table (
  club_id uuid,
  popularity_score double precision,
  reason_code text
)
language sql
security definer
set search_path = public
as $$
  with excluded as (
    select ua.club_id
    from public.user_applications ua
    where ua.user_id = p_user_id
      and ua.status in ('applied', 'interview', 'decision')
  ),
  recent_events as (
    select
      e.club_id,
      count(*) filter (
        where e.event_type = 'click'
          and e.created_at >= timezone('utc', now()) - interval '30 days'
      )::integer as clicks_30d,
      count(*) filter (
        where e.event_type = 'follow'
          and e.created_at >= timezone('utc', now()) - interval '30 days'
      )::integer as follows_30d
    from public.events e
    where e.club_id is not null
      and e.created_at >= timezone('utc', now()) - interval '30 days'
    group by e.club_id
  ),
  recent_applications as (
    select
      ua.club_id,
      count(*) filter (
        where ua.applied_at is not null
          and ua.applied_at >= timezone('utc', now()) - interval '30 days'
      )::integer as applications_30d,
      count(*) filter (
        where ua.applied_at is not null
          and ua.applied_at >= timezone('utc', now()) - interval '30 days'
          and ua.application_source = 'native'
      )::integer as native_applications_30d
    from public.user_applications ua
    group by ua.club_id
  ),
  deadlines as (
    select
      d.club_id,
      min(d.deadline_at) filter (
        where d.is_active and d.deadline_at >= timezone('utc', now())
      ) as next_deadline_at
    from public.club_deadlines d
    group by d.club_id
  )
  select
    c.id as club_id,
    (
      coalesce(ev.clicks_30d, 0) * 1.5
      + coalesce(ev.follows_30d, 0) * 2
      + coalesce(apps.applications_30d, 0) * 3
      + coalesce(apps.native_applications_30d, 0) * 4
      + case
          when dl.next_deadline_at is not null
            and dl.next_deadline_at <= timezone('utc', now()) + interval '3 days'
            then 2.5
          when dl.next_deadline_at is not null
            and dl.next_deadline_at <= timezone('utc', now()) + interval '7 days'
            then 1.5
          else 0
        end
      + case when c.verified then 0.5 else 0 end
    )::double precision as popularity_score,
    case
      when dl.next_deadline_at is not null
        and dl.next_deadline_at <= timezone('utc', now()) + interval '7 days'
        then 'deadline_urgent'
      when c.verified then 'verified_popular'
      else 'popular_on_rush'
    end as reason_code
  from public.clubs c
  left join recent_events ev on ev.club_id = c.id
  left join recent_applications apps on apps.club_id = c.id
  left join deadlines dl on dl.club_id = c.id
  where c.recruiting_status in ('open', 'rolling', 'unknown')
    and not exists (
      select 1
      from excluded ex
      where ex.club_id = c.id
    )
  order by popularity_score desc, c.name asc
  limit greatest(1, least(p_limit, 50));
$$;

revoke all on function public.refresh_club_recommendation_stats() from public;
revoke all on function public.match_clubs_by_embedding(text, integer, uuid[]) from public;
revoke all on function public.get_popular_recommendation_clubs(uuid, integer) from public;

grant execute on function public.refresh_club_recommendation_stats() to service_role;
grant execute on function public.match_clubs_by_embedding(text, integer, uuid[]) to service_role;
grant execute on function public.get_popular_recommendation_clubs(uuid, integer) to service_role;
