create table public.club_pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  key text not null,
  label text not null,
  status_bucket text not null,
  color_token text not null default 'slate',
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, key),
  unique (club_id, position),
  check (status_bucket in ('interested', 'applied', 'interview', 'decision')),
  check (color_token in ('slate', 'blue', 'amber', 'green', 'rose', 'violet'))
);

create table public.club_decision_labels (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  key text not null,
  label text not null,
  decision_status text not null,
  color_token text not null default 'slate',
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, key),
  unique (club_id, position),
  check (decision_status in ('pending', 'accepted', 'rejected', 'waitlisted')),
  check (color_token in ('slate', 'blue', 'amber', 'green', 'rose', 'violet'))
);

create table public.club_decision_settings (
  club_id uuid primary key references public.clubs (id) on delete cascade,
  target_acceptances integer not null default 0,
  waitlist_target integer not null default 0,
  weight_problem_solving numeric not null default 1,
  weight_coding_ability numeric not null default 1,
  weight_technical_knowledge numeric not null default 1,
  weight_communication numeric not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (target_acceptances >= 0),
  check (waitlist_target >= 0),
  check (weight_problem_solving > 0),
  check (weight_coding_ability > 0),
  check (weight_technical_knowledge > 0),
  check (weight_communication > 0)
);

create table public.club_saved_recruiter_views (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null,
  filters jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, name)
);

alter table public.user_applications
  add column if not exists stage_id uuid references public.club_pipeline_stages (id) on delete set null,
  add column if not exists decision_label_id uuid references public.club_decision_labels (id) on delete set null;

create index club_pipeline_stages_club_position_idx
  on public.club_pipeline_stages (club_id, position);
create index club_decision_labels_club_position_idx
  on public.club_decision_labels (club_id, position);
create index club_saved_recruiter_views_club_position_idx
  on public.club_saved_recruiter_views (club_id, position);
create index user_applications_stage_idx
  on public.user_applications (stage_id);
create index user_applications_decision_label_idx
  on public.user_applications (decision_label_id);

create trigger set_club_pipeline_stages_updated_at
before update on public.club_pipeline_stages
for each row
execute function public.set_updated_at();

create trigger set_club_decision_labels_updated_at
before update on public.club_decision_labels
for each row
execute function public.set_updated_at();

create trigger set_club_decision_settings_updated_at
before update on public.club_decision_settings
for each row
execute function public.set_updated_at();

create trigger set_club_saved_recruiter_views_updated_at
before update on public.club_saved_recruiter_views
for each row
execute function public.set_updated_at();

alter table public.club_pipeline_stages enable row level security;
alter table public.club_decision_labels enable row level security;
alter table public.club_decision_settings enable row level security;
alter table public.club_saved_recruiter_views enable row level security;

drop policy if exists "Club members can view pipeline stages" on public.club_pipeline_stages;
create policy "Club members can view pipeline stages"
on public.club_pipeline_stages
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_pipeline_stages.club_id
      and cam.user_id = auth.uid()
  )
);

drop policy if exists "Club admins can manage pipeline stages" on public.club_pipeline_stages;
create policy "Club admins can manage pipeline stages"
on public.club_pipeline_stages
for all
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_pipeline_stages.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_pipeline_stages.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

drop policy if exists "Club members can view decision labels" on public.club_decision_labels;
create policy "Club members can view decision labels"
on public.club_decision_labels
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_decision_labels.club_id
      and cam.user_id = auth.uid()
  )
);

drop policy if exists "Club admins can manage decision labels" on public.club_decision_labels;
create policy "Club admins can manage decision labels"
on public.club_decision_labels
for all
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_decision_labels.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_decision_labels.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

drop policy if exists "Club members can view decision settings" on public.club_decision_settings;
create policy "Club members can view decision settings"
on public.club_decision_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_decision_settings.club_id
      and cam.user_id = auth.uid()
  )
);

drop policy if exists "Club admins can manage decision settings" on public.club_decision_settings;
create policy "Club admins can manage decision settings"
on public.club_decision_settings
for all
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_decision_settings.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_decision_settings.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

drop policy if exists "Club members can view recruiter views" on public.club_saved_recruiter_views;
create policy "Club members can view recruiter views"
on public.club_saved_recruiter_views
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_saved_recruiter_views.club_id
      and cam.user_id = auth.uid()
  )
);

drop policy if exists "Club admins can manage recruiter views" on public.club_saved_recruiter_views;
create policy "Club admins can manage recruiter views"
on public.club_saved_recruiter_views
for all
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_saved_recruiter_views.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_saved_recruiter_views.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);
