-- Phase 2: Application Pipeline & Notifications
-- Plan 01: Stage transition audit log + is_released column
--
-- Adds:
--   1. is_released boolean column on club_pipeline_stages (D-05)
--   2. club_application_stage_transitions append-only audit table (D-01, D-02)
--   3. Indexes for efficient audit queries
--   4. RLS policies (2 SELECT + 1 INSERT; no UPDATE or DELETE by design)

-- 1. Add is_released column to club_pipeline_stages
alter table public.club_pipeline_stages
  add column if not exists is_released boolean not null default false;

-- 2. Create append-only audit table for stage transitions
create table public.club_application_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.user_applications (id) on delete cascade,
  from_stage_id uuid references public.club_pipeline_stages (id) on delete set null,
  to_stage_id uuid references public.club_pipeline_stages (id) on delete set null,
  changed_by_user_id uuid not null references auth.users (id) on delete cascade,
  changed_at timestamptz not null default timezone('utc', now()),
  notes text
  -- No updated_at column: this table is append-only per D-01
);

-- 3. Indexes for common query patterns
create index club_application_stage_transitions_application_idx
  on public.club_application_stage_transitions (application_id, changed_at desc);

create index club_application_stage_transitions_to_stage_idx
  on public.club_application_stage_transitions (to_stage_id);

-- 4. Enable RLS (no UPDATE or DELETE policies — Postgres blocks those by default)
alter table public.club_application_stage_transitions enable row level security;

-- Policy 1: Club officers can view stage transitions for their club's applications
create policy "Club officers can view stage transitions"
on public.club_application_stage_transitions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_applications ua
    join public.club_admin_memberships cam on cam.club_id = ua.club_id
    where ua.id = public.club_application_stage_transitions.application_id
      and cam.user_id = auth.uid()
  )
);

-- Policy 2: Club admins can insert stage transitions (role = 'admin' required)
create policy "Club admins can insert stage transitions"
on public.club_application_stage_transitions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_applications ua
    join public.club_admin_memberships cam on cam.club_id = ua.club_id
    where ua.id = public.club_application_stage_transitions.application_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

-- Policy 3: Students can view their own stage transitions (needed for released-stage logic in PIPE-03)
create policy "Students can view their own stage transitions"
on public.club_application_stage_transitions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_applications ua
    where ua.id = public.club_application_stage_transitions.application_id
      and ua.user_id = auth.uid()
  )
);

-- 5. Document the append-only invariant
comment on table public.club_application_stage_transitions is 'Append-only audit log. No UPDATE or DELETE RLS policies exist by design.';
