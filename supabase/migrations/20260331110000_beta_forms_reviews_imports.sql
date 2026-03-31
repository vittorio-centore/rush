alter table public.club_deadlines
  add column updated_at timestamptz not null default timezone('utc', now());

create trigger set_club_deadlines_updated_at
before update on public.club_deadlines
for each row
execute function public.set_updated_at();

alter table public.user_applications
  alter column user_id drop not null;

alter table public.user_applications
  add column application_source text not null default 'tracked',
  add column external_full_name text,
  add column external_email text,
  add column external_year text,
  add column external_major text;

alter table public.user_applications
  drop constraint if exists user_applications_status_check,
  drop constraint if exists user_applications_decision_status_check,
  add constraint user_applications_status_check
    check (status in ('interested', 'applied', 'interview', 'decision')),
  add constraint user_applications_decision_status_check
    check (decision_status in ('pending', 'accepted', 'rejected', 'waitlisted')),
  add constraint user_applications_source_check
    check (application_source in ('tracked', 'native', 'external_csv'));

create unique index if not exists user_applications_external_email_idx
  on public.user_applications (club_id, lower(external_email))
  where user_id is null and external_email is not null;

alter table public.events
  drop constraint if exists events_event_type_check,
  add constraint events_event_type_check
    check (event_type in ('view', 'click', 'follow', 'unfollow', 'apply', 'native_apply', 'search', 'filter'));

create table public.club_application_forms (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null unique references public.clubs (id) on delete cascade,
  title text not null default 'Application form',
  description text,
  submit_button_text text not null default 'Submit application',
  status text not null default 'draft',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (status in ('draft', 'published'))
);

create table public.club_application_form_sections (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.club_application_forms (id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.club_application_form_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.club_application_form_sections (id) on delete cascade,
  type text not null,
  label text not null,
  help_text text,
  placeholder text,
  is_required boolean not null default false,
  position integer not null default 0,
  condition_question_id uuid references public.club_application_form_questions (id) on delete set null,
  condition_operator text,
  condition_value text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (type in ('short_text', 'long_text', 'single_select', 'multi_select')),
  check (
    condition_operator is null
    or condition_operator in ('equals', 'not_equals', 'includes', 'not_includes')
  )
);

create table public.club_application_form_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.club_application_form_questions (id) on delete cascade,
  label text not null,
  value text not null,
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.club_application_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.club_application_forms (id) on delete cascade,
  club_id uuid not null references public.clubs (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  application_id uuid not null unique references public.user_applications (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (club_id, user_id)
);

create table public.club_application_submission_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.club_application_submissions (id) on delete cascade,
  question_id uuid not null references public.club_application_form_questions (id) on delete cascade,
  answer_text text,
  answer_values text[] not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (submission_id, question_id)
);

create table public.club_application_import_batches (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  file_name text not null,
  status text not null default 'processing',
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_rows integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  check (status in ('processing', 'completed', 'failed'))
);

create table public.club_reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  application_id uuid not null references public.user_applications (id) on delete cascade,
  reviewer_user_id uuid not null references auth.users (id) on delete cascade,
  assigned_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (application_id, reviewer_user_id)
);

create table public.club_application_reviews (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs (id) on delete cascade,
  application_id uuid not null references public.user_applications (id) on delete cascade,
  reviewer_user_id uuid not null references auth.users (id) on delete cascade,
  problem_solving integer not null,
  coding_ability integer not null,
  technical_knowledge integer not null,
  communication integer not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (application_id, reviewer_user_id),
  check (problem_solving between 1 and 10),
  check (coding_ability between 1 and 10),
  check (technical_knowledge between 1 and 10),
  check (communication between 1 and 10)
);

create index club_application_form_sections_form_position_idx
  on public.club_application_form_sections (form_id, position);
create index club_application_form_questions_section_position_idx
  on public.club_application_form_questions (section_id, position);
create index club_application_form_questions_condition_idx
  on public.club_application_form_questions (condition_question_id);
create index club_application_form_options_question_position_idx
  on public.club_application_form_options (question_id, position);
create index club_application_submissions_application_idx
  on public.club_application_submissions (application_id);
create index club_application_submission_answers_submission_idx
  on public.club_application_submission_answers (submission_id);
create index club_application_import_batches_club_created_idx
  on public.club_application_import_batches (club_id, created_at desc);
