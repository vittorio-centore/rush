-- Pre-ML hardening:
-- 1) Secure reviewer assignments against cross-club and non-member assignment.
-- 2) Add durable reminder-send idempotency and a due-reminders SQL helper.

create unique index if not exists user_applications_club_id_id_uidx
  on public.user_applications (club_id, id);

delete from public.club_reviewer_assignments cra
where not exists (
  select 1
  from public.user_applications ua
  where ua.id = cra.application_id
    and ua.club_id = cra.club_id
)
or not exists (
  select 1
  from public.club_admin_memberships cam
  where cam.club_id = cra.club_id
    and cam.user_id = cra.reviewer_user_id
    and cam.role in ('admin', 'reviewer')
);

delete from public.club_application_submissions cas
where not exists (
  select 1
  from public.user_applications ua
  where ua.id = cas.application_id
    and ua.club_id = cas.club_id
);

delete from public.club_application_reviews car
where not exists (
  select 1
  from public.user_applications ua
  where ua.id = car.application_id
    and ua.club_id = car.club_id
);

alter table public.club_reviewer_assignments
  drop constraint if exists club_reviewer_assignments_application_id_fkey;

alter table public.club_reviewer_assignments
  add constraint club_reviewer_assignments_application_fk
  foreign key (club_id, application_id)
  references public.user_applications (club_id, id)
  on delete cascade;

alter table public.club_application_submissions
  drop constraint if exists club_application_submissions_application_id_fkey;

alter table public.club_application_submissions
  add constraint club_application_submissions_application_fk
  foreign key (club_id, application_id)
  references public.user_applications (club_id, id)
  on delete cascade;

alter table public.club_application_reviews
  drop constraint if exists club_application_reviews_application_id_fkey;

alter table public.club_application_reviews
  add constraint club_application_reviews_application_fk
  foreign key (club_id, application_id)
  references public.user_applications (club_id, id)
  on delete cascade;

alter table public.club_reviewer_assignments
  add constraint club_reviewer_assignments_reviewer_membership_fk
  foreign key (club_id, reviewer_user_id)
  references public.club_admin_memberships (club_id, user_id)
  on delete cascade;

drop policy if exists "Admins can manage reviewer assignments"
  on public.club_reviewer_assignments;
drop policy if exists "Admins can view reviewer assignments"
  on public.club_reviewer_assignments;
drop policy if exists "Admins can insert reviewer assignments"
  on public.club_reviewer_assignments;
drop policy if exists "Admins can update reviewer assignments"
  on public.club_reviewer_assignments;
drop policy if exists "Admins can delete reviewer assignments"
  on public.club_reviewer_assignments;

create policy "Admins can view reviewer assignments"
on public.club_reviewer_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_reviewer_assignments.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Admins can insert reviewer assignments"
on public.club_reviewer_assignments
for insert
to authenticated
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_reviewer_assignments.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
  and exists (
    select 1
    from public.club_admin_memberships target_member
    where target_member.club_id = public.club_reviewer_assignments.club_id
      and target_member.user_id = public.club_reviewer_assignments.reviewer_user_id
      and target_member.role in ('admin', 'reviewer')
  )
);

create policy "Admins can update reviewer assignments"
on public.club_reviewer_assignments
for update
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_reviewer_assignments.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_reviewer_assignments.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
  and exists (
    select 1
    from public.club_admin_memberships target_member
    where target_member.club_id = public.club_reviewer_assignments.club_id
      and target_member.user_id = public.club_reviewer_assignments.reviewer_user_id
      and target_member.role in ('admin', 'reviewer')
  )
);

create policy "Admins can delete reviewer assignments"
on public.club_reviewer_assignments
for delete
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_reviewer_assignments.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

drop policy if exists "Assigned reviewers can view their applications"
  on public.user_applications;