create index club_reviewer_assignments_reviewer_idx
  on public.club_reviewer_assignments (reviewer_user_id, created_at desc);
create index club_reviewer_assignments_club_application_idx
  on public.club_reviewer_assignments (club_id, application_id);
create index club_application_reviews_application_idx
  on public.club_application_reviews (application_id);
create index club_application_reviews_reviewer_idx
  on public.club_application_reviews (reviewer_user_id);

create trigger set_club_application_forms_updated_at
before update on public.club_application_forms
for each row
execute function public.set_updated_at();

create trigger set_club_application_form_sections_updated_at
before update on public.club_application_form_sections
for each row
execute function public.set_updated_at();

create trigger set_club_application_form_questions_updated_at
before update on public.club_application_form_questions
for each row
execute function public.set_updated_at();

create trigger set_club_application_form_options_updated_at
before update on public.club_application_form_options
for each row
execute function public.set_updated_at();

create trigger set_club_application_submissions_updated_at
before update on public.club_application_submissions
for each row
execute function public.set_updated_at();

create trigger set_club_application_submission_answers_updated_at
before update on public.club_application_submission_answers
for each row
execute function public.set_updated_at();

create trigger set_club_application_import_batches_updated_at
before update on public.club_application_import_batches
for each row
execute function public.set_updated_at();

create trigger set_club_application_reviews_updated_at
before update on public.club_application_reviews
for each row
execute function public.set_updated_at();

alter table public.club_application_forms enable row level security;
alter table public.club_application_form_sections enable row level security;
alter table public.club_application_form_questions enable row level security;
alter table public.club_application_form_options enable row level security;
alter table public.club_application_submissions enable row level security;
alter table public.club_application_submission_answers enable row level security;
alter table public.club_application_import_batches enable row level security;
alter table public.club_reviewer_assignments enable row level security;
alter table public.club_application_reviews enable row level security;

drop policy if exists "Profiles are viewable by owner or club admins" on public.profiles;
create policy "Profiles are viewable by owner admins or assigned reviewers"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1
    from public.user_applications ua
    join public.club_admin_memberships cam
      on cam.club_id = ua.club_id
     and cam.user_id = auth.uid()
     and cam.role = 'admin'
    where ua.user_id = public.profiles.id
  )
  or exists (
    select 1
    from public.user_applications ua
    join public.club_reviewer_assignments cra
      on cra.application_id = ua.id
     and cra.reviewer_user_id = auth.uid()
    where ua.user_id = public.profiles.id
  )
);

drop policy if exists "Club admins can view applications for their clubs" on public.user_applications;
drop policy if exists "Club admins can update applications for their clubs" on public.user_applications;

create policy "Club admins can view applications for their clubs"
on public.user_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.user_applications.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can insert applications for their clubs"
on public.user_applications
for insert
to authenticated
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.user_applications.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Assigned reviewers can view their applications"
on public.user_applications
for select
to authenticated
using (
  exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.user_applications.id
      and cra.reviewer_user_id = auth.uid()
  )
);

create policy "Club admins can update applications for their clubs"
on public.user_applications
for update
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.user_applications.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.user_applications.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can view memberships for their clubs"
on public.club_admin_memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_admin_memberships.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can update their clubs"
on public.clubs
for update
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.clubs.id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.clubs.id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can create deadlines for their clubs"
on public.club_deadlines
for insert
to authenticated
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_deadlines.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can update deadlines for their clubs"
on public.club_deadlines
for update
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_deadlines.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_deadlines.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can delete deadlines for their clubs"
on public.club_deadlines
for delete
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_deadlines.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Published forms are viewable by everyone"
on public.club_application_forms
for select
to anon, authenticated
using (status = 'published');

create policy "Published sections are viewable by everyone"
on public.club_application_form_sections
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.club_application_forms caf
    where caf.id = public.club_application_form_sections.form_id
      and caf.status = 'published'
  )
);

create policy "Published questions are viewable by everyone"
on public.club_application_form_questions
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.club_application_form_sections cfs
    join public.club_application_forms caf on caf.id = cfs.form_id
    where cfs.id = public.club_application_form_questions.section_id
      and caf.status = 'published'
  )
);

create policy "Published question options are viewable by everyone"
on public.club_application_form_options
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.club_application_form_questions cfq
    join public.club_application_form_sections cfs on cfs.id = cfq.section_id
    join public.club_application_forms caf on caf.id = cfs.form_id
    where cfq.id = public.club_application_form_options.question_id
      and caf.status = 'published'
  )
);

create policy "Club admins can manage forms for their clubs"
on public.club_application_forms
for all
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_application_forms.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_application_forms.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can manage form sections"
on public.club_application_form_sections
for all
to authenticated
using (
  exists (
    select 1
    from public.club_application_forms caf
    join public.club_admin_memberships cam on cam.club_id = caf.club_id
    where caf.id = public.club_application_form_sections.form_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_application_forms caf
    join public.club_admin_memberships cam on cam.club_id = caf.club_id
    where caf.id = public.club_application_form_sections.form_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can manage form questions"
on public.club_application_form_questions
for all
to authenticated
using (
  exists (
    select 1
    from public.club_application_form_sections cfs
    join public.club_application_forms caf on caf.id = cfs.form_id
    join public.club_admin_memberships cam on cam.club_id = caf.club_id
    where cfs.id = public.club_application_form_questions.section_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_application_form_sections cfs
    join public.club_application_forms caf on caf.id = cfs.form_id
    join public.club_admin_memberships cam on cam.club_id = caf.club_id
    where cfs.id = public.club_application_form_questions.section_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Club admins can manage question options"
on public.club_application_form_options
for all
to authenticated
using (
  exists (
    select 1
    from public.club_application_form_questions cfq
    join public.club_application_form_sections cfs on cfs.id = cfq.section_id
    join public.club_application_forms caf on caf.id = cfs.form_id
    join public.club_admin_memberships cam on cam.club_id = caf.club_id
    where cfq.id = public.club_application_form_options.question_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_application_form_questions cfq
    join public.club_application_form_sections cfs on cfs.id = cfq.section_id
    join public.club_application_forms caf on caf.id = cfs.form_id
    join public.club_admin_memberships cam on cam.club_id = caf.club_id
    where cfq.id = public.club_application_form_options.question_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Students can view their own native submissions"
on public.club_application_submissions
for select
to authenticated
using (user_id = auth.uid());

create policy "Students can create their own native submissions"
on public.club_application_submissions
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Students can update their own native submissions"
on public.club_application_submissions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Admins can view submissions for their clubs"
on public.club_application_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_application_submissions.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Assigned reviewers can view submissions"
on public.club_application_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.club_application_submissions.application_id
      and cra.reviewer_user_id = auth.uid()
  )
);

create policy "Students can manage their own answers"
on public.club_application_submission_answers
for all
to authenticated
using (
  exists (
    select 1
    from public.club_application_submissions cas
    where cas.id = public.club_application_submission_answers.submission_id
      and cas.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.club_application_submissions cas
    where cas.id = public.club_application_submission_answers.submission_id
      and cas.user_id = auth.uid()
  )
);

create policy "Admins can view submission answers for their clubs"
on public.club_application_submission_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.club_application_submissions cas
    join public.club_admin_memberships cam on cam.club_id = cas.club_id
    where cas.id = public.club_application_submission_answers.submission_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Assigned reviewers can view submission answers"
on public.club_application_submission_answers
for select
to authenticated
using (
  exists (
    select 1
    from public.club_application_submissions cas
    join public.club_reviewer_assignments cra on cra.application_id = cas.application_id
    where cas.id = public.club_application_submission_answers.submission_id
      and cra.reviewer_user_id = auth.uid()
  )
);

create policy "Admins can manage import batches"
on public.club_application_import_batches
for all
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_application_import_batches.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_application_import_batches.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

create policy "Admins can manage reviewer assignments"
on public.club_reviewer_assignments
for all
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
);

create policy "Reviewers can view their assignments"
on public.club_reviewer_assignments
for select
to authenticated
using (reviewer_user_id = auth.uid());

create policy "Admins can view application reviews for their clubs"
on public.club_application_reviews
for select
to authenticated
using (
  exists (
    select 1
    from public.club_admin_memberships cam
    where cam.club_id = public.club_application_reviews.club_id
      and cam.user_id = auth.uid()
      and cam.role = 'admin'
  )
);

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
      and cra.reviewer_user_id = auth.uid()
  )
);

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
      and cra.reviewer_user_id = auth.uid()
  )
)
with check (
  reviewer_user_id = auth.uid()
  and exists (
    select 1
    from public.club_reviewer_assignments cra
    where cra.application_id = public.club_application_reviews.application_id
      and cra.reviewer_user_id = auth.uid()
  )
);