create policy "Assigned reviewers can view their applications"
on public.user_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.user_applications.id
      and cra.club_id = public.user_applications.club_id
      and cra.reviewer_user_id = auth.uid()
  )
);

drop policy if exists "Assigned reviewers can view submissions"
  on public.club_application_submissions;
create policy "Assigned reviewers can view submissions"
on public.club_application_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.club_application_submissions.application_id
      and cra.club_id = public.club_application_submissions.club_id
      and cra.reviewer_user_id = auth.uid()
  )
);

drop policy if exists "Assigned reviewers can view submission answers"
  on public.club_application_submission_answers;
create policy "Assigned reviewers can view submission answers"
on public.club_application_submission_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.club_application_submissions cas
    join public.club_reviewer_assignments cra
      on cra.application_id = cas.application_id
     and cra.club_id = cas.club_id
    where cas.id = public.club_application_submission_answers.submission_id
      and cra.reviewer_user_id = auth.uid()
  )
);

drop policy if exists "Assigned reviewers can view their application reviews"
  on public.club_application_reviews;
create policy "Assigned reviewers can view their application reviews"
on public.club_application_reviews
for select
to authenticated
using (
  reviewer_user_id = auth.uid()
  or exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.club_application_reviews.application_id
      and cra.club_id = public.club_application_reviews.club_id
      and cra.reviewer_user_id = auth.uid()
  )
);

drop policy if exists "Assigned reviewers can manage their reviews"
  on public.club_application_reviews;
create policy "Assigned reviewers can manage their reviews"
on public.club_application_reviews
for all
to authenticated
using (
  reviewer_user_id = auth.uid()
  and exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.club_application_reviews.application_id
      and cra.club_id = public.club_application_reviews.club_id
      and cra.reviewer_user_id = auth.uid()
  )
)
with check (
  reviewer_user_id = auth.uid()
  and exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.club_application_reviews.application_id
      and cra.club_id = public.club_application_reviews.club_id
      and cra.reviewer_user_id = auth.uid()
  )
);

create table if not exists public.deadline_reminder_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  deadline_id uuid not null references public.club_deadlines (id) on delete cascade,
  reminder_offset_days integer not null,
  sent_at timestamptz not null default timezone('utc', now()),
  check (reminder_offset_days in (1, 3, 7)),
  unique (user_id, deadline_id, reminder_offset_days)
);

create index if not exists deadline_reminder_sends_user_sent_idx
  on public.deadline_reminder_sends (user_id, sent_at desc);

create index if not exists deadline_reminder_sends_deadline_idx
  on public.deadline_reminder_sends (deadline_id);

alter table public.deadline_reminder_sends enable row level security;

create or replace function public.get_due_deadline_reminders(
  p_offsets integer[] default array[1, 3, 7]
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  deadline_id uuid,
  club_name text,
  club_slug text,
  deadline_title text,
  deadline_at timestamptz,
  reminder_offset_days integer
)
language sql
security definer
set search_path = public
as $$
  select
    uf.user_id,
    p.email,
    p.full_name,
    d.id as deadline_id,
    c.name as club_name,
    c.slug as club_slug,
    d.title as deadline_title,
    d.deadline_at,
    (
      date(d.deadline_at at time zone 'America/Detroit')
      - date(timezone('America/Detroit', now()))
    )::integer as reminder_offset_days
  from public.user_follows uf
  join public.profiles p
    on p.id = uf.user_id
  join public.clubs c
    on c.id = uf.club_id
  join public.club_deadlines d
    on d.club_id = uf.club_id
  where d.is_active = true
    and p.email is not null
    and (
      date(d.deadline_at at time zone 'America/Detroit')
      - date(timezone('America/Detroit', now()))
    ) = any (p_offsets)
  order by p.email, d.deadline_at asc;
$$;

revoke all on function public.get_due_deadline_reminders(integer[]) from public;
grant execute on function public.get_due_deadline_reminders(integer[]) to service_role;
